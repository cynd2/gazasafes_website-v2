CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
  event_id     UUID,
  session_id   UUID,
  page_id      UUID,
  event_type   String,   -- 'pageview' | 'click'
  click_target String,   -- e.g. 'whatsapp_cta', 'product_case' 
  client_ts    DateTime,
  server_ts    DateTime
) ENGINE = MergeTree()
ORDER BY (server_ts, event_type);
