"""Entry point: pull targets, scrape, push one batch to the Worker.

Workflow (one GitHub Actions run):
  1. GET /targets?active=1
  2. for each target: paginate up to MAX_PAGES, extract offers
  3. POST /ingest with a single batch tagged by run_id
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .browser import browser_session, fetch_html
from .client import WorkerClient
from .config import Config, load_env_file
from .export import write_csv
from .models import IngestBatch, Offer, Target
from .parsers import keyword_url, looks_blocked, page_title, parse_offers, shop_url

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("allegro_sc")


def _dump_html(config: Config, target: Target, page: int, html: str) -> None:
    """Save a page's HTML so the workflow can upload it as an artifact.

    Lets us tell apart an Akamai/captcha wall from a selector mismatch without guessing.
    """
    try:
        out_dir = Path(config.debug_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        slug = re.sub(r"[^A-Za-z0-9._-]+", "_", target.target_value)[:80]
        path = out_dir / f"{target.target_type}_{slug}_p{page}.html"
        path.write_text(html, encoding="utf-8")
        log.info("saved debug HTML: %s (%d bytes)", path, len(html))
    except Exception as exc:  # diagnostics must never break the run
        log.warning("failed to save debug HTML: %s", exc)


async def scrape_target(context, config: Config, target: Target) -> list[Offer]:
    """Scrape one target across pages, de-duplicated by offer_id (keep best position)."""
    build_url = shop_url if target.target_type == "shop" else keyword_url
    by_offer: dict[str, Offer] = {}
    position = 1

    for page in range(1, config.max_pages + 1):
        url = build_url(target.target_value, page)
        log.info("scraping %s page %d: %s", target.target_type, page, url)
        try:
            html = await fetch_html(context, url, config)
        except Exception as exc:
            log.warning("failed to fetch %s: %s", url, exc)
            break

        offers = parse_offers(html, target.target_type, target.target_value, position)
        if not offers:
            blocked = looks_blocked(html)
            log.warning(
                "no offers on page %d (title=%r, blocked=%s) — saving HTML for diagnosis",
                page,
                page_title(html),
                blocked,
            )
            _dump_html(config, target, page, html)
            break

        for offer in offers:
            by_offer.setdefault(offer.offer_id, offer)
        position += len(offers)

    log.info(
        "target %s=%s -> %d unique offers",
        target.target_type,
        target.target_value,
        len(by_offer),
    )
    return list(by_offer.values())


async def run() -> None:
    config = Config.from_env()
    client = WorkerClient(config)

    targets = client.get_active_targets()
    log.info("loaded %d active targets", len(targets))
    if not targets:
        log.info("nothing to scrape")
        return

    run_id = f"run-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:6]}"
    scraped_at = datetime.now(timezone.utc).isoformat()

    all_offers: list[Offer] = []
    async with browser_session(config) as context:
        for target in targets:
            all_offers.extend(await scrape_target(context, config, target))

    write_csv(config, run_id, scraped_at, all_offers)

    batch = IngestBatch(run_id=run_id, scraped_at=scraped_at, offers=all_offers)
    if not all_offers:
        log.warning("collected 0 offers; skipping ingest")
        return

    result = client.send_batch(batch)
    log.info("ingested: %s", result)


def main() -> None:
    load_env_file()
    asyncio.run(run())


if __name__ == "__main__":
    main()
