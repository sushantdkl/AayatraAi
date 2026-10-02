ALTER TABLE product_capabilities ADD CONSTRAINT product_capabilities_id_org_unique UNIQUE(id, organization_id);

CREATE TABLE commercial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_family text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('SOFTWARE','HARDWARE','SERVICE')),
  name text NOT NULL,
  billing_type text NOT NULL CHECK (billing_type IN ('ONE_TIME','RECURRING')),
  billing_period text CHECK (billing_period IN ('MONTH','YEAR')),
  currency char(3) NOT NULL DEFAULT 'NPR',
  catalog_status text NOT NULL DEFAULT 'DRAFT' CHECK (catalog_status IN ('DRAFT','VERIFIED','ACTIVE','RETIRED')),
  verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION' CHECK (verification_status IN ('NEEDS_VERIFICATION','VERIFIED')),
  is_active boolean NOT NULL DEFAULT false,
  effective_from date,
  effective_to date,
  approval_required boolean NOT NULL DEFAULT true,
  negotiable boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(verified_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (billing_type='RECURRING' OR billing_period IS NULL),
  CHECK (billing_type='ONE_TIME' OR billing_period IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CHECK (catalog_status<>'ACTIVE' OR (is_active AND verification_status='VERIFIED' AND verified_at IS NOT NULL))
);

CREATE TABLE commercial_price_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  item_id uuid NOT NULL,
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  source_name text NOT NULL,
  evidence_reference text,
  is_canonical boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(item_id, organization_id) REFERENCES commercial_items(id, organization_id)
);
CREATE UNIQUE INDEX commercial_one_canonical_source ON commercial_price_sources(item_id) WHERE is_canonical AND active;
CREATE INDEX commercial_price_lookup ON commercial_price_sources(organization_id,item_id,active);

CREATE TABLE sales_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  primary_sales_phone text,
  secondary_sales_phone text,
  whatsapp_number text,
  sales_email text,
  support_email text,
  website_url text,
  company_address text,
  business_hours text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(updated_by, organization_id) REFERENCES users(id, organization_id)
);

CREATE TABLE demo_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_family text NOT NULL,
  name text NOT NULL,
  base_url text,
  login_url text,
  environment text NOT NULL DEFAULT 'DEMO' CHECK (environment IN ('DEMO','STAGING')),
  enabled boolean NOT NULL DEFAULT false,
  requires_login boolean NOT NULL DEFAULT false,
  username_secret_ref text,
  password_secret_ref text,
  demo_tenant_reference text,
  navigation_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  allow_mutations boolean NOT NULL DEFAULT false,
  last_health_check timestamptz,
  last_verified_at timestamptz,
  status text NOT NULL DEFAULT 'WAITING_FOR_DEMO_URL' CHECK (status IN ('WAITING_FOR_DEMO_URL','PENDING_REVIEW','READY_FOR_TEST','HEALTHY','FAILED','DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  UNIQUE(organization_id, product_family, name),
  CHECK (NOT allow_mutations OR (environment='DEMO' AND demo_tenant_reference IS NOT NULL)),
  CHECK (status='WAITING_FOR_DEMO_URL' OR base_url IS NOT NULL)
);

CREATE TABLE demo_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_family text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEWED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  UNIQUE(organization_id, product_family, name, version)
);
CREATE TABLE demo_script_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  script_id uuid NOT NULL,
  step_order integer NOT NULL CHECK (step_order > 0),
  action text NOT NULL CHECK (action IN ('OPEN_ROUTE','CLICK','TYPE_DEMO_DATA','SELECT','WAIT','SCROLL','SHOW_TOOLTIP','CAPTURE','HIGHLIGHT')),
  route text,
  selector text,
  expected_state text,
  wait_condition text,
  caption text,
  voiceover_text text,
  duration_hint_ms integer CHECK (duration_hint_ms BETWEEN 0 AND 600000),
  fallback_action text,
  is_mutating boolean NOT NULL DEFAULT false,
  required_capability_id uuid,
  UNIQUE(script_id, step_order),
  FOREIGN KEY(script_id, organization_id) REFERENCES demo_scripts(id, organization_id),
  FOREIGN KEY(required_capability_id, organization_id) REFERENCES product_capabilities(id, organization_id)
);

CREATE TABLE demo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid,
  target_id uuid NOT NULL,
  script_id uuid,
  status text NOT NULL DEFAULT 'BLOCKED' CHECK (status IN ('BLOCKED','QUEUED','RUNNING','AWAITING_REVIEW','COMPLETE','FAILED','CANCELLED')),
  job_type text NOT NULL CHECK (job_type IN ('HEALTH_CHECK','SCRIPT_TEST','VIDEO')),
  failure_reason text,
  output_reference text,
  duration_ms integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(target_id, organization_id) REFERENCES demo_targets(id, organization_id),
  FOREIGN KEY(script_id, organization_id) REFERENCES demo_scripts(id, organization_id),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id)
);
CREATE INDEX demo_jobs_queue ON demo_jobs(organization_id,status,created_at);
