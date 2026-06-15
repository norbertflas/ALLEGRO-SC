"""Playwright driver. Navigates and returns raw HTML; parsing lives in parsers/."""

from __future__ import annotations

import logging
import random
from contextlib import asynccontextmanager

from playwright.async_api import BrowserContext, async_playwright

from .config import Config

try:  # optional, but strongly recommended against Akamai bot detection
    from playwright_stealth import stealth_async
except Exception:  # pragma: no cover - import guard
    stealth_async = None

log = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_CONSENT_SELECTORS = [
    'button[data-role="accept-consent"]',
    'button:has-text("OK, zgadzam się")',
    'button:has-text("Akceptuję")',
]


@asynccontextmanager
async def browser_session(config: Config):
    async with async_playwright() as p:
        launch_kwargs: dict = {
            "headless": config.headless,
            "args": ["--disable-blink-features=AutomationControlled"],
        }
        if config.proxy:
            launch_kwargs["proxy"] = {"server": config.proxy}
        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            user_agent=_USER_AGENT,
            locale="pl-PL",
            viewport={"width": 1366, "height": 900},
        )
        try:
            yield context
        finally:
            await context.close()
            await browser.close()


async def fetch_html(context: BrowserContext, url: str, config: Config) -> str:
    page = await context.new_page()
    if stealth_async is not None:
        await stealth_async(page)
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=config.nav_timeout_ms)
        await _maybe_accept_consent(page)
        # Allegro renders the listing client-side; let the network settle so the
        # offer cards exist before we read the HTML (best-effort).
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        # human-ish pause so we don't hammer the listing
        delay_ms = int(random.uniform(config.min_delay_s, config.max_delay_s) * 1000)
        await page.wait_for_timeout(delay_ms)
        return await page.content()
    finally:
        await page.close()


async def _maybe_accept_consent(page) -> None:
    for selector in _CONSENT_SELECTORS:
        try:
            button = page.locator(selector).first
            if await button.count() and await button.is_visible():
                await button.click(timeout=3000)
                return
        except Exception:  # consent banner is best-effort
            continue
