import { z } from "zod";

// Mirrors planmode.md §3 "Client payload". `target` is only meaningful for
// click events but we don't enforce that here — the worker can drop it.
export const eventSchema = z.object({
  event_type: z.enum(["pageview", "click"]),
  page_url: z.string().min(1).max(2048),
  referrer: z.string().max(2048).optional().default(""),
  session_id: z.string().uuid(),
  client_timestamp: z.string().datetime({ offset: true }),
  target: z.string().max(256).optional(),
});

export type ClientEvent = z.infer<typeof eventSchema>;

export const batchSchema = z.object({
  events: z.array(eventSchema).min(1),
});

// Fields the ingestion API adds on receipt — never sent by the client.
// `ip_address` travels through the queue only long enough for the worker to
// resolve geo and hash/discard it (planmode.md §5, §6); it is never written
// to Postgres/ClickHouse from here.
export interface EnrichedEvent extends ClientEvent {
  server_timestamp: string;
  ip_address: string;
  user_agent: string;
}
