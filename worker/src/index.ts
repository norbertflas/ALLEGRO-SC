import { isAuthorized } from "./auth";
import { error, json, preflight } from "./http";
import { getDiff } from "./routes/diff";
import { getOffers } from "./routes/offers";
import { handleIngest } from "./routes/ingest";
import { createTarget, listTargets, updateTarget } from "./routes/targets";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return preflight();

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Health check is the only unauthenticated route.
    if (path === "/" && request.method === "GET") {
      return json({ service: "allegro-sc-worker", status: "ok" });
    }

    if (!isAuthorized(request, env)) {
      return error("unauthorized", 401);
    }

    try {
      if (path === "/ingest" && request.method === "POST") {
        return await handleIngest(request, env);
      }

      if (path === "/targets") {
        if (request.method === "GET") return await listTargets(url, env);
        if (request.method === "POST") return await createTarget(request, env);
      }

      const targetMatch = path.match(/^\/targets\/(\d+)$/);
      if (targetMatch && request.method === "PATCH") {
        return await updateTarget(Number(targetMatch[1]), request, env);
      }

      if (path === "/offers" && request.method === "GET") {
        return await getOffers(url, env);
      }

      if (path === "/diff" && request.method === "GET") {
        return await getDiff(url, env);
      }

      return error("not found", 404);
    } catch (e) {
      return error(`internal error: ${e instanceof Error ? e.message : String(e)}`, 500);
    }
  },
};
