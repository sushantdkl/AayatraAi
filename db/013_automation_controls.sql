CREATE TABLE automation_controls (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  feature text NOT NULL CHECK (feature IN ('RESEARCH','LEAD_SCORING','MESSAGE_DRAFTING','AUTO_SEND','INBOUND_AI_REPLIES','DEMO_GENERATION','PROPOSAL_GENERATION','FOLLOW_UPS','NEGOTIATION','PAYMENT_REQUESTS','CLOSING','ONBOARDING')),
  mode text NOT NULL DEFAULT 'OFF' CHECK (mode IN ('OFF','ASSISTED','AUTOMATIC_WITH_RULES')),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,feature),
  FOREIGN KEY(updated_by, organization_id) REFERENCES users(id, organization_id)
);
