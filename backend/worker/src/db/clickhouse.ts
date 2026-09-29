import { createClient } from "@clickhouse/client";
import { config } from "../config.js";

export const clickhouse = createClient({
  url: config.clickhouseUrl,
  database: config.clickhouseDb,
  username: config.clickhouseUser,
  password: config.clickhousePassword,
});

export interface EventRow {
  event_id: string;
  session_id: string;
  page_id: string;
  event_type: string;
  click_target: string;
  client_ts: string; // "YYYY-MM-DD HH:MM:SS", UTC
  server_ts: string;
}

// ClickHouse's DateTime type wants "YYYY-MM-DD HH:MM:SS", not ISO 8601.
export function toClickHouseDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return;
  await clickhouse.insert({
    table: "events",
    values: rows,
    format: "JSONEachRow",
  });
}
