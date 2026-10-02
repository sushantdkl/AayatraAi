import type { PoolClient } from "pg";
import { publicDemoUrl } from "@/lib/automation-schemas";
import { featureDefinitions, salesPolicy } from "@/lib/feature-matrix";
import {
  assistedAutomation, companyIdentity, demoUrlSettings, discountPolicy, LEGACY_SNAPSHOT_SOURCE,
  OWNER_CONFIG_REFERENCE, POSTER_SOURCE, posterCatalogue, rupeesToMinor,
} from "@/lib/owner-config";

export type ApplyResult = {
  companyProfile: "CREATED" | "KEPT";
  policy: "APPROVED_PAN_ONLY" | "KEPT";
  catalogueCreated: number;
  legacySuperseded: number;
  featuresSeeded: number;
  demoTargetsSeeded: number;
  automationAssisted: number;
};

/**
 * Applies the owner-approved addendum idempotently. Re-running it never overwrites values an
 * administrator has since entered (PAN, address, later price changes, feature verification).
 * Old draft prices are kept and marked SUPERSEDED, never deleted.
 */
export async function applyOwnerConfig(client: PoolClient, organizationId: string, actorId: string, env: Record<string, string | undefined> = process.env): Promise<ApplyResult> {
  const result: ApplyResult = { companyProfile: "KEPT", policy: "KEPT", catalogueCreated: 0, legacySuperseded: 0, featuresSeeded: 0, demoTargetsSeeded: 0, automationAssisted: 0 };

  const profile = await client.query(
    `INSERT INTO company_profiles(organization_id,legal_or_trading_name,brand,city,country,primary_whatsapp,tax_status,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id) DO NOTHING RETURNING organization_id`,
    [organizationId, companyIdentity.legalOrTradingName, companyIdentity.brand, companyIdentity.city, companyIdentity.country, companyIdentity.primaryWhatsapp, companyIdentity.taxStatus, actorId],
  );
  if (profile.rowCount) result.companyProfile = "CREATED";

  await client.query(
    `INSERT INTO sales_settings(organization_id,primary_sales_phone,whatsapp_number,updated_by) VALUES($1,$2,$2,$3)
     ON CONFLICT(organization_id) DO UPDATE SET primary_sales_phone=COALESCE(sales_settings.primary_sales_phone,EXCLUDED.primary_sales_phone),
       whatsapp_number=COALESCE(sales_settings.whatsapp_number,EXCLUDED.whatsapp_number)`,
    [organizationId, companyIdentity.primaryWhatsapp, actorId],
  );
  await client.query(
    "INSERT INTO whatsapp_channel_settings(organization_id,display_phone,updated_by) VALUES($1,$2,$3) ON CONFLICT(organization_id) DO NOTHING",
    [organizationId, companyIdentity.primaryWhatsapp, actorId],
  );

  const policy = await client.query<{ status: string; tax_mode: string }>("SELECT status,tax_mode FROM commercial_policies WHERE organization_id=$1 FOR UPDATE", [organizationId]);
  if (!(policy.rows[0]?.status === "APPROVED" && policy.rows[0].tax_mode === "PAN_ONLY")) {
    await client.query(
      `INSERT INTO commercial_policies(organization_id,status,version,tax_mode,tax_rate_bps,tax_label,max_manual_discount_bps,max_auto_discount_bps,default_discount_bps,price_negotiable,max_negotiation_rounds,evidence_reference,approved_by,approved_at,updated_by)
       VALUES($1,'APPROVED',1,'PAN_ONLY',0,'VAT not separately charged (PAN-only)',$2,$3,$4,$5,3,$6,$7,now(),$7)
       ON CONFLICT(organization_id) DO UPDATE SET status='APPROVED',version=commercial_policies.version+1,tax_mode='PAN_ONLY',tax_rate_bps=0,
         tax_label=EXCLUDED.tax_label,max_manual_discount_bps=$2,max_auto_discount_bps=$3,default_discount_bps=$4,price_negotiable=$5,
         max_negotiation_rounds=GREATEST(commercial_policies.max_negotiation_rounds,3),evidence_reference=$6,approved_by=$7,approved_at=now(),updated_by=$7,updated_at=now()`,
      [organizationId, discountPolicy.managerDiscountLimitBps, discountPolicy.autoDiscountLimitBps, discountPolicy.defaultDiscountBps, discountPolicy.priceNegotiable, OWNER_CONFIG_REFERENCE, actorId],
    );
    result.policy = "APPROVED_PAN_ONLY";
  }

  for (const item of posterCatalogue) {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM commercial_items WHERE organization_id=$1 AND sku=$2 AND catalog_status IN ('DRAFT','VERIFIED','ACTIVE')",
      [organizationId, item.sku],
    );
    let id = existing.rows[0]?.id;
    if (!id) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO commercial_items(organization_id,product_family,kind,name,billing_type,billing_period,currency,catalog_status,verification_status,is_active,
           approval_required,negotiable,source,notes,verified_by,verified_at,verification_evidence,sku,package_code,commercial_source,effective_from)
         VALUES($1,$2,$3,$4,$5,$6,'NPR','ACTIVE','VERIFIED',true,false,true,$7,$8,$9,now(),$10,$11,$12,$7,CURRENT_DATE) RETURNING id`,
        [organizationId, item.productFamily, item.kind, item.name, item.billingType, item.billingPeriod, POSTER_SOURCE,
          "Owner-approved canonical poster price. Price is final for now; feature inclusions remain subject to code verification.",
          actorId, OWNER_CONFIG_REFERENCE, item.sku, item.packageCode],
      );
      id = created.rows[0].id;
      await client.query(
        `INSERT INTO commercial_price_sources(organization_id,item_id,price_minor,source_name,evidence_reference,is_canonical,active)
         VALUES($1,$2,$3,$4,$5,true,true)`,
        [organizationId, id, rupeesToMinor(item.rupees), POSTER_SOURCE, OWNER_CONFIG_REFERENCE],
      );
      result.catalogueCreated++;
    }
    if (item.supersedes) {
      const legacy = await client.query<{ id: string }>(
        `UPDATE commercial_items SET catalog_status='SUPERSEDED',is_active=false,superseded_by=$4,updated_at=now(),
           notes=coalesce(notes,'') || ' | SUPERSEDED by ' || $5 || ' (' || $6 || ')'
         WHERE organization_id=$1 AND source=$2 AND name=$3 AND catalog_status NOT IN ('SUPERSEDED') RETURNING id`,
        [organizationId, LEGACY_SNAPSHOT_SOURCE, item.supersedes, id, POSTER_SOURCE, OWNER_CONFIG_REFERENCE],
      );
      for (const row of legacy.rows) {
        await client.query(
          `UPDATE commercial_discrepancies SET status='RESOLVED',resolution_evidence=$3,resolved_by=$4,resolved_at=now()
           WHERE organization_id=$1 AND item_id=$2 AND status='OPEN'`,
          [organizationId, row.id, `${OWNER_CONFIG_REFERENCE}: ${POSTER_SOURCE} is canonical; older draft retained for audit`, actorId],
        );
        result.legacySuperseded++;
      }
    }
  }

  for (const feature of featureDefinitions) {
    const commercial = feature.seedCommercial ?? salesPolicy[feature.seedStatus].defaultCommercial;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO product_features(organization_id,product_family,feature_key,name,implementation_status,commercial_status,evidence,limitations,keywords)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(organization_id,product_family,feature_key) DO NOTHING RETURNING id`,
      [organizationId, feature.productFamily, feature.key, feature.name, feature.seedStatus, commercial, feature.seedEvidence, feature.limitations ?? null, feature.keywords],
    );
    if (inserted.rows[0]) {
      await client.query(
        "INSERT INTO product_feature_history(organization_id,feature_id,implementation_status,commercial_status,evidence,actor_id) VALUES($1,$2,$3,$4,$5,$6)",
        [organizationId, inserted.rows[0].id, feature.seedStatus, commercial, feature.seedEvidence, actorId],
      );
      result.featuresSeeded++;
    }
  }

  for (const demo of demoUrlSettings) {
    const has = await client.query("SELECT 1 FROM demo_targets WHERE organization_id=$1 AND product_family=$2 LIMIT 1", [organizationId, demo.productFamily]);
    if (has.rowCount) continue;
    const raw = env[demo.env]?.trim() || null;
    const url = raw && publicDemoUrl.safeParse(raw).success ? raw : null;
    await client.query(
      "INSERT INTO demo_targets(organization_id,product_family,name,base_url,environment,status) VALUES($1,$2,$3,$4,'DEMO',$5)",
      [organizationId, demo.productFamily, demo.name, url, url ? "PENDING_REVIEW" : "WAITING_FOR_DEMO_URL"],
    );
    result.demoTargetsSeeded++;
  }

  for (const feature of assistedAutomation) {
    const changed = await client.query(
      `INSERT INTO automation_controls(organization_id,feature,mode,updated_by) VALUES($1,$2,'ASSISTED',$3)
       ON CONFLICT(organization_id,feature) DO UPDATE SET mode='ASSISTED',updated_by=$3,updated_at=now() WHERE automation_controls.mode='OFF' RETURNING feature`,
      [organizationId, feature, actorId],
    );
    result.automationAssisted += changed.rowCount ?? 0;
  }

  await client.query(
    `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason)
     VALUES($1,$2,'OWNER_CONFIG_APPLIED','organization',$1,$3,$4)`,
    [organizationId, actorId, JSON.stringify(result), OWNER_CONFIG_REFERENCE],
  );
  return result;
}
