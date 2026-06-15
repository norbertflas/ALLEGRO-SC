import csv

from allegro_sc.config import Config
from allegro_sc.export import write_csv
from allegro_sc.models import Offer


def _config(csv_dir):
    return Config(
        worker_url="https://x",
        ingest_token="t",
        max_pages=1,
        headless=True,
        min_delay_s=0,
        max_delay_s=0,
        nav_timeout_ms=1000,
        proxy=None,
        debug_dir="debug",
        csv_dir=str(csv_dir),
    )


def test_write_csv_one_row_per_offer(tmp_path):
    offers = [
        Offer(offer_id="A1", title="Filament", price=59.99, is_smart=True,
              seller_name="ShopX", source_type="keyword", source_value="filament",
              position=1),
        Offer(offer_id="A2", title="Inny", price=10.0, source_type="shop",
              source_value="ShopX", position=None),
    ]
    write_csv(_config(tmp_path), "run-1", "2026-06-15T06:00:00Z", offers)

    path = tmp_path / "offers_run-1.csv"
    assert path.exists()
    rows = list(csv.DictReader(path.read_text(encoding="utf-8-sig").splitlines()))
    assert len(rows) == 2
    assert rows[0]["offer_id"] == "A1"
    assert rows[0]["price"] == "59.99"
    assert rows[0]["is_smart"] == "1"
    assert rows[0]["position"] == "1"
    assert rows[1]["is_smart"] == "0"
    assert rows[1]["seller_name"] == ""
    assert rows[1]["position"] == ""


def test_no_csv_when_dir_unset(tmp_path):
    cfg = _config(tmp_path)
    object.__setattr__(cfg, "csv_dir", None)
    write_csv(cfg, "run-1", "2026-06-15T06:00:00Z", [])
    assert not list(tmp_path.iterdir())
