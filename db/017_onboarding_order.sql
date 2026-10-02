ALTER TABLE onboarding_checklist ADD COLUMN display_order integer;
WITH ordered(step_key,display_order) AS (VALUES
 ('INVOICE_RECORD',1),('WELCOME',2),('SETUP_FORM',3),('DATA_IMPORT',4),('MIGRATION_SIGNOFF',5),
 ('HARDWARE',6),('CONFIGURATION',7),('BACKUP_RESTORE',8),('TRAINING',9),('WORKFLOW_TESTS',10),
 ('UAT',11),('GO_LIVE_APPROVAL',12),('GO_LIVE',13),('SUPPORT_PLAN',14),('HANDOVER',15),
 ('SUPPORT',16),('FEEDBACK',17),('RENEWAL',18)
)
UPDATE onboarding_checklist c SET display_order=o.display_order FROM ordered o WHERE c.step_key=o.step_key;
CREATE INDEX onboarding_checklist_order ON onboarding_checklist(project_id,display_order);
