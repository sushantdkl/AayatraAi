CREATE TABLE quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid NOT NULL,
  quotation_number text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW_REQUIRED','APPROVED','SENT','ACCEPTED','REJECTED','EXPIRED','CANCELLED')),
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  accepted_version integer,
  accepted_at timestamptz,
  acceptance_evidence text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  UNIQUE(organization_id, quotation_number),
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id),
  FOREIGN KEY(approved_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (status <> 'ACCEPTED' OR (accepted_version IS NOT NULL AND accepted_at IS NOT NULL AND acceptance_evidence IS NOT NULL))
);

CREATE TABLE quotation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  quotation_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  client_name text NOT NULL,
  business_type text NOT NULL,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL,
  line_items jsonb NOT NULL,
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'NPR',
  commercial_notes text,
  scope text NOT NULL,
  exclusions text NOT NULL,
  payment_terms text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quotation_id,version),
  FOREIGN KEY(quotation_id, organization_id) REFERENCES quotations(id, organization_id),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor)
);
CREATE TRIGGER quotation_versions_immutable BEFORE UPDATE OR DELETE ON quotation_versions FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE TABLE service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  template_reference text NOT NULL,
  version_reference text NOT NULL,
  legal_approved_by uuid NOT NULL,
  acceptance_evidence text NOT NULL,
  accepted_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id),
  FOREIGN KEY(quotation_id, organization_id) REFERENCES quotations(id, organization_id),
  FOREIGN KEY(legal_approved_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(recorded_by, organization_id) REFERENCES users(id, organization_id)
);
CREATE TRIGGER service_agreements_immutable BEFORE UPDATE OR DELETE ON service_agreements FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE TABLE payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL DEFAULT 'NPR',
  method text NOT NULL CHECK (method IN ('MANUAL_BANK','MANUAL_QR','CASH','PAYMENT_GATEWAY','FUTURE_PROVIDER')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REQUESTED','PENDING','SUBMITTED_FOR_VERIFICATION','VERIFIED','FAILED','EXPIRED','CANCELLED','REFUNDED')),
  provider_reference text,
  verification_evidence text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id),
  FOREIGN KEY(quotation_id, organization_id) REFERENCES quotations(id, organization_id),
  FOREIGN KEY(verified_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id),
  CHECK (status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification_evidence IS NOT NULL))
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  payment_request_id uuid NOT NULL,
  event_type text NOT NULL,
  provider_event_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(payment_request_id, organization_id) REFERENCES payment_requests(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);
CREATE UNIQUE INDEX payment_provider_event_dedupe ON payment_events(organization_id,provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE TABLE implementation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'SETUP' CHECK (status IN ('SETUP','IMPORT','HARDWARE','CONFIGURATION','TRAINING','UAT','GO_LIVE','HANDOVER','SUPPORT','COMPLETE','ON_HOLD')),
  assigned_owner uuid,
  target_go_live date,
  setup_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  uat_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (uat_status IN ('NOT_STARTED','IN_PROGRESS','PASS','FAIL')),
  handover_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (handover_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  UNIQUE(organization_id, opportunity_id),
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(assigned_owner, organization_id) REFERENCES users(id, organization_id)
);

CREATE TABLE onboarding_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  step_key text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','PASS','FAIL','NOT_APPLICABLE')),
  evidence_reference text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,step_key),
  FOREIGN KEY(project_id, organization_id) REFERENCES implementation_projects(id, organization_id),
  FOREIGN KEY(completed_by, organization_id) REFERENCES users(id, organization_id)
);
