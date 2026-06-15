from pathlib import Path

from allegro_sc.parsers import parse_offers, parse_price

FIXTURE = Path(__file__).parent / "fixtures" / "listing_sample.html"


def test_parse_price_formats():
    assert parse_price("59,99 zł") == 59.99
    assert parse_price("1 234,50 zł") == 1234.50
    assert parse_price("od 9,99 zł teraz") == 9.99
    assert parse_price("brak ceny") is None
    assert parse_price("") is None


def test_parse_offers_extracts_valid_cards_only():
    html = FIXTURE.read_text(encoding="utf-8")
    offers = parse_offers(html, "keyword", "filament petg", start_position=1)

    # 4 articles, but the promo card (no /oferta/ link) and the priceless card
    # are skipped -> 2 valid offers.
    assert len(offers) == 2

    first, second = offers
    assert first.offer_id == "12345678901"
    assert first.title == "Filament PETG 1kg czarny"
    assert first.price == 59.99
    assert first.is_smart is True
    assert first.seller_name == "ShopX"
    assert first.source_type == "keyword"
    assert first.source_value == "filament petg"
    assert first.position == 1

    assert second.offer_id == "22222222222"
    assert second.price == 1234.50
    assert second.is_smart is False
    assert second.position == 2


def test_start_position_offsets_numbering():
    html = FIXTURE.read_text(encoding="utf-8")
    offers = parse_offers(html, "shop", "ShopX", start_position=10)
    assert [o.position for o in offers] == [10, 11]
