DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  alert_types TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX subscriptions_address_chain_unique ON subscriptions (address, chain_id);
--> statement-breakpoint
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  subscription_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  type TEXT NOT NULL,
  project TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  detail TEXT NOT NULL,
  url TEXT,
  event_at INTEGER,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
--> statement-breakpoint
CREATE UNIQUE INDEX alerts_subscription_dedupe_unique ON alerts (subscription_id, dedupe_key);
--> statement-breakpoint
CREATE TABLE feed_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);