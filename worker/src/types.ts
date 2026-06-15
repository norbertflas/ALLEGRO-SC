export interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
}

export type SourceType = "shop" | "keyword";

/** A single scraped offer — the core unit of the data contract with the scraper. */
export interface Offer {
  offer_id: string;
  title: string;
  price: number;
  is_smart?: boolean;
  seller_name?: string | null;
  source_type: SourceType;
  source_value: string;
  position?: number | null;
}

/** Payload the scraper sends to POST /ingest. */
export interface IngestBatch {
  run_id: string;
  scraped_at: string; // ISO 8601
  offers: Offer[];
}
