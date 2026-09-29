// Mirrors ingestion-api/src/schema.ts EnrichedEvent — this is the message
// shape published to the events:raw stream. Duplicated rather than shared
// across the two services on purpose, they're independently deployable and
// the contract is small (planmode.md §3).
export interface QueuedEvent {
  event_type: "pageview" | "click";
  page_url: string;
  referrer: string;
  session_id: string; // client-generated token, NOT the stored sessions.session_id — see sessionStore.ts
  client_timestamp: string;
  target?: string;
  server_timestamp: string;
  ip_address: string;
  user_agent: string;
}
