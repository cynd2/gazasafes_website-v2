function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  redisUrl: required("REDIS_URL"),
  eventsStream: process.env.EVENTS_STREAM ?? "events:raw",
  // Comma-separated list of site keys this deployment accepts. Site keys are
  // public identifiers (embedded in the frontend), not secrets, they just
  // scope traffic to known domains — real abuse protection is rate limiting
  // and payload validation (see planmode.md §3).
  siteKeys: new Set(required("SITE_KEYS").split(",").map((k) => k.trim()).filter(Boolean)),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 60),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxBatchSize: Number(process.env.MAX_BATCH_SIZE ?? 20),
};
