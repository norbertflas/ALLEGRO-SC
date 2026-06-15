"""Allegro URL builders for the two scraping strategies."""

from __future__ import annotations

from urllib.parse import quote

BASE = "https://allegro.pl"


def keyword_url(phrase: str, page: int = 1) -> str:
    url = f"{BASE}/listing?string={quote(phrase)}"
    if page > 1:
        url += f"&p={page}"
    return url


def shop_url(shop_name: str, page: int = 1) -> str:
    # order=qd -> sort by relevance/popularity
    url = f"{BASE}/uzytkownik/{quote(shop_name)}?order=qd"
    if page > 1:
        url += f"&p={page}"
    return url
