# ALLEGRO-SC

Cyclical Allegro price & offer monitor. Scrapes shops and keyword listings on a
schedule (Mon/Wed/Fri/Sun), stores every run immutably, and compares consecutive
runs to surface **price changes, new offers, removed offers, and position shifts**
(e.g. Wednesday vs Monday).

## Architecture (hybrid: GitHub + Cloudflare)

- **GitHub Actions** — the execution engine. A scheduled workflow runs the
  Python/Playwright scraper, which pulls its work list from the Worker and pushes
  results back.
- **Cloudflare Worker + D1** — the backend. Validates and stores scraped data,
  serves the dashboard, and computes run-to-run diffs. The Worker never scrapes.
- **Cloudflare Pages** — the dashboard (price history charts, target management).

The scraper and dashboard never touch the database directly; everything goes
through the Worker API. The JSON ingest contract is the single seam between the
two halves.

```
GitHub Actions (Playwright)  ──POST /ingest──▶  Cloudflare Worker  ──▶  D1
        ▲                                              │
        └──────────────── GET /targets ───────────────┘
                                                       │
Cloudflare Pages (dashboard)  ◀── GET /offers, /diff ──┘
```

## Repository layout

| Path | Contents | Status |
|------|----------|--------|
| `worker/` | Cloudflare Worker API + D1 schema/migrations | ✅ Stage 1 — implemented |
| `dashboard/` | Cloudflare Pages frontend | ⏳ Stage 2 |
| `scraper/` | Python + Playwright scraper | ⏳ Stage 3 |
| `.github/workflows/` | Scheduled scrape workflow | ⏳ Stage 3 |

See [`worker/README.md`](worker/README.md) for the API, data model, and setup.

## Build order

1. **Backend first** (done): D1 schema + Worker with `/ingest`, `/targets`,
   `/offers`, `/diff` and bearer-token auth. The stable, testable seam — the
   dashboard and scraper develop against it.
2. **Dashboard**: read from the Worker, chart price/position history, manage targets.
3. **Scraper + Actions**: Playwright targeting the live `/ingest`, on a
   `0 6 * * 1,3,5,0` cron (Mon/Wed/Fri/Sun, 06:00).
