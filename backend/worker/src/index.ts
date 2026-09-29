import { randomUUID } from "node:crypto";
import { UAParser } from "ua-parser-js";
import { config } from "./config.js";
import { ensureConsumerGroup, readPending, readNew, ack, type StreamMessage } from "./consumer.js";
import { loadGeoIp, lookupGeo } from "./geoip.js";
import { hashIp } from "./hash.js";
import { isBot } from "./botFilter.js";
import { resolveSession } from "./sessionStore.js";
import { upsertPage, upsertSession } from "./db/postgres.js";
import { insertEvents, toClickHouseDateTime, type EventRow } from "./db/clickhouse.js";
import type { QueuedEvent } from "./types.js";

function extractUtmSource(pageUrl: string): string | null {
  try {
    return new URL(pageUrl, "http://localhost").searchParams.get("utm_source");
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processBatch(messages: StreamMessage[]): Promise<void> {
  const rows: EventRow[] = [];
  const ackIds: string[] = [];

  for (const msg of messages) {
    let event: QueuedEvent;
    try {
      event = JSON.parse(msg.payload);
    } catch {
      console.warn(`[worker] dropping unparseable message ${msg.id}`);
      ackIds.push(msg.id);
      continue;
    }

    try {
      if (isBot(event.user_agent)) {
        ackIds.push(msg.id);
        continue;
      }

      // IP is used here only, to resolve geo and produce a hash — never
      // written raw to Postgres/ClickHouse (planmode.md §6).
      const geo = lookupGeo(event.ip_address);
      const ipHash = hashIp(event.ip_address);

      const ua = UAParser(event.user_agent);
      const deviceType = ua.device.type ?? "desktop";
      const browser = ua.browser.name ?? null;

      const eventTime = new Date(event.server_timestamp);
      const { sessionId, isNew } = await resolveSession(event.session_id);
      const pageId = await upsertPage(event.page_url);

      await upsertSession(sessionId, isNew, eventTime, {
        ipHash,
        country: geo.country,
        city: geo.city,
        deviceType,
        browser,
        referrer: event.referrer || null,
        // Not part of the client payload in planmode.md §3 — derived here
        // from the landing page's query string, the usual place UTM params
        // live. Flagged as a design call, not a plan-specified detail.
        utmSource: extractUtmSource(event.page_url),
      });

      rows.push({
        event_id: randomUUID(),
        session_id: sessionId,
        page_id: pageId,
        event_type: event.event_type,
        click_target: event.target ?? "",
        client_ts: toClickHouseDateTime(new Date(event.client_timestamp)),
        server_ts: toClickHouseDateTime(eventTime),
      });
      ackIds.push(msg.id);
    } catch (err) {
      // Leave unacked — will be retried from the pending-entries list on the
      // next startup (or next loop pass, see main()).
      console.error(`[worker] failed to process message ${msg.id}`, err);
    }
  }

  if (rows.length > 0) {
    try {
      await insertEvents(rows);
    } catch (err) {
      // Whole-batch ClickHouse failure: don't ack anything from this batch,
      // Postgres writes already applied are idempotent (upsertPage/
      // upsertSession) so reprocessing on retry is safe. Known gap: retried
      // messages get a fresh event_id, so a crash between a successful
      // ClickHouse insert and the XACK can duplicate rows there (MergeTree
      // has no dedup) — acceptable at this traffic volume, flagged for later.
      console.error("[worker] ClickHouse batch insert failed, leaving batch unacked", err);
      return;
    }
  }

  await ack(ackIds);
}

async function main() {
  await ensureConsumerGroup();
  await loadGeoIp();
  console.log(`[worker] consuming ${config.eventsStream} as ${config.consumerName} in group ${config.consumerGroup}`);

  // Recover anything left pending from a previous crash before joining the
  // live stream.
  for (;;) {
    const pending = await readPending();
    if (pending.length === 0) break;
    await processBatch(pending);
  }

  for (;;) {
    try {
      const batch = await readNew();
      if (batch.length === 0) continue;
      await processBatch(batch);
    } catch (err) {
      console.error("[worker] loop error", err);
      await sleep(2000);
    }
  }
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
