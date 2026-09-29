import { Redis } from "ioredis";
import { config } from "./config.js";
import type { EnrichedEvent } from "./schema.js";

export const redis = new Redis(config.redisUrl, {
  // Fail fast rather than buffering commands indefinitely if Redis is down —
  // the ingestion endpoint should surface a 503 instead of hanging.
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
});

export async function publishEvent(event: EnrichedEvent): Promise<string> {
  const id = await redis.xadd(config.eventsStream, "*", "payload", JSON.stringify(event));
  if (!id) throw new Error("XADD returned no id");
  return id;
}

export async function publishEvents(events: EnrichedEvent[]): Promise<string[]> {
  const pipeline = redis.pipeline();
  for (const event of events) {
    pipeline.xadd(config.eventsStream, "*", "payload", JSON.stringify(event));
  }
  const results = await pipeline.exec();
  if (!results) return [];
  return results.map(([err, id]: [Error | null, unknown]) => {
    if (err) throw err;
    return id as string;
  });
}
