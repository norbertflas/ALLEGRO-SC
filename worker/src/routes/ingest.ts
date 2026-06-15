import { error, json } from "../http";
import type { Env, IngestBatch, Offer } from "../types";

export async function handleIngest(request: Request, env: Env): Promise<Response> {
  let body: IngestBatch;
  try {
    body = (await request.json()) as IngestBatch;
  } catch {
    return error("invalid JSON body");
  }

  const problem = validateBatch(body);
  if (problem) return error(problem);

  const scrapedAt = body.scraped_at;

  // Upsert the run by its scraper-supplied uid, then read back the numeric id.
  await env.DB.prepare(
    `INSERT INTO scrape_runs (run_uid, started_at, finished_at, status, offers_count)
     VALUES (?1, ?2, ?2, 'completed', ?3)
     ON CONFLICT(run_uid) DO UPDATE SET
       finished_at  = excluded.finished_at,
       status       = 'completed',
       offers_count = scrape_runs.offers_count + excluded.offers_count`,
  )
    .bind(body.run_id, scrapedAt, body.offers.length)
    .run();

  const run = await env.DB.prepare(`SELECT id FROM scrape_runs WHERE run_uid = ?1`)
    .bind(body.run_id)
    .first<{ id: number }>();
  if (!run) return error("failed to register scrape run", 500);

  const historyStmt = env.DB.prepare(
    `INSERT INTO offers_history
       (run_id, offer_id, title, price, is_smart, seller_name, source_type, source_value, position, scraped_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  );
  const currentStmt = env.DB.prepare(
    `INSERT INTO offers_current
       (offer_id, title, price, is_smart, seller_name, source_type, source_value, position, last_run_id, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT(offer_id) DO UPDATE SET
       title=excluded.title, price=excluded.price, is_smart=excluded.is_smart,
       seller_name=excluded.seller_name, source_type=excluded.source_type,
       source_value=excluded.source_value, position=excluded.position,
       last_run_id=excluded.last_run_id, updated_at=excluded.updated_at`,
  );

  const statements: D1PreparedStatement[] = [];
  for (const o of body.offers) {
    const smart = o.is_smart ? 1 : 0;
    const seller = o.seller_name ?? null;
    const position = o.position ?? null;
    statements.push(
      historyStmt.bind(
        run.id, o.offer_id, o.title, o.price, smart, seller,
        o.source_type, o.source_value, position, scrapedAt,
      ),
      currentStmt.bind(
        o.offer_id, o.title, o.price, smart, seller,
        o.source_type, o.source_value, position, run.id, scrapedAt,
      ),
    );
  }

  if (statements.length) await env.DB.batch(statements);

  return json({ run_id: body.run_id, run_db_id: run.id, ingested: body.offers.length });
}

function validateBatch(body: IngestBatch): string | null {
  if (!body || typeof body !== "object") return "body must be an object";
  if (typeof body.run_id !== "string" || !body.run_id) return "run_id is required";
  if (typeof body.scraped_at !== "string" || !body.scraped_at) return "scraped_at is required";
  if (!Array.isArray(body.offers)) return "offers must be an array";
  for (let i = 0; i < body.offers.length; i++) {
    const problem = validateOffer(body.offers[i], i);
    if (problem) return problem;
  }
  return null;
}

function validateOffer(o: Offer, i: number): string | null {
  const at = `offers[${i}]`;
  if (!o || typeof o !== "object") return `${at} must be an object`;
  if (typeof o.offer_id !== "string" || !o.offer_id) return `${at}.offer_id is required`;
  if (typeof o.title !== "string" || !o.title) return `${at}.title is required`;
  if (typeof o.price !== "number" || !Number.isFinite(o.price)) return `${at}.price must be a number`;
  if (o.source_type !== "shop" && o.source_type !== "keyword")
    return `${at}.source_type must be 'shop' or 'keyword'`;
  if (typeof o.source_value !== "string" || !o.source_value) return `${at}.source_value is required`;
  return null;
}
