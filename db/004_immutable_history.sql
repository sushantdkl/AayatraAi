ALTER TABLE product_capabilities ADD CONSTRAINT capabilities_id_org_unique UNIQUE(id, organization_id);

CREATE TABLE capability_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  capability_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('UNVERIFIED','VERIFIED','OPTIONAL','BETA','PLANNED','CUSTOM_REVIEW','UNSUPPORTED')),
  evidence_url text,
  approved_language text,
  product_version text,
  limitation text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(capability_id, version),
  FOREIGN KEY(capability_id, organization_id) REFERENCES product_capabilities(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);

CREATE OR REPLACE FUNCTION prevent_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'History rows are append-only';
END;
$$;

CREATE TRIGGER capability_versions_immutable BEFORE UPDATE OR DELETE ON capability_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_history_change();
CREATE TRIGGER stage_history_immutable BEFORE UPDATE OR DELETE ON stage_history
  FOR EACH ROW EXECUTE FUNCTION prevent_history_change();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE INDEX idx_capability_versions_latest ON capability_versions(organization_id, capability_id, version DESC);
