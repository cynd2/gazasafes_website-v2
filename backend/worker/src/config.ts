function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

export const config = {
  redisUrl: required("REDIS_URL"),
  eventsStream: process.env.EVENTS_STREAM ?? "events:raw",
  consumerGroup: process.env.CONSUMER_GROUP ?? "workers",
  consumerName: process.env.CONSUMER_NAME ?? "worker-1",
  batchSize: Number(process.env.BATCH_SIZE ?? 50),
  blockMs: Number(process.env.BLOCK_MS ?? 5000),

  databaseUrl: required("DATABASE_URL"),

  clickhouseUrl: process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
  clickhouseDb: process.env.CLICKHOUSE_DB ?? "analytics",
  clickhouseUser: process.env.CLICKHOUSE_USER ?? "analytics",
  clickhousePassword: required("CLICKHOUSE_PASSWORD"),

  // Optional — GeoLite2 City .mmdb (planmode.md §5). Missing file means geo
  // enrichment is skipped (country/city stay null), it doesn't block writes.
  geoipDbPath: process.env.GEOIP_DB_PATH,

  // HMAC pepper for hashing IPs before they ever reach Postgres (planmode.md
  // §6 — raw IPs are never persisted). Required so a missing env var can't
  // silently downgrade to storing something reversible.
  ipHashPepper: required("IP_HASH_PEPPER"),

  // Inactivity gap that ends a session (planmode.md §1). Implemented as a
  // Redis TTL on the client-token → internal-session-id mapping, see
  // sessionStore.ts.
  sessionGapSeconds: Number(process.env.SESSION_GAP_SECONDS ?? 1800),
};
