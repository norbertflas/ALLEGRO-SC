"""Allegro URL builders for the two scraping strategies.

Each target's stored value may be either a plain phrase / shop name, or a full
Allegro URL (e.g. pasted straight from the browser). Both are accepted.
"""

from __future__ import annotations

from urllib.parse import quote

BASE = "https://allegro.pl"


def _with_page(url: str, page: int) -> str:
    if page <= 1:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}p={page}"


def _is_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def keyword_url(phrase: str, page: int = 1) -> str:
    if _is_url(phrase):
        return _with_page(phrase, page)
    return _with_page(f"{BASE}/listing?string={quote(phrase)}", page)


def shop_url(shop_name: str, page: int = 1) -> str:
    if _is_url(shop_name):
        return _with_page(shop_name, page)
    # order=qd -> sort by relevance/popularity
    return _with_page(f"{BASE}/uzytkownik/{quote(shop_name)}?order=qd", page)
