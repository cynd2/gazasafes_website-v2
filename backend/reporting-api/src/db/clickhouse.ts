import { createClient } from "@clickhouse/client";
import { config } from "../config.js";

export const clickhouse = createClient({
  url: config.clickhouseUrl,
  database: config.clickhouseDb,
  username: config.clickhouseUser,
  password: config.clickhousePassword,
});

// ClickHouse's DateTime type wants "YYYY-MM-DD HH:MM:SS", not ISO 8601.
export function toClickHouseDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function chQuery<T = Record<string, unknown>>(
  query: string,
  query_params: Record<string, unknown>,
): Promise<T[]> {
  const result = await clickhouse.query({ query, query_params, format: "JSONEachRow" });
  return result.json<T>();
}
