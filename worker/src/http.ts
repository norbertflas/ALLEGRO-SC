const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}
