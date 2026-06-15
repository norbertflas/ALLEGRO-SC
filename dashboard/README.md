# ALLEGRO-SC Dashboard

Static single-page dashboard (Cloudflare Pages). No build step — plain HTML/CSS/JS
plus Chart.js from a CDN. It reads everything from the Worker API.

## Features

- **Targets** — list, add, and enable/disable shops and keywords.
- **Diff** — compare the two most recent runs for a target: price changes, new
  offers, removed offers, position shifts.
- **Price history** — line chart of an offer's price over time by `offer_id`.

## Auth (MVP)

The dashboard is a public static site, so it can't hold a server secret. For the
MVP you enter the Worker URL and `INGEST_TOKEN` once; they're kept in
`localStorage` and sent as a bearer token. This is fine for a single operator.

When the dashboard needs to be shared, split auth on the Worker side — a separate
read-only key or Cloudflare Access in front of the read routes — instead of
shipping the ingest token to browsers.

## Local preview

```bash
cd dashboard
python3 -m http.server 8080   # then open http://localhost:8080
```

Enter your Worker URL (e.g. `https://allegro-sc-worker.workers.dev`) and token.

## Deploy (Cloudflare Pages)

```bash
npx wrangler pages deploy dashboard --project-name allegro-sc-dashboard
```

The Worker already returns permissive CORS headers, so the Pages origin can call
it directly.
