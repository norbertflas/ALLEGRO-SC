import type { Env } from "./types";

/**
 * Bearer-token check. The same INGEST_TOKEN gates every route for the MVP
 * (only the scraper and the operator call the API). When the public dashboard
 * lands in stage 2 we can split this into a separate read key or Cloudflare Access.
 */
export function isAuthorized(request: Request, env: Env): boolean {
  if (!env.INGEST_TOKEN) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return timingSafeEqual(match[1], env.INGEST_TOKEN);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
