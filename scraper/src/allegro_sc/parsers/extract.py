"""Pure HTML -> Offer extraction.

Kept free of Playwright so it can be unit-tested on saved HTML snapshots — when
Allegro changes its markup, fixing a selector here is a quick, testable commit.

Strategy: lean on stable structure (offer cards are <article> elements that link
to /oferta/<slug>-<id>) rather than Allegro's churning CSS class names.
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from ..models import Offer, SourceType

# Allegro offer URLs end with a long numeric id: /oferta/jakis-slug-12345678901
OFFER_ID_RE = re.compile(r"/oferta/(?:[^?#]*?-)?(\d{6,})")
# Polish price format: "1 234,56" / "59,99" (optionally with nbsp thousands sep)
PRICE_RE = re.compile(r"(\d[\d\s ]*,\d{2})")


def parse_price(text: str) -> Optional[float]:
    match = PRICE_RE.search(text or "")
    if not match:
        return None
    raw = match.group(1).replace(" ", "").replace(" ", "")
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


def _offer_id_from_href(href: str) -> Optional[str]:
    match = OFFER_ID_RE.search(href or "")
    return match.group(1) if match else None


def parse_offers(
    html: str,
    source_type: SourceType,
    source_value: str,
    start_position: int = 1,
) -> list[Offer]:
    """Extract offers from a listing or shop page.

    `start_position` lets the caller continue numbering across paginated pages.
    """
    soup = BeautifulSoup(html, "lxml")
    offers: list[Offer] = []
    position = start_position

    for article in soup.find_all("article"):
        link = article.find(
            "a", href=lambda h: bool(h) and "/oferta/" in h
        )
        if link is None:
            continue
        offer_id = _offer_id_from_href(link.get("href", ""))
        if not offer_id:
            continue

        title = (link.get("aria-label") or link.get_text(strip=True) or "").strip()
        if not title:
            heading = article.find(["h2", "h3"])
            title = heading.get_text(strip=True) if heading else ""
        if not title:
            continue

        price = parse_price(article.get_text(separator=" ", strip=True))
        if price is None:
            continue

        offers.append(
            Offer(
                offer_id=offer_id,
                title=title,
                price=price,
                is_smart="smart" in article.get_text(strip=True).lower(),
                seller_name=_extract_seller(article),
                source_type=source_type,
                source_value=source_value,
                position=position,
            )
        )
        position += 1

    return offers


def _extract_seller(article) -> Optional[str]:
    # Best-effort: Allegro sometimes exposes the seller via a data attribute or
    # a "Sprzedawca:" label. Optional field, so a miss is fine.
    node = article.find(attrs={"data-analytics-view-label": "sellerLogin"})
    if node and node.get_text(strip=True):
        return node.get_text(strip=True)
    return None
