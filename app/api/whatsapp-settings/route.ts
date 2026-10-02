import { z } from "zod";
import { one, transaction } from "@/lib/db";
import { whatsappStatus, type WhatsAppSettings } from "@/lib/whatsapp";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const ref = z.string().regex(/^[A-Z][A-Z0-9_]{2,99}$/, "Use an environment variable name, not the secret itself").nullable().optional();
const schema = z.object({
  phoneNumberId: z.string().regex(/^[0-9]{5,30}$/).nullable().optional(),
  wabaId: z.string().regex(/^[0-9]{5,30}$/).nullable().optional(),
  accessTokenSecretRef: ref, appSecretRef: ref, webhookVerifyTokenSecretRef: ref,
  apiVersion: z.string().regex(/^v[0-9]{1,3}\.[0-9]$/).optional(),
});

export async function GET() {
  try {
    const actor = await requireActor(["OWNER","MANAGER"]);
    const settings = await one<WhatsAppSettings & { display_phone: string | null }>("SELECT display_phone,phone_number_id,waba_id,access_token_secret_ref,app_secret_ref,webhook_verify_token_secret_ref,api_version FROM whatsapp_channel_settings WHERE organization_id=$1", [actor.organization_id]);
    return Response.json({ settings, status: whatsappStatus(settings), testProvider: process.env.MESSAGING_TEST_PROVIDER === "true" });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const input = schema.parse(await request.json());
    const settings = await transaction(async (client) => {
      const columns: Array<[keyof typeof input, string]> = [["phoneNumberId","phone_number_id"],["wabaId","waba_id"],["accessTokenSecretRef","access_token_secret_ref"],["appSecretRef","app_secret_ref"],["webhookVerifyTokenSecretRef","webhook_verify_token_secret_ref"],["apiVersion","api_version"]];
      await client.query("INSERT INTO whatsapp_channel_settings(organization_id,updated_by) VALUES($1,$2) ON CONFLICT(organization_id) DO NOTHING", [actor.organization_id,actor.id]);
      const sets: string[] = []; const values: unknown[] = [actor.organization_id];
      for (const [key, column] of columns) if (input[key] !== undefined) { values.push(input[key]); sets.push(`${column}=$${values.length}`); }
      values.push(actor.id);
      await client.query(`UPDATE whatsapp_channel_settings SET ${[...sets, `updated_by=$${values.length}`].join(",")},updated_at=now() WHERE organization_id=$1`, values);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'WHATSAPP_SETTINGS_CHANGED','organization',$1,$3)`, [actor.organization_id,actor.id,JSON.stringify(input)]);
      const after = await client.query<WhatsAppSettings>("SELECT phone_number_id,waba_id,access_token_secret_ref,app_secret_ref,webhook_verify_token_secret_ref,api_version FROM whatsapp_channel_settings WHERE organization_id=$1", [actor.organization_id]);
      return after.rows[0];
    });
    return Response.json({ settings, status: whatsappStatus(settings) });
  } catch (error) { return jsonError(error); }
}
