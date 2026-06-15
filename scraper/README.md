# ALLEGRO-SC Scraper

Python + Playwright scraper. Pulls its work list from the Worker, scrapes Allegro,
and pushes one batch back to `POST /ingest`. It never touches D1 directly.

> **Run it from your own computer, not GitHub Actions.** Allegro/Akamai blocks
> GitHub's datacenter IPs (every cloud run only gets a challenge page), so the
> scheduled workflow is disabled. From a home IP the block normally doesn't apply.

## ⭐ Uruchomienie z własnego komputera (krok po kroku)

Potrzebujesz: zainstalowanego **Pythona 3.11+** i **git**.

1. Pobierz projekt (jeśli jeszcze nie masz):
   `git clone https://github.com/norbertflas/ALLEGRO-SC.git`
2. Wejdź do folderu scrapera: `cd ALLEGRO-SC/scraper`
3. Skopiuj `.env.example` do `.env` i uzupełnij `WORKER_URL` oraz `INGEST_TOKEN`
   (te same co w dashboardzie).
4. Uruchom:
   - **Windows:** kliknij dwukrotnie `run_local.bat` (lub w terminalu: `run_local.bat`)
   - **Mac / Linux:** `bash run_local.sh`

Skrypt sam stworzy środowisko, doinstaluje zależności i przeglądarkę, po czym
odpali scraper. `HEADLESS=0` w `.env` sprawia, że zobaczysz okno przeglądarki —
gdyby pojawiła się captcha, możesz ją rozwiązać ręcznie. Wyniki sprawdzisz w
dashboardzie. Powtarzaj, kiedy chcesz odświeżyć dane (np. co 2 dni), a `/diff`
porówna kolejne przebiegi.

## Layout

```
src/allegro_sc/
  config.py          # env-driven configuration
  client.py          # WorkerClient: GET /targets, POST /ingest
  browser.py         # Playwright driver (+ stealth, consent banner, delays)
  parsers/
    urls.py          # Allegro URL builders (keyword / shop)
    extract.py       # pure HTML -> Offer (testable on snapshots)
  models.py          # Offer / IngestBatch / Target (the ingest contract)
  run.py             # orchestration + CLI entry point
tests/               # parser unit tests on a saved HTML fixture
```

The browser only navigates and returns HTML; all extraction is a pure function
in `parsers/extract.py`, so when Allegro changes its markup you fix a selector
and the unit tests confirm it — no browser needed.

## Configuration (environment variables)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `WORKER_URL` | yes | — | Base URL of the deployed Worker |
| `INGEST_TOKEN` | yes | — | Bearer token (same secret as the Worker) |
| `MAX_PAGES` | no | `3` | Pages per target (keep low to limit requests) |
| `HEADLESS` | no | `1` | `0` to watch the browser locally |
| `MIN_DELAY_S` / `MAX_DELAY_S` | no | `2` / `5` | Random pause per page |
| `NAV_TIMEOUT_MS` | no | `45000` | Navigation timeout |
| `PROXY_URL` | no | — | Optional rotating proxy (e.g. against Akamai blocks) |

## Local run

```bash
cd scraper
pip install -e .
python -m playwright install chromium
WORKER_URL=https://your-worker.workers.dev INGEST_TOKEN=... HEADLESS=0 allegro-sc-scrape
```

## Tests

```bash
pip install -e ".[dev]"
pytest
```

## GitHub Actions

`.github/workflows/scrape.yml` runs the cron and on-demand (`workflow_dispatch`).
Set repo secrets: `WORKER_URL`, `INGEST_TOKEN`, and optionally `PROXY_URL`.

## Notes & risks

- **Bot detection (Akamai):** GitHub runner IPs are public and easy to flag.
  `playwright-stealth` is used; if Allegro starts serving captchas, wire up
  `PROXY_URL` with a rotating premium proxy.
- **Markup changes:** extraction leans on stable structure (`<article>` cards
  linking to `/oferta/<id>`) rather than CSS class names. Update `extract.py`
  and the fixture together when it drifts.
- **Allegro ToS:** scraping may conflict with Allegro's terms — operate accordingly.
