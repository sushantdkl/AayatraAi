import { z } from "zod";
import { one, transaction } from "@/lib/db";
import { invoiceReadiness, type CompanyProfile } from "@/lib/company";
import { pendingCompanyFields } from "@/lib/owner-config";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const text = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const update = z.object({
  action: z.literal("UPDATE"),
  legalOrTradingName: z.string().trim().min(2).max(200).optional(),
  brand: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  country: z.string().trim().min(2).max(120).optional(),
  primaryWhatsapp: z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/).nullable().optional(),
  panNumber: z.string().trim().regex(/^[0-9]{9}$/, "PAN is 9 digits").nullable().optional(),
  registeredName: text(200), registeredAddress: text(500), registrationDate: z.iso.date().nullable().optional(),
  authorizedSignatory: text(200), legalEmail: z.email().max(320).nullable().optional(), bankDetails: text(1000),
});
const verifyPan = z.object({ action: z.literal("VERIFY_PAN_DOCUMENT"), evidence: z.string().trim().min(12).max(500) });
const rejectPan = z.object({ action: z.literal("REJECT_PAN_DOCUMENT"), evidence: z.string().trim().min(8).max(500) });
const setVat = z.object({ action: z.literal("SET_VAT_REGISTERED"), vatNumber: z.string().regex(/^[0-9]{9}$/), vatDocumentReference: z.string().trim().min(8).max(500) });
const revertPan = z.object({ action: z.literal("SET_PAN_ONLY"), evidence: z.string().trim().min(12).max(500) });
const approveLegal = z.object({ action: z.literal("APPROVE_LEGAL"), evidence: z.string().trim().min(12).max(500) });
const schema = z.discriminatedUnion("action", [update, verifyPan, rejectPan, setVat, revertPan, approveLegal]);

const columns = "organization_id,legal_or_trading_name,brand,city,country,primary_whatsapp,tax_status,pan_number,pan_document_reference,pan_document_sha256,document_status,registered_name,registered_address,registration_date,verified_at,vat_number,vat_document_reference,vat_verified_at,authorized_signatory,legal_email,bank_details,legal_status,legal_approved_at,updated_at";

export async function GET() {
  try {
    const actor = await requireActor();
    const profile = await one<CompanyProfile & Record<string, unknown>>(`SELECT ${columns},(SELECT display_name FROM users u WHERE u.id=c.verified_by) AS verified_by_name FROM company_profiles c WHERE organization_id=$1`, [actor.organization_id]);
    if (profile && !["OWNER", "MANAGER"].includes(actor.role)) profile.bank_details = profile.bank_details ? "Configured" : null;
    return Response.json({ profile, readiness: invoiceReadiness(profile), pending: pendingCompanyFields });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const before = await client.query(`SELECT ${columns} FROM company_profiles WHERE organization_id=$1 FOR UPDATE`, [actor.organization_id]);
      const current = before.rows[0];
      if (!current) throw new ApiError(409, "Apply the owner configuration first");
      if (input.action === "UPDATE") {
        const map: Array<[keyof typeof input, string]> = [["legalOrTradingName","legal_or_trading_name"],["brand","brand"],["city","city"],["country","country"],["primaryWhatsapp","primary_whatsapp"],["panNumber","pan_number"],["registeredName","registered_name"],["registeredAddress","registered_address"],["registrationDate","registration_date"],["authorizedSignatory","authorized_signatory"],["legalEmail","legal_email"],["bankDetails","bank_details"]];
        const sets: string[] = []; const values: unknown[] = [actor.organization_id];
        for (const [key, column] of map) if (input[key] !== undefined) { values.push(input[key]); sets.push(`${column}=$${values.length}`); }
        // Changing registration facts after verification sends the document back for review.
        const registrationChanged = ["panNumber","registeredName"].some((key) => input[key as keyof typeof input] !== undefined && input[key as keyof typeof input] !== current[key === "panNumber" ? "pan_number" : "registered_name"]);
        if (registrationChanged && current.document_status === "VERIFIED") sets.push(`document_status='UPLOADED',verified_by=NULL,verified_at=NULL`);
        if (!sets.length) throw new ApiError(400, "Nothing to update");
        values.push(actor.id);
        await client.query(`UPDATE company_profiles SET ${sets.join(",")},updated_by=$${values.length},updated_at=now() WHERE organization_id=$1`, values);
      } else if (input.action === "VERIFY_PAN_DOCUMENT") {
        if (!current.pan_number || !current.pan_document_reference) throw new ApiError(409, "Enter the PAN number and upload the PAN document first");
        await client.query("UPDATE company_profiles SET document_status='VERIFIED',verified_by=$2,verified_at=now(),updated_by=$2,updated_at=now() WHERE organization_id=$1", [actor.organization_id,actor.id]);
      } else if (input.action === "REJECT_PAN_DOCUMENT") {
        await client.query("UPDATE company_profiles SET document_status='REJECTED',verified_by=NULL,verified_at=NULL,updated_by=$2,updated_at=now() WHERE organization_id=$1", [actor.organization_id,actor.id]);
      } else if (input.action === "SET_VAT_REGISTERED") {
        if (current.document_status !== "VERIFIED") throw new ApiError(409, "Verify the PAN registration before recording VAT registration");
        await client.query(
          `UPDATE company_profiles SET tax_status='VAT_REGISTERED',vat_number=$2,vat_document_reference=$3,vat_verified_by=$4,vat_verified_at=now(),updated_by=$4,updated_at=now() WHERE organization_id=$1`,
          [actor.organization_id,input.vatNumber,input.vatDocumentReference,actor.id],
        );
        // A tax-status change always requires the commercial policy to be re-approved.
        await client.query("UPDATE commercial_policies SET status='DRAFT',approved_by=NULL,approved_at=NULL,evidence_reference=NULL,updated_by=$2,updated_at=now() WHERE organization_id=$1", [actor.organization_id,actor.id]);
      } else if (input.action === "SET_PAN_ONLY") {
        await client.query("UPDATE company_profiles SET tax_status='PAN_ONLY',updated_by=$2,updated_at=now() WHERE organization_id=$1", [actor.organization_id,actor.id]);
        await client.query("UPDATE commercial_policies SET status='DRAFT',approved_by=NULL,approved_at=NULL,evidence_reference=NULL,updated_by=$2,updated_at=now() WHERE organization_id=$1 AND tax_mode<>'PAN_ONLY'", [actor.organization_id,actor.id]);
      } else {
        await client.query("UPDATE company_profiles SET legal_status='APPROVED',legal_approval_evidence=$2,legal_approved_by=$3,legal_approved_at=now(),updated_by=$3,updated_at=now() WHERE organization_id=$1", [actor.organization_id,input.evidence,actor.id]);
      }
      const after = await client.query(`SELECT ${columns} FROM company_profiles WHERE organization_id=$1`, [actor.organization_id]);
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value,reason) VALUES($1,$2,$3,'company_profile',$1,$4,$5,$6)`,
        [actor.organization_id,actor.id,`COMPANY_${input.action}`,JSON.stringify({ ...current, bank_details: current.bank_details ? "[set]" : null }),JSON.stringify({ ...after.rows[0], bank_details: after.rows[0].bank_details ? "[set]" : null }),"evidence" in input ? input.evidence : null],
      );
      return after.rows[0];
    });
    return Response.json({ profile: result, readiness: invoiceReadiness(result) });
  } catch (error) { return jsonError(error); }
}
