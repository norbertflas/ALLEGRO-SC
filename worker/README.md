# ALLEGRO-SC Worker

Cloudflare Worker API + D1 backend for the Allegro price/offer monitor.

It is the seam between the two halves of the system: the GitHub Actions scraper
pushes data in, and the dashboard reads data out. The Worker never scrapes — it
only validates, stores, and serves.

## Data model (D1)

| Table | Role |
|-------|------|
| `scraper_targets` | What to scrape — shops and keywords. Managed from the dashboard. |
| `scrape_runs` | One row per cyclical scrape. The anchor for "Wednesday vs Monday" comparisons. |
| `offers_history` | Append-only. Every run inserts fresh rows, so price/position changes stay queryable. |
| `offers_current` | Last-seen state of each offer (UPSERT by `offer_id`). Fast "what did we last see" lookups. |

> Note: `offers_current` holds the latest state of *any* offer ever seen, not
> only offers present in the most recent run for a target. To answer "what is
> live under this keyword right now", use `/diff` (or filter by the latest
> `run_id`). A removed offer still appears in `offers_current` with its old
> `last_run_id` until it is seen again.

## Endpoints

All routes except `GET /` require `Authorization: Bearer <INGEST_TOKEN>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check (unauthenticated). |
| `GET` | `/targets` | List targets. `?active=1` for the scraper's work list. |
| `POST` | `/targets` | Create a target: `{ target_type, target_value, is_active? }`. |
| `PATCH` | `/targets/:id` | Update `target_value` and/or `is_active`. |
| `POST` | `/ingest` | Scraper pushes a batch (see contract below). |
| `GET` | `/offers?offer_id=X` | Price/position history of one offer over time. |
| `GET` | `/offers?target_type=&target_value=` | Last-seen offers for a target. |
| `GET` | `/offers` | Paginated current offers (`?limit=&offset=`). |
| `GET` | `/diff?target_type=&target_value=[&from=&to=]` | Compare two runs. Defaults to the two most recent runs for the target. |

### Ingest contract

```json
{
  "run_id": "run-2026-06-15",
  "scraped_at": "2026-06-15T06:00:00Z",
  "offers": [
    {
      "offer_id": "1234567890",
      "title": "Filament PETG 1kg",
      "price": 59.99,
      "is_smart": true,
      "seller_name": "SuperSprzedawca_pl",
      "source_type": "keyword",
      "source_value": "filament petg",
      "position": 1
    }
  ]
}
```

`offer_id`, `title`, `price`, `source_type`, and `source_value` are required;
the rest are optional. `/ingest` is idempotent on `run_id` for run bookkeeping
(repeated calls append offers and keep the run marked completed).

### Diff response

```json
{
  "from_run": "run-mon",
  "to_run": "run-wed",
  "summary": { "price_changes": 1, "new_offers": 1, "removed_offers": 1, "position_changes": 2 },
  "price_changes": [{ "offer_id": "A1", "old_price": 59.99, "new_price": 54.99, "delta": -5 }],
  "new_offers": [...],
  "removed_offers": [...],
  "position_changes": [...]
}
```

## Setup

```bash
cd worker
npm install

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create allegro-sc

# 2. Apply the schema
npm run migrate:remote      # or migrate:local for local dev

# 3. Set the shared secret used by the scraper and dashboard
npx wrangler secret put INGEST_TOKEN

# 4. Deploy
npm run deploy
```

### Local development

```bash
echo 'INGEST_TOKEN="dev-token"' > .dev.vars   # gitignored
npm run migrate:local
npm run dev
```

## Status

Stage 1 (backend) of the project plan. Next: dashboard (Cloudflare Pages),
then the Python/Playwright scraper + GitHub Actions schedule
(`0 6 * * 1,3,5,0` — Mon/Wed/Fri/Sun at 06:00).
