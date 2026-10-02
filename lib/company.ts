export type CompanyProfile = {
  legal_or_trading_name: string;
  brand: string;
  city: string;
  country: string;
  primary_whatsapp: string | null;
  tax_status: "PAN_ONLY" | "VAT_REGISTERED";
  pan_number: string | null;
  document_status: "PENDING" | "UPLOADED" | "VERIFIED" | "REJECTED";
  registered_name: string | null;
  registered_address: string | null;
  authorized_signatory: string | null;
  legal_email: string | null;
  bank_details: string | null;
  vat_number: string | null;
  legal_status: "REVIEW_REQUIRED" | "APPROVED";
};

/** Fields that must be verified before a production legal/tax invoice may be issued. */
export function invoiceReadiness(profile: CompanyProfile | null): { ready: boolean; missing: string[] } {
  if (!profile) return { ready: false, missing: ["COMPANY_PROFILE"] };
  const missing: string[] = [];
  if (!profile.pan_number) missing.push("PAN_NUMBER");
  if (profile.document_status !== "VERIFIED") missing.push("PAN_DOCUMENT_VERIFIED");
  if (!profile.registered_name) missing.push("REGISTERED_NAME");
  if (!profile.registered_address) missing.push("FULL_REGISTERED_ADDRESS");
  if (!profile.authorized_signatory) missing.push("AUTHORIZED_SIGNATORY");
  if (!profile.legal_email) missing.push("LEGAL_EMAIL");
  if (profile.tax_status === "VAT_REGISTERED" && !profile.vat_number) missing.push("VAT_NUMBER");
  return { ready: missing.length === 0, missing };
}

/** Document titles: a PAN-only bill is never labelled a VAT/tax invoice. */
export function documentTitle(kind: "QUOTATION" | "INVOICE", taxStatus: CompanyProfile["tax_status"] | null): string {
  if (kind === "QUOTATION") return "Quotation";
  return taxStatus === "VAT_REGISTERED" ? "Tax Invoice" : "Invoice";
}

export function vatLine(taxStatus: CompanyProfile["tax_status"] | null, taxMinor: number): { label: string; note: string | null } {
  if (taxStatus === "VAT_REGISTERED" && taxMinor > 0) return { label: "VAT", note: null };
  return { label: "VAT", note: "Not separately charged under current PAN-only company configuration." };
}

/** Public company facts for documents and AI grounding. PAN is shown only once verified. */
export function companySnapshot(profile: CompanyProfile | null) {
  if (!profile) return null;
  return {
    name: profile.legal_or_trading_name,
    brand: profile.brand,
    location: `${profile.city}, ${profile.country}`,
    whatsapp: profile.primary_whatsapp,
    taxStatus: profile.tax_status,
    pan: profile.document_status === "VERIFIED" ? profile.pan_number : null,
    vat: profile.tax_status === "VAT_REGISTERED" ? profile.vat_number : null,
    registeredAddress: profile.registered_address,
  };
}

/** Magic-byte check for uploaded registration documents. */
export function detectDocumentType(bytes: Uint8Array): "pdf" | "png" | "jpg" | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}
