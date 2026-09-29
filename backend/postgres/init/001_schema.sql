CREATE TABLE pages (
  page_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL UNIQUE,
  title       TEXT
);

CREATE TABLE sessions (
  session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen   TIMESTAMPTZ NOT NULL,
  last_seen    TIMESTAMPTZ NOT NULL,
  ip_hash      TEXT,              -- hashed/truncated after geo lookup, never raw long-term
  country      TEXT,
  city         TEXT,
  device_type  TEXT,              -- mobile / desktop / tablet
  browser      TEXT,              -- parsed user-agent
  referrer     TEXT,
  utm_source   TEXT
);
