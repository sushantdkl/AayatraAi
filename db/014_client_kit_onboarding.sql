ALTER TABLE onboarding_checklist ADD COLUMN source_document text;

WITH kit(step_key,title,source_document) AS (VALUES
 ('INVOICE_RECORD','Approved invoice and payment record checked','09_Aadhar_POS_Invoice_Receipt_Template.docx'),
 ('WELCOME','Welcome guide and delivery owner assigned','03_Aadhar_POS_Welcome_Onboarding_Guide.docx'),
 ('SETUP_FORM','Signed client setup information reviewed','04_Aadhar_POS_Client_Setup_Form.docx'),
 ('DATA_IMPORT','Applicable data-import workbook received and validated','Aadhar_POS_Data_Import_Templates.xlsx'),
 ('MIGRATION_SIGNOFF','Opening data, balances and cut-off reconciled with client','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('HARDWARE','Hardware, network and power readiness checked','05_Aadhar_POS_Hardware_Infrastructure_Checklist.docx'),
 ('CONFIGURATION','Contracted modules, tax, roles and workflows configured','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('BACKUP_RESTORE','Backup arrangement and restore responsibility recorded','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('TRAINING','Role-based user training and attendance recorded','07_Aadhar_POS_Training_UAT_Acceptance.docx'),
 ('WORKFLOW_TESTS','Contracted sale, payment, refund, close and device flows tested','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('UAT','Client UAT acceptance and open issues signed','07_Aadhar_POS_Training_UAT_Acceptance.docx'),
 ('GO_LIVE_APPROVAL','Client and Aadhar go-live decision signed','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('GO_LIVE','Production launch completed with evidence','06_Aadhar_POS_Implementation_GoLive_Checklist.docx'),
 ('SUPPORT_PLAN','Support channel, hours, severity and backup terms agreed','08_Aadhar_POS_Handover_Support_SLA.docx'),
 ('HANDOVER','Client handover and support acceptance signed','08_Aadhar_POS_Handover_Support_SLA.docx'),
 ('SUPPORT','Support ownership accepted','08_Aadhar_POS_Handover_Support_SLA.docx'),
 ('FEEDBACK','Post-use feedback requested with testimonial consent separate','10_Aadhar_POS_Feedback_Testimonial_Form.docx'),
 ('RENEWAL','Renewal review scheduled','00_Aadhar_POS_Client_Kit_Index.docx')
)
INSERT INTO onboarding_checklist(organization_id,project_id,step_key,title,source_document)
SELECT p.organization_id,p.id,k.step_key,k.title,k.source_document
FROM implementation_projects p CROSS JOIN kit k
ON CONFLICT(project_id,step_key) DO UPDATE SET title=EXCLUDED.title,source_document=EXCLUDED.source_document;
