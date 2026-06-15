"""Data contract shared with the Worker's POST /ingest endpoint."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SourceType = Literal["shop", "keyword"]


class Offer(BaseModel):
    offer_id: str
    title: str
    price: float
    is_smart: bool = False
    seller_name: Optional[str] = None
    source_type: SourceType
    source_value: str
    position: Optional[int] = None


class IngestBatch(BaseModel):
    run_id: str
    scraped_at: str  # ISO 8601
    offers: list[Offer] = Field(default_factory=list)


class Target(BaseModel):
    id: int
    target_type: SourceType
    target_value: str
    is_active: int = 1
