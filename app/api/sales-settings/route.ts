import { one, rows } from "@/lib/db";
import { salesSettingsSchema } from "@/lib/automation-schemas";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const settings = await one("SELECT primary_sales_phone,secondary_sales_phone,whatsapp_number,sales_email,support_email,website_url,company_address,business_hours,updated_at FROM sales_settings WHERE organization_id=$1", [actor.organization_id]);
    return Response.json({ settings: settings ?? null });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const input = salesSettingsSchema.parse(await request.json());
    const current = await one<Record<string, unknown>>("SELECT * FROM sales_settings WHERE organization_id=$1", [actor.organization_id]);
    const merged = {
      primarySalesPhone: input.primarySalesPhone !== undefined ? input.primarySalesPhone : current?.primary_sales_phone ?? null,
      secondarySalesPhone: input.secondarySalesPhone !== undefined ? input.secondarySalesPhone : current?.secondary_sales_phone ?? null,
      whatsappNumber: input.whatsappNumber !== undefined ? input.whatsappNumber : current?.whatsapp_number ?? null,
      salesEmail: input.salesEmail !== undefined ? input.salesEmail : current?.sales_email ?? null,
      supportEmail: input.supportEmail !== undefined ? input.supportEmail : current?.support_email ?? null,
      websiteUrl: input.websiteUrl !== undefined ? input.websiteUrl : current?.website_url ?? null,
      companyAddress: input.companyAddress !== undefined ? input.companyAddress : current?.company_address ?? null,
      businessHours: input.businessHours !== undefined ? input.businessHours : current?.business_hours ?? null,
    };
    await rows(
      `INSERT INTO sales_settings(organization_id,primary_sales_phone,secondary_sales_phone,whatsapp_number,sales_email,support_email,website_url,company_address,business_hours,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(organization_id) DO UPDATE SET primary_sales_phone=$2,secondary_sales_phone=$3,whatsapp_number=$4,sales_email=$5,support_email=$6,website_url=$7,company_address=$8,business_hours=$9,updated_by=$10,updated_at=now()`,
      [actor.organization_id,merged.primarySalesPhone,merged.secondarySalesPhone,merged.whatsappNumber,merged.salesEmail,merged.supportEmail,merged.websiteUrl,merged.companyAddress,merged.businessHours,actor.id],
    );
    return Response.json({ updated: true });
  } catch (error) { return jsonError(error); }
}
