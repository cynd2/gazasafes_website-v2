function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8788),
  host: process.env.HOST ?? "0.0.0.0",

  // Bearer tokens this deployment accepts (planmode.md §4). Unlike the
  // ingestion API's site key, this is a real secret gating access to every
  // report, checked with a timing-safe comparison.
  apiKeys: required("API_KEYS").split(",").map((k) => k.trim()).filter(Boolean),

  // planmode.md §4 flagged the exact limit as an open decision — resolved
  // here at 92 days (~1 quarter), enough for the dashboard's normal use
  // without allowing an unbounded scan of `events`.
  maxDateRangeDays: Number(process.env.MAX_DATE_RANGE_DAYS ?? 92),

  // Resolves §4's "sessions needs pagination" open decision: limit/offset.
  defaultSessionsLimit: Number(process.env.DEFAULT_SESSIONS_LIMIT ?? 50),
  maxSessionsLimit: Number(process.env.MAX_SESSIONS_LIMIT ?? 500),

  defaultTopPagesLimit: Number(process.env.DEFAULT_TOP_PAGES_LIMIT ?? 10),
  maxTopPagesLimit: Number(process.env.MAX_TOP_PAGES_LIMIT ?? 100),

  // The dashboard calls this API from a different origin and sends a custom
  // Authorization header, which always triggers a CORS preflight. "*" is
  // safe here since auth is a Bearer token, not cookies — no credentials
  // mode needed. Narrow this once the dashboard has a fixed origin.
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  databaseUrl: required("DATABASE_URL"),

  clickhouseUrl: process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
  clickhouseDb: process.env.CLICKHOUSE_DB ?? "analytics",
  clickhouseUser: process.env.CLICKHOUSE_USER ?? "analytics",
  clickhousePassword: required("CLICKHOUSE_PASSWORD"),
};
