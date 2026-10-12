// Drizzle schema (spec section 5). UUID primary keys, timestamptz everywhere, all times in UTC.
// IST is only used for display and week boundaries (src/lib/time.ts).
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

/**
 * One row per tracking period. A show that is removed and later re-added gets a NEW row with the
 * same channel/show IDs (DECISIONS.md: "row per interval"), so history stays accurate.
 */
export const shows = pgTable(
  "shows",
  {
    id: id(),
    name: text("name").notNull(),
    youtubeChannelId: text("youtube_channel_id"),
    youtubeUploadsPlaylistId: text("youtube_uploads_playlist_id"),
    youtubeHandle: text("youtube_handle"),
    youtubeSubscribers: integer("youtube_subscribers"),
    spotifyShowId: text("spotify_show_id"),
    artworkUrl: text("artwork_url"),
    description: text("description").notNull().default(""),
    /** Reserved, unused in v1 (see src/lib/sources/rss.ts). */
    rssUrl: text("rss_url"),
    activeFrom: ts("active_from").notNull(),
    activeTo: ts("active_to"),
    /** Discovery only ingests episodes published after max(this, activeFrom). */
    lastSeenPublishedAt: ts("last_seen_published_at"),
    lastDiscoveredAt: ts("last_discovered_at"),
    lastError: text("last_error"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("shows_active_to_idx").on(t.activeTo)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: id(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id),
    youtubeVideoId: text("youtube_video_id").unique(),
    spotifyEpisodeId: text("spotify_episode_id").unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    publishedAt: ts("published_at").notNull(),
    durationSeconds: integer("duration_seconds"),
    youtubeUrl: text("youtube_url"),
    spotifyUrl: text("spotify_url"),
    /** Normalised title + date bucket, used for cross-platform dedupe. */
    canonicalKey: text("canonical_key").notNull(),
    analysisDepth: text("analysis_depth", { enum: ["video", "metadata"] }).notNull().default("video"),
    status: text("status", { enum: ["discovered", "extracted", "skipped", "failed"] }).notNull().default("discovered"),
    /** Why an episode was skipped or failed, shown on the Episodes page. */
    statusNote: text("status_note"),
    /** True for the dummy history seeded for demos (npm run seed:demo). */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("episodes_show_published_idx").on(t.showId, t.publishedAt), index("episodes_canonical_idx").on(t.canonicalKey)],
);

export const viewSnapshots = pgTable(
  "view_snapshots",
  {
    id: id(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    views: integer("views").notNull(),
    likes: integer("likes"),
    comments: integer("comments"),
    capturedAt: ts("captured_at").notNull().defaultNow(),
  },
  (t) => [index("view_snapshots_episode_idx").on(t.episodeId, t.capturedAt)],
);

export const extractions = pgTable("extractions", {
  id: id(),
  episodeId: uuid("episode_id")
    .notNull()
    .unique()
    .references(() => episodes.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  rawJson: jsonb("raw_json").notNull(),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull(),
  createdAt: createdAt(),
});

export const guests = pgTable("guests", {
  id: id(),
  canonicalName: text("canonical_name").notNull().unique(),
  normalizedKey: text("normalized_key").notNull().unique(),
  titleOrCompany: text("title_or_company"),
  createdAt: createdAt(),
});

export const guestAliases = pgTable(
  "guest_aliases",
  {
    id: id(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("guest_aliases_alias_idx").on(t.alias)],
);

export const episodeGuests = pgTable(
  "episode_guests",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["guest", "host"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.guestId, t.role] }), index("episode_guests_guest_idx").on(t.guestId)],
);

export const topics = pgTable("topics", {
  id: id(),
  canonicalLabel: text("canonical_label").notNull().unique(),
  createdAt: createdAt(),
});

export const topicAliases = pgTable(
  "topic_aliases",
  {
    id: id(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("topic_aliases_alias_idx").on(t.alias)],
);

export const episodeTopics = pgTable(
  "episode_topics",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.topicId] }), index("episode_topics_topic_idx").on(t.topicId)],
);

export const sponsors = pgTable("sponsors", {
  id: id(),
  canonicalName: text("canonical_name").notNull().unique(),
  normalizedKey: text("normalized_key").notNull().unique(),
  createdAt: createdAt(),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
});

export const sponsorAliases = pgTable(
  "sponsor_aliases",
  {
    id: id(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("sponsor_aliases_alias_idx").on(t.alias)],
);

export const episodeSponsors = pgTable(
  "episode_sponsors",
  {
    id: id(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    product: text("product"),
    placement: text("placement", {
      enum: ["host_read", "pre_roll", "mid_roll", "post_roll", "description_link", "on_screen", "unknown"],
    }).notNull(),
    evidence: text("evidence").notNull(),
    timestampSeconds: integer("timestamp_seconds"),
    source: text("source", { enum: ["video", "description"] }).notNull(),
  },
  (t) => [index("episode_sponsors_episode_idx").on(t.episodeId), index("episode_sponsors_sponsor_idx").on(t.sponsorId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type", { enum: ["discover_show", "extract_episode", "refresh_views", "weekly_analysis"] }).notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status", { enum: ["pending", "running", "done", "failed", "skipped"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: ts("locked_at"),
    runAfter: ts("run_after").notNull().defaultNow(),
    createdAt: createdAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("jobs_status_run_after_idx").on(t.status, t.runAfter)],
);

export const briefs = pgTable("briefs", {
  id: id(),
  /** IST Monday of the covered week. Unique: one brief per week. */
  weekStart: date("week_start").notNull().unique(),
  weekEnd: date("week_end").notNull(),
  /** The full frozen brief (see Brief in src/lib/data/types.ts). Never rewritten. */
  payload: jsonb("payload").notNull(),
  narrative: text("narrative").notNull().default(""),
  coverage: jsonb("coverage").notNull(),
  generatedAt: ts("generated_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
  emailMessageId: text("email_message_id"),
});

export const ingestionLog = pgTable(
  "ingestion_log",
  {
    id: id(),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
    scope: text("scope", { enum: ["show", "episode", "api", "queue", "email"] }).notNull(),
    refId: text("ref_id"),
    refLabel: text("ref_label"),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ingestion_log_created_idx").on(t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Last runs of the two crons, for the System page. */
export const cronRuns = pgTable("cron_runs", {
  id: id(),
  name: text("name").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  outcome: text("outcome", { enum: ["ok", "partial", "failed"] }),
  summary: jsonb("summary"),
});

/** Estimated API usage per day: YouTube quota units, Gemini episodes and tokens. */
export const apiUsage = pgTable(
  "api_usage",
  {
    day: date("day").notNull(),
    key: text("key").notNull(),
    amount: integer("amount").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.key] })],
);

export const loginTokens = pgTable("login_tokens", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    keyHash: text("key_hash").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.keyHash, t.at)],
);

/** 24h cache for YouTube channel searches (each costs 100 quota units). */
export const searchCache = pgTable("search_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  expiresAt: ts("expires_at").notNull(),
});
