import type { PoolClient } from "pg";
import { nextTemperature, stopsFollowUp, type Temperature } from "@/lib/sales-temperature";

/**
 * Records a lead temperature change with an append-only event.
 * Message-driven signals go through nextTemperature (forward-only); system events
 * (quote sent, deal won) are authoritative and set directly.
 */
export async function recordTemperature(client: PoolClient, input: {
  organizationId: string; leadId: string; signalled: Temperature | null; cause: string;
  messageId?: string | null; actorId?: string | null; systemEvent?: boolean;
}): Promise<Temperature | null> {
  const lead = await client.query<{ sales_temperature: Temperature }>("SELECT sales_temperature FROM leads WHERE id=$1 AND organization_id=$2 FOR UPDATE", [input.leadId, input.organizationId]);
  const current = lead.rows[0]?.sales_temperature;
  if (!current || !input.signalled) return current ?? null;
  const next = input.systemEvent
    ? (current === "CLOSED_WON" ? current : input.signalled)
    : nextTemperature(current, input.signalled);
  if (next === current) return current;
  const stop = stopsFollowUp(next);
  await client.query(
    `UPDATE leads SET sales_temperature=$3,temperature_updated_at=now(),follow_up_stopped=CASE WHEN $4 THEN true WHEN $5 THEN false ELSE follow_up_stopped END,
       follow_up_stop_reason=CASE WHEN $4 THEN $6 WHEN $5 THEN NULL ELSE follow_up_stop_reason END,updated_at=now()
     WHERE id=$1 AND organization_id=$2`,
    [input.leadId, input.organizationId, next, stop, current === "NOT_INTERESTED" && !stop, `Temperature ${next}: ${input.cause}`],
  );
  await client.query(
    "INSERT INTO lead_temperature_events(organization_id,lead_id,from_temperature,to_temperature,cause,message_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [input.organizationId, input.leadId, current, next, input.cause, input.messageId ?? null, input.actorId ?? null],
  );
  if (stop) await client.query("UPDATE follow_up_tasks SET status='CANCELLED',updated_at=now() WHERE organization_id=$1 AND lead_id=$2 AND status='PENDING'", [input.organizationId, input.leadId]);
  return next;
}
