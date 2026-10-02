CREATE TABLE commercial_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  item_id uuid NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  source_reference text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolution_evidence text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id,code),
  FOREIGN KEY(item_id,organization_id) REFERENCES commercial_items(id,organization_id),
  FOREIGN KEY(resolved_by,organization_id) REFERENCES users(id,organization_id),
  CHECK (status <> 'RESOLVED' OR (resolution_evidence IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);

INSERT INTO commercial_discrepancies(organization_id,item_id,code,description,source_reference)
SELECT organization_id,id,'CLIENT_KIT_ENTERPRISE_YEARLY',
  'Marketing draft says NPR 40,000/year; client-kit quotation says from NPR 50,000/year. Neither is an approved exact client price.',
  '01_Aadhar_POS_Quotation_Template.docx'
FROM commercial_items WHERE source='Aayatra continuation prompt marketing snapshot 2026-10-01' AND product_family='RESTAURANT_SYSTEM' AND name='Enterprise yearly'
ON CONFLICT(item_id,code) DO NOTHING;

INSERT INTO commercial_discrepancies(organization_id,item_id,code,description,source_reference)
SELECT organization_id,id,'CLIENT_KIT_THERMAL_PRINTER',
  'Marketing draft says NPR 14,000; client kit indicates NPR 8,000–10,000 for an unspecified thermal receipt printer. Confirm model, supplier and final quote.',
  '01_Aadhar_POS_Quotation_Template.docx'
FROM commercial_items WHERE source='Aayatra continuation prompt marketing snapshot 2026-10-01' AND product_family='RETAIL_ERP' AND name='Thermal printer'
ON CONFLICT(item_id,code) DO NOTHING;

UPDATE commercial_items SET notes='COMMERCIAL_PRICE_REVIEW_REQUIRED: client kit says from NPR 50,000/year; this is an unverified marketing draft'
WHERE source='Aayatra continuation prompt marketing snapshot 2026-10-01' AND product_family='RESTAURANT_SYSTEM' AND name='Enterprise yearly';
UPDATE commercial_items SET notes='COMMERCIAL_PRICE_REVIEW_REQUIRED: kit indicates NPR 8,000–10,000 for an unspecified thermal receipt printer; confirm exact model, tax and warranty'
WHERE source='Aayatra continuation prompt marketing snapshot 2026-10-01' AND product_family='RETAIL_ERP' AND name='Thermal printer';
