/** Operational references only. The supplied kit is a template, not verified product or legal evidence. */
export const clientKitVersion = "Aadhar_POS_Client_Kit.zip SHA256 2AC7F83A5BB0354AFAF908E39970DC0B019AEA5E41643DDC119FE64FF93E2C71";

export const marketingDiscrepancies: Record<string, { code: string; description: string; sourceReference: string }> = {
  "Enterprise yearly": {
    code: "CLIENT_KIT_ENTERPRISE_YEARLY",
    description: "Marketing draft says NPR 40,000/year; client-kit quotation says from NPR 50,000/year. Neither is an approved exact client price.",
    sourceReference: "01_Aadhar_POS_Quotation_Template.docx",
  },
  "Thermal printer": {
    code: "CLIENT_KIT_THERMAL_PRINTER",
    description: "Marketing draft says NPR 14,000; client kit indicates NPR 8,000–10,000 for an unspecified thermal receipt printer. Confirm model, supplier and final quote.",
    sourceReference: "01_Aadhar_POS_Quotation_Template.docx",
  },
};

export const onboardingSteps = [
  ["INVOICE_RECORD", "Approved invoice and payment record checked", "09_Aadhar_POS_Invoice_Receipt_Template.docx"],
  ["WELCOME", "Welcome guide and delivery owner assigned", "03_Aadhar_POS_Welcome_Onboarding_Guide.docx"],
  ["SETUP_FORM", "Signed client setup information reviewed", "04_Aadhar_POS_Client_Setup_Form.docx"],
  ["DATA_IMPORT", "Applicable data-import workbook received and validated", "Aadhar_POS_Data_Import_Templates.xlsx"],
  ["MIGRATION_SIGNOFF", "Opening data, balances and cut-off reconciled with client", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["HARDWARE", "Hardware, network and power readiness checked", "05_Aadhar_POS_Hardware_Infrastructure_Checklist.docx"],
  ["CONFIGURATION", "Contracted modules, tax, roles and workflows configured", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["BACKUP_RESTORE", "Backup arrangement and restore responsibility recorded", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["TRAINING", "Role-based user training and attendance recorded", "07_Aadhar_POS_Training_UAT_Acceptance.docx"],
  ["WORKFLOW_TESTS", "Contracted sale, payment, refund, close and device flows tested", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["UAT", "Client UAT acceptance and open issues signed", "07_Aadhar_POS_Training_UAT_Acceptance.docx"],
  ["GO_LIVE_APPROVAL", "Client and Aadhar go-live decision signed", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["GO_LIVE", "Production launch completed with evidence", "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"],
  ["SUPPORT_PLAN", "Support channel, hours, severity and backup terms agreed", "08_Aadhar_POS_Handover_Support_SLA.docx"],
  ["HANDOVER", "Client handover and support acceptance signed", "08_Aadhar_POS_Handover_Support_SLA.docx"],
  ["SUPPORT", "Support ownership accepted", "08_Aadhar_POS_Handover_Support_SLA.docx"],
  ["FEEDBACK", "Post-use feedback requested with testimonial consent separate", "10_Aadhar_POS_Feedback_Testimonial_Form.docx"],
  ["RENEWAL", "Renewal review scheduled", "00_Aadhar_POS_Client_Kit_Index.docx"],
] as const;

export type OnboardingStepKey = (typeof onboardingSteps)[number][0];
export const requiredBefore: Partial<Record<OnboardingStepKey, readonly OnboardingStepKey[]>> = {
  WELCOME: ["INVOICE_RECORD"],
  SETUP_FORM: ["WELCOME"],
  DATA_IMPORT: ["SETUP_FORM"],
  MIGRATION_SIGNOFF: ["DATA_IMPORT"],
  CONFIGURATION: ["SETUP_FORM"],
  TRAINING: ["CONFIGURATION"],
  UAT: ["MIGRATION_SIGNOFF", "HARDWARE", "CONFIGURATION", "TRAINING", "WORKFLOW_TESTS"],
  GO_LIVE_APPROVAL: ["UAT", "BACKUP_RESTORE"],
  GO_LIVE: ["GO_LIVE_APPROVAL"],
  HANDOVER: ["GO_LIVE", "SUPPORT_PLAN"],
  SUPPORT: ["HANDOVER"],
  FEEDBACK: ["GO_LIVE"],
  RENEWAL: ["SUPPORT"],
};

export function missingOnboardingPrerequisites(stepKey: OnboardingStepKey, statuses: Record<string, string>): OnboardingStepKey[] {
  return (requiredBefore[stepKey] ?? []).filter((required) => statuses[required] !== "PASS");
}
