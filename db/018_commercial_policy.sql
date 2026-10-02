CREATE TABLE commercial_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  tax_mode text NOT NULL DEFAULT 'UNCONFIGURED' CHECK (tax_mode IN ('UNCONFIGURED','EXEMPT','EXCLUSIVE')),
  tax_rate_bps integer CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  tax_label text,
  max_manual_discount_bps integer NOT NULL DEFAULT 0 CHECK (max_manual_discount_bps BETWEEN 0 AND 10000),
  max_auto_discount_bps integer NOT NULL DEFAULT 0 CHECK (max_auto_discount_bps BETWEEN 0 AND 10000),
  max_negotiation_rounds integer NOT NULL DEFAULT 0 CHECK (max_negotiation_rounds BETWEEN 0 AND 20),
  max_messages_per_contact_per_day integer NOT NULL DEFAULT 0 CHECK (max_messages_per_contact_per_day BETWEEN 0 AND 100),
  consent_required boolean NOT NULL DEFAULT true,
  evidence_reference text,
  approved_by uuid,
  approved_at timestamptz,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(approved_by,organization_id) REFERENCES users(id,organization_id),
  FOREIGN KEY(updated_by,organization_id) REFERENCES users(id,organization_id),
  CHECK (max_auto_discount_bps <= max_manual_discount_bps),
  CHECK ((tax_mode='EXCLUSIVE' AND tax_rate_bps IS NOT NULL AND tax_rate_bps > 0) OR
         (tax_mode='EXEMPT' AND tax_rate_bps=0) OR
         (tax_mode='UNCONFIGURED' AND tax_rate_bps IS NULL)),
  CHECK (status <> 'APPROVED' OR (tax_mode <> 'UNCONFIGURED' AND evidence_reference IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND version > 0))
);

ALTER TABLE commercial_items ADD COLUMN min_price_minor bigint CHECK (min_price_minor >= 0);
ALTER TABLE commercial_items ADD COLUMN min_price_evidence text;
ALTER TABLE commercial_items ADD COLUMN min_price_approved_by uuid;
ALTER TABLE commercial_items ADD CONSTRAINT commercial_floor_approver FOREIGN KEY(min_price_approved_by,organization_id) REFERENCES users(id,organization_id);
ALTER TABLE commercial_items ADD CONSTRAINT commercial_floor_evidence CHECK (min_price_minor IS NULL OR (min_price_evidence IS NOT NULL AND min_price_approved_by IS NOT NULL));

ALTER TABLE quotation_versions ADD COLUMN commercial_policy_version integer;
ALTER TABLE quotation_versions ADD COLUMN tax_mode text;
ALTER TABLE quotation_versions ADD COLUMN tax_rate_bps integer;
