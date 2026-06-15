import { error, json } from "../http";
import type { Env } from "../types";

interface HistoryRow {
  offer_id: string;
  title: string;
  price: number;
  position: number | null;
  seller_name: string | null;
}

/**
 * GET /diff?target_type=&target_value=[&from=runUid&to=runUid]
 *
 * Compares two scrape runs for a single target. Defaults to the two most recent
 * runs that touched the target (e.g. Wednesday vs Monday). Returns price changes,
 * offers that appeared, offers that disappeared, and position shifts.
 */
export async function getDiff(url: URL, env: Env): Promise<Response> {
  const targetType = url.searchParams.get("target_type");
  const targetValue = url.searchParams.get("target_value");
  if (!targetType || !targetValue)
    return error("target_type and target_value are required");

  let fromUid = url.searchParams.get("from");
  let toUid = url.searchParams.get("to");

  if (!fromUid || !toUid) {
    const { results } = await env.DB.prepare(
      `SELECT r.run_uid, MIN(r.started_at) AS started_at
         FROM offers_history h
         JOIN scrape_runs r ON r.id = h.run_id
        WHERE h.source_type = ?1 AND h.source_value = ?2
        GROUP BY r.run_uid
        ORDER BY started_at DESC
        LIMIT 2`,
    )
      .bind(targetType, targetValue)
      .all<{ run_uid: string; started_at: string }>();

    if (results.length < 2)
      return error("need at least two runs for this target to compare", 404);
    toUid = toUid ?? results[0].run_uid;
    fromUid = fromUid ?? results[1].run_uid;
  }

  const [fromRows, toRows] = await Promise.all([
    runOffers(env, fromUid, targetType, targetValue),
    runOffers(env, toUid, targetType, targetValue),
  ]);

  const fromMap = new Map(fromRows.map((r) => [r.offer_id, r]));
  const toMap = new Map(toRows.map((r) => [r.offer_id, r]));

  const price_changes = [];
  const position_changes = [];
  const removed_offers = [];

  for (const [offerId, prev] of fromMap) {
    const curr = toMap.get(offerId);
    if (!curr) {
      removed_offers.push({ offer_id: offerId, title: prev.title, price: prev.price });
      continue;
    }
    if (curr.price !== prev.price) {
      price_changes.push({
        offer_id: offerId,
        title: curr.title,
        old_price: prev.price,
        new_price: curr.price,
        delta: round2(curr.price - prev.price),
      });
    }
    if (curr.position !== prev.position) {
      position_changes.push({
        offer_id: offerId,
        title: curr.title,
        old_position: prev.position,
        new_position: curr.position,
      });
    }
  }

  const new_offers = [];
  for (const [offerId, curr] of toMap) {
    if (!fromMap.has(offerId))
      new_offers.push({ offer_id: offerId, title: curr.title, price: curr.price });
  }

  return json({
    target_type: targetType,
    target_value: targetValue,
    from_run: fromUid,
    to_run: toUid,
    summary: {
      price_changes: price_changes.length,
      new_offers: new_offers.length,
      removed_offers: removed_offers.length,
      position_changes: position_changes.length,
    },
    price_changes,
    new_offers,
    removed_offers,
    position_changes,
  });
}

async function runOffers(
  env: Env,
  runUid: string,
  targetType: string,
  targetValue: string,
): Promise<HistoryRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT h.offer_id, h.title, h.price, h.position, h.seller_name
       FROM offers_history h
       JOIN scrape_runs r ON r.id = h.run_id
      WHERE r.run_uid = ?1 AND h.source_type = ?2 AND h.source_value = ?3`,
  )
    .bind(runUid, targetType, targetValue)
    .all<HistoryRow>();
  return results;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
