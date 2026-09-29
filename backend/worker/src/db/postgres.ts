import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

// Low cardinality (a handful of pages on a marketing site) — a plain
// in-process cache avoids a round trip per event without needing an eviction
// policy.
const pageIdCache = new Map<string, string>();

export async function upsertPage(url: string): Promise<string> {
  const cached = pageIdCache.get(url);
  if (cached) return cached;

  const { rows } = await pool.query<{ page_id: string }>(
    `INSERT INTO pages (url) VALUES ($1)
     ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
     RETURNING page_id`,
    [url],
  );
  const pageId = rows[0].page_id;
  pageIdCache.set(url, pageId);
  return pageId;
}

export interface SessionDimensions {
  ipHash: string | null;
  country: string | null;
  city: string | null;
  deviceType: string | null;
  browser: string | null;
  referrer: string | null;
  utmSource: string | null;
}

export async function upsertSession(
  sessionId: string,
  isNew: boolean,
  eventTime: Date,
  dims: SessionDimensions,
): Promise<void> {
  if (isNew) {
    await pool.query(
      `INSERT INTO sessions
         (session_id, first_seen, last_seen, ip_hash, country, city, device_type, browser, referrer, utm_source)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId, eventTime, dims.ipHash, dims.country, dims.city, dims.deviceType, dims.browser, dims.referrer, dims.utmSource],
    );
    return;
  }

  await pool.query(
    `UPDATE sessions SET last_seen = GREATEST(last_seen, $2) WHERE session_id = $1`,
    [sessionId, eventTime],
  );
}
