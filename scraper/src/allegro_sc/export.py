"""Local CSV export (for Power BI / Excel). Kept free of Playwright so it's
unit-testable. The database remains the source of truth; CSV is a convenience copy."""

from __future__ import annotations

import csv
import logging
from pathlib import Path

from .config import Config
from .models import Offer

log = logging.getLogger("allegro_sc")

CSV_COLUMNS = [
    "run_id", "scraped_at", "source_type", "source_value",
    "offer_id", "title", "price", "is_smart", "seller_name", "position",
]


def write_csv(config: Config, run_id: str, scraped_at: str, offers: list[Offer]) -> None:
    """Write a flat one-row-per-offer CSV for the run.

    Files accumulate in CSV_DIR so a Power BI "Folder" source can combine every
    run into one table.
    """
    if not config.csv_dir or not offers:
        return
    out_dir = Path(config.csv_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"offers_{run_id}.csv"
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for o in offers:
            writer.writerow({
                "run_id": run_id,
                "scraped_at": scraped_at,
                "source_type": o.source_type,
                "source_value": o.source_value,
                "offer_id": o.offer_id,
                "title": o.title,
                "price": o.price,
                "is_smart": int(o.is_smart),
                "seller_name": o.seller_name or "",
                "position": "" if o.position is None else o.position,
            })
    log.info("wrote CSV: %s (%d rows)", path, len(offers))
