import { redis } from "./redis.js";
import { config } from "./config.js";

export interface StreamMessage {
  id: string;
  payload: string;
}

export async function ensureConsumerGroup(): Promise<void> {
  try {
    await redis.xgroup("CREATE", config.eventsStream, config.consumerGroup, "$", "MKSTREAM");
  } catch (err) {
    if (err instanceof Error && err.message.includes("BUSYGROUP")) return;
    throw err;
  }
}

function parseEntries(raw: unknown): StreamMessage[] {
  // raw: [[streamName, [[id, [field, value, ...]], ...]]] | null
  const streams = raw as [string, [string, string[]][]][] | null;
  if (!streams || streams.length === 0) return [];
  const [, entries] = streams[0];
  return entries.map(([id, fields]) => {
    const payloadIndex = fields.indexOf("payload");
    return { id, payload: payloadIndex >= 0 ? fields[payloadIndex + 1] : "" };
  });
}

// Read this consumer's own not-yet-acked messages first (id "0") — picks up
// anything left over from a crash before moving on to new work.
export async function readPending(): Promise<StreamMessage[]> {
  const raw = await redis.xreadgroup(
    "GROUP", config.consumerGroup, config.consumerName,
    "COUNT", config.batchSize,
    "STREAMS", config.eventsStream, "0",
  );
  return parseEntries(raw);
}

export async function readNew(): Promise<StreamMessage[]> {
  const raw = await redis.xreadgroup(
    "GROUP", config.consumerGroup, config.consumerName,
    "COUNT", config.batchSize,
    "BLOCK", config.blockMs,
    "STREAMS", config.eventsStream, ">",
  );
  return parseEntries(raw);
}

export async function ack(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await redis.xack(config.eventsStream, config.consumerGroup, ...ids);
}
