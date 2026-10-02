ALTER TABLE contacts ADD CONSTRAINT contacts_id_org_unique UNIQUE(id, organization_id);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  contact_id uuid,
  channel text NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP','SMS','WEB_CHAT','SOCIAL','MANUAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAUSED','CLOSED')),
  control_mode text NOT NULL DEFAULT 'HUMAN' CHECK (control_mode IN ('HUMAN','AI_DRAFT','AI_AUTOMATIC')),
  needs_human boolean NOT NULL DEFAULT true,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  summary text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(contact_id, organization_id) REFERENCES contacts(id, organization_id)
);
CREATE INDEX conversations_priority ON conversations(organization_id,needs_human DESC,last_message_at DESC);

CREATE TABLE conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND','INTERNAL')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  provider text,
  provider_message_id text,
  raw_reference text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(conversation_id, organization_id) REFERENCES conversations(id, organization_id),
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id)
);
CREATE UNIQUE INDEX conversation_provider_dedupe ON conversation_messages(organization_id,provider,provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TRIGGER conversation_messages_immutable BEFORE UPDATE OR DELETE ON conversation_messages FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE TABLE intent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  intent text NOT NULL,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  classifier_version text NOT NULL,
  needs_human boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(conversation_id, organization_id) REFERENCES conversations(id, organization_id),
  FOREIGN KEY(message_id, organization_id) REFERENCES conversation_messages(id, organization_id)
);
CREATE TRIGGER intent_events_immutable BEFORE UPDATE OR DELETE ON intent_events FOR EACH ROW EXECUTE FUNCTION prevent_history_change();

CREATE TABLE outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  conversation_id uuid,
  campaign_id uuid,
  channel text NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP','SMS')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','AWAITING_APPROVAL','APPROVED','QUEUED','SENDING','SENT','DELIVERED','READ','REPLIED','FAILED','BOUNCED','CANCELLED','OPTED_OUT','BLOCKED_PROVIDER')),
  source_kind text NOT NULL CHECK (source_kind IN ('HUMAN','AI_DRAFT')),
  approved_by uuid,
  approved_at timestamptz,
  provider text,
  provider_message_id text,
  failure_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, organization_id),
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id),
  FOREIGN KEY(contact_id, organization_id) REFERENCES contacts(id, organization_id),
  FOREIGN KEY(conversation_id, organization_id) REFERENCES conversations(id, organization_id),
  FOREIGN KEY(campaign_id, organization_id) REFERENCES campaigns(id, organization_id),
  FOREIGN KEY(approved_by, organization_id) REFERENCES users(id, organization_id),
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id)
);
CREATE INDEX outbound_queue ON outbound_messages(organization_id,status,created_at);

CREATE TABLE delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  outbound_message_id uuid NOT NULL,
  adapter text NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  result text NOT NULL CHECK (result IN ('SIMULATED','SENT','FAILED','BLOCKED')),
  provider_reference text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outbound_message_id,attempt),
  FOREIGN KEY(outbound_message_id, organization_id) REFERENCES outbound_messages(id, organization_id)
);
CREATE TRIGGER delivery_attempts_immutable BEFORE UPDATE OR DELETE ON delivery_attempts FOR EACH ROW EXECUTE FUNCTION prevent_history_change();
