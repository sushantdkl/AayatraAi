ALTER TABLE users ADD CONSTRAINT users_id_org_unique UNIQUE(id, organization_id);
ALTER TABLE businesses ADD CONSTRAINT businesses_id_org_unique UNIQUE(id, organization_id);
ALTER TABLE source_records ADD CONSTRAINT sources_id_org_unique UNIQUE(id, organization_id);
ALTER TABLE leads ADD CONSTRAINT leads_id_org_unique UNIQUE(id, organization_id);
ALTER TABLE opportunities ADD CONSTRAINT opportunities_id_org_unique UNIQUE(id, organization_id);

ALTER TABLE source_records ADD CONSTRAINT sources_business_tenant_fk
  FOREIGN KEY(business_id, organization_id) REFERENCES businesses(id, organization_id);
ALTER TABLE source_records ADD CONSTRAINT sources_creator_tenant_fk
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_business_tenant_fk
  FOREIGN KEY(business_id, organization_id) REFERENCES businesses(id, organization_id);
ALTER TABLE leads ADD CONSTRAINT leads_business_tenant_fk
  FOREIGN KEY(business_id, organization_id) REFERENCES businesses(id, organization_id);
ALTER TABLE leads ADD CONSTRAINT leads_source_tenant_fk
  FOREIGN KEY(source_record_id, organization_id) REFERENCES source_records(id, organization_id);
ALTER TABLE leads ADD CONSTRAINT leads_assignee_tenant_fk
  FOREIGN KEY(assigned_to, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE opportunities ADD CONSTRAINT opportunities_lead_tenant_fk
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id);
ALTER TABLE opportunities ADD CONSTRAINT opportunities_owner_tenant_fk
  FOREIGN KEY(owner_id, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE stage_history ADD CONSTRAINT stage_history_opportunity_tenant_fk
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id);
ALTER TABLE stage_history ADD CONSTRAINT stage_history_actor_tenant_fk
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE activities ADD CONSTRAINT activities_lead_tenant_fk
  FOREIGN KEY(lead_id, organization_id) REFERENCES leads(id, organization_id);
ALTER TABLE activities ADD CONSTRAINT activities_opportunity_tenant_fk
  FOREIGN KEY(opportunity_id, organization_id) REFERENCES opportunities(id, organization_id);
ALTER TABLE activities ADD CONSTRAINT activities_actor_tenant_fk
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE product_capabilities ADD CONSTRAINT capabilities_approver_tenant_fk
  FOREIGN KEY(approved_by, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE do_not_contact ADD CONSTRAINT dnc_creator_tenant_fk
  FOREIGN KEY(created_by, organization_id) REFERENCES users(id, organization_id);
ALTER TABLE audit_events ADD CONSTRAINT audit_actor_tenant_fk
  FOREIGN KEY(actor_id, organization_id) REFERENCES users(id, organization_id);
