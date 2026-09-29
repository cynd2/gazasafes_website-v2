import { randomUUID } from "node:crypto";
import { redis } from "./redis.js";
import { config } from "./config.js";

// Session stitching (planmode.md §1): the client sends a stable per-browser
// token, but the 30-minute inactivity rule decides whether that token still
// maps to an existing analytics session. We use Redis's own TTL as the
// inactivity clock instead of comparing timestamps by hand — a sliding
// expiry naturally models "no activity for 30 minutes = new session":
//
//   session_map:<client token> -> internal session_id, EX 30min, refreshed
//   on every event
//
// This session_id (not the client token) is what gets written to
// Postgres.sessions and ClickHouse.events.
export async function resolveSession(clientToken: string): Promise<{ sessionId: string; isNew: boolean }> {
  const key = `session_map:${clientToken}`;
  const candidateId = randomUUID();

  const setResult = await redis.set(key, candidateId, "EX", config.sessionGapSeconds, "NX");
  if (setResult === "OK") {
    return { sessionId: candidateId, isNew: true };
  }

  await redis.expire(key, config.sessionGapSeconds);
  const existing = await redis.get(key);
  if (!existing) {
    // Lost a race with its own expiry between NX and here — rare at this
    // traffic volume. Treat as a fresh session rather than retrying.
    await redis.set(key, candidateId, "EX", config.sessionGapSeconds);
    return { sessionId: candidateId, isNew: true };
  }
  return { sessionId: existing, isNew: false };
}
