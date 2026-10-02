CREATE TABLE business_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  signal_key text NOT NULL CHECK (signal_key IN (
    'WEBSITE_EXISTS','DIRECT_BOOKING','ECOMMERCE_EXISTS','DIGITAL_ORDERING',
    'MANUAL_ORDERING','LARGE_CATALOG','RESTAURANT_ON_SITE','MANUAL_KOT','MULTI_BRANCH'
  )),
  observed_value boolean NOT NULL,
  source_url text,
  note text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  observed_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);

CREATE INDEX idx_observations_lead ON business_observations(organization_id,lead_id,signal_key,observed_at DESC);
CREATE TRIGGER business_observations_immutable BEFORE UPDATE OR DELETE ON business_observations
  FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE UNIQUE INDEX users_email_global_unique ON users(lower(email));
