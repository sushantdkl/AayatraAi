-- Owner-approved configuration addendum (2026-10-03): company identity, PAN-only tax,
-- canonical poster pricing, feature-claim matrix, buying temperature, AI reply drafts,
-- follow-ups and the WhatsApp Cloud channel. Seed values are applied by
-- lib/owner-config.ts (needs an owner actor), not by this schema migration.

CREATE TABLE company_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  legal_or_trading_name text NOT NULL,
  brand text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  primary_whatsapp text,
  tax_status text NOT NULL DEFAULT 'PAN_ONLY' CHECK (tax_status IN ('PAN_ONLY','VAT_REGISTERED')),
  pan_number text CHECK (pan_number ~ '^[0-9]{9}$'),
  pan_document_reference text,
  pan_document_sha256 text CHECK (pan_document_sha256 ~ '^[a-f0-9]{64}$'),
  document_status text NOT NULL DEFAULT 'PENDING' CHECK (document_status IN ('PENDING','UPLOADED','VERIFIED','REJECTED')),
  registered_name text,
  registered_address text,
  registration_date date,
  verified_by uuid,
  verified_at timestamptz,
  vat_number text CHECK (vat_number ~ '^[0-9]{9}$'),
  vat_document_reference text,
  vat_verified_by uuid,
  vat_verified_at timestamptz,
  authorized_signatory text,
  legal_email text,
  bank_details text,
  legal_status text NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (legal_status IN ('REVIEW_REQUIRED','APPROVED')),
  legal_approval_evidence text,
  legal_approved_by uuid,
  legal_approved_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(verified_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(vat_verified_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(legal_approved_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(updated_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (document_status <> 'VERIFIED' OR (pan_number IS NOT NULL AND pan_document_reference IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (document_status NOT IN ('UPLOADED','VERIFIED') OR pan_document_reference IS NOT NULL),
  -- VAT registration is never inferred from PAN registration: it needs its own verified evidence.
  CHECK (tax_status <> 'VAT_REGISTERED' OR (vat_number IS NOT NULL AND vat_document_reference IS NOT NULL AND vat_verified_by IS NOT NULL AND vat_verified_at IS NOT NULL)),
  CHECK (legal_status <> 'APPROVED' OR (legal_approval_evidence IS NOT NULL AND legal_approved_by IS NOT NULL AND legal_approved_at IS NOT NULL))
);

-- PAN-only companies do not add VAT; this is distinct from a VAT-exempt supply.
ALTER TABLE commercial_policies DROP CONSTRAINT commercial_policies_tax_mode_check;
ALTER TABLE commercial_policies ADD CONSTRAINT commercial_policies_tax_mode_check CHECK (tax_mode IN ('UNCONFIGURED','EXEMPT','EXCLUSIVE','PAN_ONLY'));
ALTER TABLE commercial_policies DROP CONSTRAINT commercial_policies_check1;
ALTER TABLE commercial_policies ADD CONSTRAINT commercial_policies_tax_rate_matches_mode CHECK (
  (tax_mode='EXCLUSIVE' AND tax_rate_bps IS NOT NULL AND tax_rate_bps > 0) OR
  (tax_mode IN ('EXEMPT','PAN_ONLY') AND tax_rate_bps=0) OR
  (tax_mode='UNCONFIGURED' AND tax_rate_bps IS NULL));
ALTER TABLE commercial_policies ADD COLUMN default_discount_bps integer NOT NULL DEFAULT 0 CHECK (default_discount_bps BETWEEN 0 AND 10000);
ALTER TABLE commercial_policies ADD CONSTRAINT commercial_policies_default_within_auto CHECK (default_discount_bps <= max_auto_discount_bps);
ALTER TABLE commercial_policies ADD COLUMN price_negotiable boolean NOT NULL DEFAULT true;

ALTER TABLE commercial_items DROP CONSTRAINT commercial_items_catalog_status_check;
ALTER TABLE commercial_items ADD CONSTRAINT commercial_items_catalog_status_check CHECK (catalog_status IN ('DRAFT','VERIFIED','ACTIVE','RETIRED','SUPERSEDED'));
ALTER TABLE commercial_items ADD COLUMN sku text CHECK (sku ~ '^[A-Z][A-Z0-9_]{2,79}$');
ALTER TABLE commercial_items ADD COLUMN package_code text;
ALTER TABLE commercial_items ADD COLUMN commercial_source text;
ALTER TABLE commercial_items ADD COLUMN superseded_by uuid;
ALTER TABLE commercial_items ADD CONSTRAINT commercial_items_superseded_by FOREIGN KEY(superseded_by, organization_id) REFERENCES commercial_items(id, organization_id);
ALTER TABLE commercial_items ADD CONSTRAINT commercial_items_superseded_complete CHECK (catalog_status <> 'SUPERSEDED' OR (superseded_by IS NOT NULL AND NOT is_active));
CREATE UNIQUE INDEX commercial_items_live_sku ON commercial_items(organization_id, sku) WHERE sku IS NOT NULL AND catalog_status IN ('DRAFT','VERIFIED','ACTIVE');

ALTER TABLE quotation_versions ADD COLUMN company_snapshot jsonb;
ALTER TABLE quotation_versions ADD COLUMN approval_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Sellable feature claims. Poster wording never sets these; source/test/demo evidence does.
CREATE TABLE product_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_family text NOT NULL,
  feature_key text NOT NULL CHECK (feature_key ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  name text NOT NULL,
  implementation_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (implementation_status IN ('VERIFIED_AVAILABLE','AVAILABLE_WITH_CONFIGURATION','PARTIAL','BETA','PLANNED','CUSTOM_ONLY','NOT_AVAILABLE','UNKNOWN')),
  commercial_status text NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (commercial_status IN ('SELLABLE','SELL_WITH_DISCLOSURE','REVIEW_REQUIRED','NOT_SALES_SAFE')),
  evidence text NOT NULL,
  limitations text,
  conditions text,
  approved_language text,
  packages text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  UNIQUE(organization_id, product_family, feature_key),
  FOREIGN KEY(verified_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (implementation_status NOT IN ('VERIFIED_AVAILABLE','AVAILABLE_WITH_CONFIGURATION') OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND approved_language IS NOT NULL)),
  CHECK (implementation_status <> 'AVAILABLE_WITH_CONFIGURATION' OR conditions IS NOT NULL),
  CHECK (commercial_status <> 'SELLABLE' OR implementation_status IN ('VERIFIED_AVAILABLE','AVAILABLE_WITH_CONFIGURATION'))
);
CREATE TABLE product_feature_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  feature_id uuid NOT NULL,
  implementation_status text NOT NULL,
  commercial_status text NOT NULL,
  evidence text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(feature_id, organization_id) REFERENCES product_features(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);
CREATE TRIGGER product_feature_history_immutable BEFORE UPDATE OR DELETE ON product_feature_history FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

-- Buying temperature (COLD .. CLOSED_WON) is separate from the pipeline stage.
ALTER TABLE leads ADD COLUMN sales_temperature text NOT NULL DEFAULT 'COLD' CHECK (sales_temperature IN ('COLD','WARM','INTERESTED','HOT','READY_TO_BUY','NEGOTIATING','PROPOSAL_SENT','PAYMENT_PENDING','CLOSED_WON','NOT_INTERESTED'));
ALTER TABLE leads ADD COLUMN temperature_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN follow_up_stopped boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN follow_up_stop_reason text;
CREATE INDEX leads_temperature ON leads(organization_id, sales_temperature, temperature_updated_at DESC);
CREATE TABLE lead_temperature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  from_temperature text NOT NULL,
  to_temperature text NOT NULL,
  cause text NOT NULL,
  message_id uuid,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(message_id, organization_id) REFERENCES conversation_messages(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);
CREATE TRIGGER lead_temperature_events_immutable BEFORE UPDATE OR DELETE ON lead_temperature_events FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

ALTER TABLE intent_events ADD COLUMN language text CHECK (language IN ('EN','NE','NE_ROMAN'));
ALTER TABLE intent_events ADD COLUMN temperature text;

CREATE TABLE ai_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conversation_id uuid NOT NULL,
  message_id uuid,
  kind text NOT NULL DEFAULT 'REPLY' CHECK (kind IN ('REPLY','FOLLOW_UP')),
  intent text NOT NULL,
  language text NOT NULL CHECK (language IN ('EN','NE','NE_ROMAN')),
  temperature text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  requires_human boolean NOT NULL,
  auto_send_eligible boolean NOT NULL DEFAULT false,
  escalation_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  generator_version text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFTED' CHECK (status IN ('DRAFTED','QUEUED_FOR_APPROVAL','DISCARDED','SUPERSEDED')),
  outbound_message_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(conversation_id, organization_id) REFERENCES conversations(id, organization_id),
  FOREIGN KEY(message_id, organization_id) REFERENCES conversation_messages(id, organization_id),
  FOREIGN KEY(outbound_message_id, organization_id) REFERENCES outbound_messages(id, organization_id),
  FOREIGN KEY(reviewed_by, organization_id) REFERENCES users(id, organization_id)
);
CREATE UNIQUE INDEX ai_reply_one_per_message ON ai_reply_drafts(organization_id, message_id) WHERE message_id IS NOT NULL AND status <> 'SUPERSEDED';
CREATE INDEX ai_reply_conversation ON ai_reply_drafts(organization_id, conversation_id, created_at DESC);

CREATE TABLE follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  temperature text NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 10),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DRAFTED','CANCELLED','DONE')),
  reason text NOT NULL,
  draft_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(conversation_id, organization_id) REFERENCES conversations(id, organization_id),
  FOREIGN KEY(draft_id, organization_id) REFERENCES ai_reply_drafts(id, organization_id),
  UNIQUE(conversation_id, temperature, attempt)
);
CREATE INDEX follow_up_due ON follow_up_tasks(organization_id, status, due_at);

-- WhatsApp Cloud API channel. Only secret *references* (env var names) are stored.
CREATE TABLE whatsapp_channel_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  display_phone text,
  phone_number_id text UNIQUE CHECK (phone_number_id ~ '^[0-9]{5,30}$'),
  waba_id text CHECK (waba_id ~ '^[0-9]{5,30}$'),
  access_token_secret_ref text CHECK (access_token_secret_ref ~ '^[A-Z][A-Z0-9_]{2,99}$'),
  app_secret_ref text CHECK (app_secret_ref ~ '^[A-Z][A-Z0-9_]{2,99}$'),
  webhook_verify_token_secret_ref text CHECK (webhook_verify_token_secret_ref ~ '^[A-Z][A-Z0-9_]{2,99}$'),
  api_version text NOT NULL DEFAULT 'v26.0' CHECK (api_version ~ '^v[0-9]{1,3}\.[0-9]$'),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(updated_by, organization_id) REFERENCES users(id, organization_id)
);

ALTER TABLE payment_requests ADD COLUMN verification_basis text CHECK (verification_basis IN ('AUTHORIZED_HUMAN','VERIFIED_RECONCILIATION'));

-- §41 structured conversation memory (server-derived; never written by the LLM).
ALTER TABLE conversations ADD COLUMN memory jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_reply_drafts ADD COLUMN source text NOT NULL DEFAULT 'TEMPLATE' CHECK (source IN ('TEMPLATE','LLM'));
ALTER TABLE ai_reply_drafts ADD COLUMN fallback_reason text;
ALTER TABLE ai_reply_drafts ADD COLUMN analysis jsonb;
ALTER TABLE follow_up_tasks ADD COLUMN requested_by_customer boolean NOT NULL DEFAULT false;
