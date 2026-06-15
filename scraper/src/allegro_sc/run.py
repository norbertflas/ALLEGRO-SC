"""Entry point: pull targets, scrape, push one batch to the Worker.

Workflow (one GitHub Actions run):
  1. GET /targets?active=1
  2. for each target: paginate up to MAX_PAGES, extract offers
  3. POST /ingest with a single batch tagged by run_id
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from .browser import browser_session, fetch_html
from .client import WorkerClient
from .config import Config
from .models import IngestBatch, Offer, Target
from .parsers import keyword_url, parse_offers, shop_url

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("allegro_sc")


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
            log.info("no offers on page %d, stopping pagination", page)
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

    batch = IngestBatch(run_id=run_id, scraped_at=scraped_at, offers=all_offers)
    if not all_offers:
        log.warning("collected 0 offers; skipping ingest")
        return

    result = client.send_batch(batch)
    log.info("ingested: %s", result)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
