import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  chainId: integer("chain_id").notNull(),
  alertTypes: text("alert_types").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const alerts = sqliteTable(
  "alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: text("subscription_id").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    type: text("type", {
      enum: ["wl_open", "ending_soon", "ccff00_new", "raffle_deadline"],
    }).notNull(),
    project: text("project").notNull(),
    chainId: integer("chain_id").notNull(),
    detail: text("detail").notNull(),
    url: text("url"),
    eventAt: integer("event_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("alerts_subscription_dedupe_unique").on(
      table.subscriptionId,
      table.dedupeKey,
    ),
  ],
);

export const feedSnapshots = sqliteTable("feed_snapshots", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
});
