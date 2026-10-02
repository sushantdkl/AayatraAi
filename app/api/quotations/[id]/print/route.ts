import { z } from "zod";
import { one } from "@/lib/db";
import { escapeHtml as e } from "@/lib/html";
import { ApiError, jsonError, requireActor } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
type Line = { name: string; quantity: number; unitPriceMinor: number; totalMinor: number };
type Printable = { quotation_number: string; status: string; version: number; client_name: string; business_type: string; issued_at: string; valid_until: string; line_items: Line[]; subtotal_minor: string; discount_minor: string; tax_minor: string; total_minor: string; currency: string; scope: string; exclusions: string; commercial_notes: string | null; payment_terms: string | null };
const money = (minor: string | number) => new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(minor) / 100);

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const quote = await one<Printable>(
      `SELECT q.quotation_number,q.status,v.version,v.client_name,v.business_type,v.issued_at,v.valid_until,v.line_items,
              v.subtotal_minor,v.discount_minor,v.tax_minor,v.total_minor,v.currency,v.scope,v.exclusions,v.commercial_notes,v.payment_terms
       FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id AND v.organization_id=q.organization_id AND v.version=q.current_version
       WHERE q.id=$1 AND q.organization_id=$2`, [id,actor.organization_id],
    );
    if (!quote) throw new ApiError(404, "Quotation not found");
    const lines = quote.line_items.map((line) => `<tr><td>${e(line.name)}</td><td>${e(line.quantity)}</td><td>${e(money(line.unitPriceMinor))}</td><td>${e(money(line.totalMinor))}</td></tr>`).join("");
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(quote.quotation_number)} · Aayatra</title><style>
      body{font:14px/1.5 system-ui,sans-serif;color:#142724;max-width:820px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #152b27;padding-bottom:22px}h1{font-size:26px;margin:0}h2{font-size:15px;margin:28px 0 8px}.muted{color:#4f625b}.status{display:inline-block;padding:5px 8px;border:1px solid #d6e1d9;border-radius:4px;text-transform:uppercase;font-size:11px}table{width:100%;border-collapse:collapse;margin:25px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e4eae6}th:last-child,td:last-child{text-align:right}.totals{margin-left:auto;width:290px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:700;border-top:2px solid #152b27;padding-top:10px}.block{white-space:pre-wrap}.note{background:#f5f7f4;padding:14px;border-radius:5px}footer{margin-top:50px;border-top:1px solid #e4eae6;padding-top:12px;font-size:11px;color:#4f625b}@media print{body{margin:0;max-width:none}button{display:none}}@media(max-width:600px){header{display:block}.totals{width:100%}table{font-size:11px}}</style></head><body>
      <header><div><strong>Aayatra Enterprises</strong><h1>Quotation</h1><span class="muted">${e(quote.quotation_number)} · Version ${e(quote.version)}</span></div><div><span class="status">${e(quote.status.replaceAll("_"," "))}</span><p>Issued: ${e(String(quote.issued_at).slice(0,10))}<br>Valid until: ${e(String(quote.valid_until).slice(0,10))}</p></div></header>
      <h2>Prepared for</h2><p>${e(quote.client_name)}<br><span class="muted">${e(quote.business_type)}</span></p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="totals"><div><span>Subtotal</span><strong>${e(money(quote.subtotal_minor))}</strong></div><div><span>Discount</span><span>${e(money(quote.discount_minor))}</span></div><div><span>Tax (configured)</span><span>${e(money(quote.tax_minor))}</span></div><div class="grand"><span>Total</span><span>${e(money(quote.total_minor))}</span></div></div>
      <h2>Scope</h2><p class="block">${e(quote.scope)}</p><h2>Exclusions</h2><p class="block">${e(quote.exclusions)}</p>
      ${quote.payment_terms ? `<h2>Payment terms</h2><p class="block">${e(quote.payment_terms)}</p>` : ""}
      ${quote.commercial_notes ? `<h2>Commercial notes</h2><p class="block">${e(quote.commercial_notes)}</p>` : ""}
      <footer>This document reflects recorded commercial data only. Verify signed terms, tax treatment, and final acceptance separately.</footer></body></html>`;
    return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  } catch (error) { return jsonError(error); }
}
