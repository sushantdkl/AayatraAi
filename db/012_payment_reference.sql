ALTER TABLE payment_requests ADD COLUMN verification_reference text;
WITH legacy AS (
  UPDATE payment_requests SET status='SUBMITTED_FOR_VERIFICATION',updated_at=now()
  WHERE status='VERIFIED' AND verification_reference IS NULL
  RETURNING id,organization_id
)
INSERT INTO payment_events(organization_id,payment_request_id,event_type,detail)
SELECT organization_id,id,'LEGACY_REFERENCE_REVIEW_REQUIRED',
       '{"reason":"Verified payment predates unique reference requirement; reverify against external evidence"}'::jsonb
FROM legacy;
CREATE UNIQUE INDEX payment_verified_reference_unique ON payment_requests(organization_id,verification_reference) WHERE verification_reference IS NOT NULL;
ALTER TABLE payment_requests ADD CONSTRAINT payment_verified_reference_required
  CHECK (status <> 'VERIFIED' OR verification_reference IS NOT NULL);
