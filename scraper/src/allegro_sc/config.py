"""Runtime configuration, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file(path: str = ".env") -> None:
    """Load KEY=VALUE lines from a local .env into the environment (for local runs).

    Existing environment variables win, so this is a no-op on GitHub Actions.
    """
    p = Path(path)
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))



@dataclass(frozen=True)
class Config:
    worker_url: str
    ingest_token: str
    max_pages: int
    headless: bool
    min_delay_s: float
    max_delay_s: float
    nav_timeout_ms: int
    proxy: str | None
    debug_dir: str

    @classmethod
    def from_env(cls) -> "Config":
        worker_url = os.environ.get("WORKER_URL", "").rstrip("/")
        token = os.environ.get("INGEST_TOKEN", "")
        if not worker_url:
            raise RuntimeError("WORKER_URL is required")
        if not token:
            raise RuntimeError("INGEST_TOKEN is required")
        return cls(
            worker_url=worker_url,
            ingest_token=token,
            max_pages=int(os.environ.get("MAX_PAGES", "3")),
            headless=os.environ.get("HEADLESS", "1") not in ("0", "false", "False"),
            min_delay_s=float(os.environ.get("MIN_DELAY_S", "2.0")),
            max_delay_s=float(os.environ.get("MAX_DELAY_S", "5.0")),
            nav_timeout_ms=int(os.environ.get("NAV_TIMEOUT_MS", "45000")),
            proxy=os.environ.get("PROXY_URL") or None,
            debug_dir=os.environ.get("DEBUG_HTML_DIR", "debug"),
        )
