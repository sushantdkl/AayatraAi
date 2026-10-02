CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  file_name text NOT NULL,
  source_note text NOT NULL,
  row_count integer NOT NULL CHECK (row_count BETWEEN 1 AND 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id)
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  segment text NOT NULL,
  hypothesis text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','CLOSED')),
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(owner_id, organization_id) REFERENCES users(id, organization_id)
);

ALTER TABLE leads ADD COLUMN campaign_id uuid;
ALTER TABLE leads ADD CONSTRAINT leads_campaign_tenant_fk
  FOREIGN KEY(campaign_id, organization_id) REFERENCES campaigns(id, organization_id);
ALTER TABLE source_records ADD COLUMN import_batch_id uuid REFERENCES import_batches(id);

CREATE INDEX idx_leads_campaign ON leads(organization_id,campaign_id);
