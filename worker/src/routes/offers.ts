import { error, json } from "../http";
import type { Env } from "../types";

/**
 * GET /offers
 *   ?offer_id=X                         → price/position history of one offer over time
 *   ?target_type=&target_value=         → current offers for a target (from offers_current)
 *   (no params)                         → paginated list of current offers (?limit=&offset=)
 */
export async function getOffers(url: URL, env: Env): Promise<Response> {
  const offerId = url.searchParams.get("offer_id");
  if (offerId) {
    const { results } = await env.DB.prepare(
      `SELECT h.run_id, r.run_uid, h.offer_id, h.title, h.price, h.is_smart,
              h.seller_name, h.source_type, h.source_value, h.position, h.scraped_at
         FROM offers_history h
         JOIN scrape_runs r ON r.id = h.run_id
        WHERE h.offer_id = ?1
        ORDER BY h.scraped_at ASC`,
    )
      .bind(offerId)
      .all();
    return json({ offer_id: offerId, history: results });
  }

  const targetType = url.searchParams.get("target_type");
  const targetValue = url.searchParams.get("target_value");
  if (targetType || targetValue) {
    if (!targetType || !targetValue)
      return error("target_type and target_value must be provided together");
    const { results } = await env.DB.prepare(
      `SELECT offer_id, title, price, is_smart, seller_name, source_type,
              source_value, position, last_run_id, updated_at
         FROM offers_current
        WHERE source_type = ?1 AND source_value = ?2
        ORDER BY position ASC NULLS LAST`,
    )
      .bind(targetType, targetValue)
      .all();
    return json({ source_type: targetType, source_value: targetValue, offers: results });
  }

  const limit = clamp(parseInt(url.searchParams.get("limit") ?? "100", 10), 1, 500);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const { results } = await env.DB.prepare(
    `SELECT offer_id, title, price, is_smart, seller_name, source_type,
            source_value, position, last_run_id, updated_at
       FROM offers_current
      ORDER BY updated_at DESC
      LIMIT ?1 OFFSET ?2`,
  )
    .bind(limit, offset)
    .all();
  return json({ limit, offset, offers: results });
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
