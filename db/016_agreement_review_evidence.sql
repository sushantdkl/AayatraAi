ALTER TABLE service_agreements RENAME COLUMN legal_approved_by TO recorded_approval_by;
ALTER TABLE service_agreements ADD COLUMN legal_review_reference text;
COMMENT ON COLUMN service_agreements.recorded_approval_by IS 'Owner who approved recording this signed agreement; not a claim of legal-counsel review';
