ALTER TABLE demo_targets ADD COLUMN synthetic_data_evidence text;
ALTER TABLE demo_targets ADD COLUMN synthetic_data_approved_by uuid;
ALTER TABLE demo_targets ADD COLUMN synthetic_data_approved_at timestamptz;
ALTER TABLE demo_targets ADD CONSTRAINT demo_synthetic_approver FOREIGN KEY(synthetic_data_approved_by,organization_id) REFERENCES users(id,organization_id);
ALTER TABLE demo_targets ADD CONSTRAINT demo_synthetic_attestation_complete CHECK (
  (synthetic_data_evidence IS NULL AND synthetic_data_approved_by IS NULL AND synthetic_data_approved_at IS NULL) OR
  (synthetic_data_evidence IS NOT NULL AND synthetic_data_approved_by IS NOT NULL AND synthetic_data_approved_at IS NOT NULL)
);
