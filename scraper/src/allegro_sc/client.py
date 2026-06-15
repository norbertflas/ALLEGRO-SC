"""Thin HTTP client for the Worker API. The scraper never touches D1 directly."""

from __future__ import annotations

import httpx

from .config import Config
from .models import IngestBatch, Target


class WorkerClient:
    def __init__(self, config: Config) -> None:
        self._base = config.worker_url
        self._headers = {"authorization": f"Bearer {config.ingest_token}"}

    def get_active_targets(self) -> list[Target]:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{self._base}/targets",
                params={"active": "1"},
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
        return [Target.model_validate(row) for row in data.get("targets", [])]

    def send_batch(self, batch: IngestBatch) -> dict:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{self._base}/ingest",
                content=batch.model_dump_json(),
                headers={**self._headers, "content-type": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()
