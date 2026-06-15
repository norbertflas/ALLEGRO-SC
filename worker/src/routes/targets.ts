import { error, json } from "../http";
import type { Env, SourceType } from "../types";

interface TargetInput {
  target_type?: SourceType;
  target_value?: string;
  is_active?: boolean;
}

/** GET /targets — list targets. ?active=1 limits to active ones (used by the scraper). */
export async function listTargets(url: URL, env: Env): Promise<Response> {
  const activeOnly = url.searchParams.get("active") === "1";
  const sql = activeOnly
    ? `SELECT id, target_type, target_value, is_active, created_at
         FROM scraper_targets WHERE is_active = 1 ORDER BY target_type, target_value`
    : `SELECT id, target_type, target_value, is_active, created_at
         FROM scraper_targets ORDER BY target_type, target_value`;
  const { results } = await env.DB.prepare(sql).all();
  return json({ targets: results });
}

/** POST /targets — create a target. */
export async function createTarget(request: Request, env: Env): Promise<Response> {
  let body: TargetInput;
  try {
    body = (await request.json()) as TargetInput;
  } catch {
    return error("invalid JSON body");
  }
  if (body.target_type !== "shop" && body.target_type !== "keyword")
    return error("target_type must be 'shop' or 'keyword'");
  if (typeof body.target_value !== "string" || !body.target_value.trim())
    return error("target_value is required");

  const active = body.is_active === false ? 0 : 1;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO scraper_targets (target_type, target_value, is_active)
       VALUES (?1, ?2, ?3)
       RETURNING id, target_type, target_value, is_active, created_at`,
    )
      .bind(body.target_type, body.target_value.trim(), active)
      .first();
    return json({ target: row }, 201);
  } catch (e) {
    if (String(e).includes("UNIQUE")) return error("target already exists", 409);
    throw e;
  }
}

/** PATCH /targets/:id — update value and/or active flag. */
export async function updateTarget(id: number, request: Request, env: Env): Promise<Response> {
  let body: TargetInput;
  try {
    body = (await request.json()) as TargetInput;
  } catch {
    return error("invalid JSON body");
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.target_value === "string" && body.target_value.trim()) {
    sets.push(`target_value = ?`);
    binds.push(body.target_value.trim());
  }
  if (typeof body.is_active === "boolean") {
    sets.push(`is_active = ?`);
    binds.push(body.is_active ? 1 : 0);
  }
  if (!sets.length) return error("nothing to update");

  binds.push(id);
  const row = await env.DB.prepare(
    `UPDATE scraper_targets SET ${sets.join(", ")} WHERE id = ?
     RETURNING id, target_type, target_value, is_active, created_at`,
  )
    .bind(...binds)
    .first();
  if (!row) return error("target not found", 404);
  return json({ target: row });
}
