// The contract between pages and data. Pages import ONLY these types and `repo`.
// The mock repo and the future Drizzle/Neon repo both return exactly these shapes.
import { z } from "zod";

export const Heat = z.enum(["strong", "medium", "emerging"]);
export type Heat = z.infer<typeof Heat>;

export const Placement = z.enum([
  "host_read",
  "pre_roll",
  "mid_roll",
  "post_roll",
  "description_link",
  "on_screen",
  "unknown",
]);
export type Placement = z.infer<typeof Placement>;

export const AnalysisDepth = z.enum(["video", "metadata"]);
export type AnalysisDepth = z.infer<typeof AnalysisDepth>;

export const EpisodeStatus = z.enum(["discovered", "extracted", "skipped", "failed"]);
export type EpisodeStatus = z.infer<typeof EpisodeStatus>;

/** A link back to the source episode on each platform. */
export const EpisodeRef = z.object({
  episodeId: z.string(),
  showId: z.string(),
  showName: z.string(),
  title: z.string(),
  publishedAt: z.string(), // ISO UTC
  views: z.number().nullable(), // YouTube only
  depth: AnalysisDepth,
  youtubeUrl: z.string().nullable(),
  spotifyUrl: z.string().nullable(),
});
export type EpisodeRef = z.infer<typeof EpisodeRef>;

/* ------------------------------ Brief ------------------------------ */

export const Coverage = z.object({
  episodesFound: z.number(),
  analyzedVideo: z.number(),
  analyzedMetadata: z.number(),
  skippedOrFailed: z.number(),
});
export type Coverage = z.infer<typeof Coverage>;

export const BriefGuest = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  aliases: z.array(z.string()),
  rank: z.number(),
  heat: Heat,
  trendScore: z.number(),
  showsCount: z.number(),
  spanDays: z.number(), // days between first and last appearance in lookback
  mediaRound: z.boolean(),
  viewsPercentile: z.number(), // 0..100, share of lookback episodes with fewer views
  topViews: z.number().nullable(),
  components: z.object({ shows: z.number(), views: z.number() }),
  appearances: z.array(EpisodeRef),
});
export type BriefGuest = z.infer<typeof BriefGuest>;

export const BriefTopic = z.object({
  id: z.string(),
  label: z.string(),
  rank: z.number(),
  heat: Heat,
  trendScore: z.number(),
  showsCount: z.number(),
  episodesCount: z.number(),
  rising: z.object({ thisWeek: z.number(), prevAvg: z.number() }).nullable(),
  shows: z.array(z.string()),
  episodes: z.array(EpisodeRef),
  counterAngle: z.string().nullable(), // AI-written
  components: z.object({ shows: z.number(), episodes: z.number(), views: z.number() }),
});
export type BriefTopic = z.infer<typeof BriefTopic>;

export const SponsorMention = z.object({
  episode: EpisodeRef,
  product: z.string().nullable(),
  placement: Placement,
  evidence: z.string(),
  timestampSeconds: z.number().nullable(),
  source: z.enum(["video", "description"]),
});
export type SponsorMention = z.infer<typeof SponsorMention>;

export const BriefSponsor = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["new", "returning"]),
  firstSeenAt: z.string(),
  showsCount: z.number(),
  totalViews: z.number(),
  placements: z.array(Placement),
  mentions: z.array(SponsorMention),
});
export type BriefSponsor = z.infer<typeof BriefSponsor>;

export const EmergingTopic = z.object({
  id: z.string(),
  label: z.string(),
  showsCount: z.number(),
  episodesCount: z.number(),
  needs: z.string(), // plain-language gap, e.g. "1 more show"
});
export type EmergingTopic = z.infer<typeof EmergingTopic>;

export const LineupChange = z.object({
  kind: z.enum(["added", "removed"]),
  showName: z.string(),
  at: z.string(),
});
export type LineupChange = z.infer<typeof LineupChange>;

export const SummaryBullet = z.object({
  text: z.string(),
  refs: z.array(z.object({ kind: z.enum(["guest", "topic", "sponsor"]), id: z.string(), label: z.string() })),
});
export type SummaryBullet = z.infer<typeof SummaryBullet>;

export const Brief = z.object({
  weekStart: z.string(), // Monday, YYYY-MM-DD IST
  weekEnd: z.string(),
  generatedAt: z.string(),
  sentAt: z.string().nullable(),
  isLatest: z.boolean(),
  isFirstWeek: z.boolean(), // no prior weeks: hides New/Returning
  coverage: Coverage,
  lineupChanges: z.array(LineupChange),
  summary: z.array(SummaryBullet),
  guests: z.array(BriefGuest),
  topics: z.array(BriefTopic),
  emergingTopics: z.array(EmergingTopic),
  sponsors: z.array(BriefSponsor),
  prevWeek: z.string().nullable(),
  nextWeek: z.string().nullable(),
});
export type Brief = z.infer<typeof Brief>;

export const BriefListItem = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  generatedAt: z.string(),
  sentAt: z.string().nullable(),
  coverage: Coverage,
  guestsCount: z.number(),
  topicsCount: z.number(),
  sponsorsCount: z.number(),
  headline: z.string(),
});
export type BriefListItem = z.infer<typeof BriefListItem>;

/* ------------------------------ Explorers ------------------------------ */

export const GuestListItem = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  appearances: z.number(),
  showsCount30d: z.number(),
  lastSeen: z.string(),
  topViews: z.number().nullable(),
  mediaRound: z.boolean(),
});
export type GuestListItem = z.infer<typeof GuestListItem>;

export const GuestDetail = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  aliases: z.array(z.string()),
  mediaRound: z.boolean(),
  showsCount30d: z.number(),
  spanDays: z.number(),
  viewsPercentile: z.number(),
  heat: Heat.nullable(),
  appearances: z.array(EpisodeRef), // newest first, all time
  lane: z.array(z.object({ showId: z.string(), showName: z.string() })), // shows he appeared on, for swimlane rows
});
export type GuestDetail = z.infer<typeof GuestDetail>;

export const TopicListItem = z.object({
  id: z.string(),
  label: z.string(),
  weekly: z.array(z.number()), // episode count per week, oldest -> newest (12)
  total: z.number(),
  showsCount30d: z.number(),
  rising: z.boolean(),
});
export type TopicListItem = z.infer<typeof TopicListItem>;

export const TopicsOverview = z.object({
  weeks: z.array(z.string()), // week-start ISO dates, oldest -> newest
  items: z.array(TopicListItem),
});
export type TopicsOverview = z.infer<typeof TopicsOverview>;

export const TopicDetail = z.object({
  id: z.string(),
  label: z.string(),
  aliases: z.array(z.string()),
  weeks: z.array(z.string()),
  weekly: z.array(z.number()),
  shows: z.array(z.string()),
  episodes: z.array(EpisodeRef),
});
export type TopicDetail = z.infer<typeof TopicDetail>;

export const SponsorListItem = z.object({
  id: z.string(),
  name: z.string(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  showsCount: z.number(),
  mentionsCount: z.number(),
  placements: z.array(Placement),
  activeThisWeek: z.boolean(),
});
export type SponsorListItem = z.infer<typeof SponsorListItem>;

export const SponsorDetail = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  firstSeenAt: z.string(),
  weekly: z.array(z.number()),
  weeks: z.array(z.string()),
  mentions: z.array(SponsorMention),
});
export type SponsorDetail = z.infer<typeof SponsorDetail>;

/* ------------------------------ Shows ------------------------------ */

export const Interval = z.object({ from: z.string(), to: z.string().nullable() });
export type Interval = z.infer<typeof Interval>;

export const Show = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  artworkUrl: z.string().nullable(),
  youtube: z.object({ channelId: z.string(), handle: z.string(), subscribers: z.number() }).nullable(),
  spotify: z.object({ showId: z.string() }).nullable(),
  intervals: z.array(Interval),
  active: z.boolean(),
  episodes30d: z.number(),
  lastEpisodeAt: z.string().nullable(),
  health: z.enum(["ok", "quiet", "error"]),
  healthNote: z.string().nullable(),
  pastEpisodeCount: z.number(),
});
export type Show = z.infer<typeof Show>;

export const ShowCandidate = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  artworkUrl: z.string().nullable(),
  youtube: z.object({ channelId: z.string(), handle: z.string(), subscribers: z.number() }).nullable(),
  spotify: z.object({ showId: z.string(), publisher: z.string() }).nullable(),
  matchNote: z.string(),
  matchConfidence: z.enum(["high", "check"]),
});
export type ShowCandidate = z.infer<typeof ShowCandidate>;

export const Lineup = z.object({
  active: z.array(Show),
  past: z.array(Show),
  maxActive: z.number(),
  now: z.string(),
  windowStart: z.string(),
  changes: z.array(z.object({ at: z.string(), kind: z.enum(["added", "removed"]), showName: z.string() })),
});
export type Lineup = z.infer<typeof Lineup>;

/* ------------------------------ Episodes ------------------------------ */

export const EpisodeRow = z.object({
  id: z.string(),
  showId: z.string(),
  showName: z.string(),
  title: z.string(),
  publishedAt: z.string(),
  durationMin: z.number(),
  views: z.number().nullable(),
  depth: AnalysisDepth,
  status: EpisodeStatus,
  statusNote: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  spotifyUrl: z.string().nullable(),
  guests: z.array(z.string()),
  topics: z.array(z.string()),
  sponsors: z.array(z.string()),
});
export type EpisodeRow = z.infer<typeof EpisodeRow>;

export interface EpisodeQuery {
  show?: string;
  status?: EpisodeStatus;
  depth?: AnalysisDepth;
  sort?: "published" | "views";
  page?: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ------------------------------ System ------------------------------ */

export const SystemStatus = z.object({
  verdict: z.enum(["ok", "attention"]),
  verdictText: z.string(),
  worker: z.object({ state: z.enum(["idle", "running"]), lastRunAt: z.string().nullable() }),
  queue: z.object({ pending: z.number(), running: z.number(), failed: z.number(), done: z.number(), skipped: z.number() }),
  cron: z.array(
    z.object({
      name: z.string(),
      schedule: z.string(),
      lastRunAt: z.string().nullable(),
      outcome: z.enum(["ok", "partial", "failed"]).nullable(),
      summary: z.string(),
    }),
  ),
  quota: z.object({
    youtubeUnitsUsed: z.number(),
    youtubeUnitsLimit: z.number(),
    geminiEpisodesToday: z.number(),
    geminiEpisodesLimit: z.number(),
    weeklyTokens: z.number(),
  }),
  recipients: z.array(z.string()),
  latestBriefWeek: z.string().nullable(),
  latestBriefSent: z.boolean(),
});
export type SystemStatus = z.infer<typeof SystemStatus>;

export const LogEntry = z.object({
  id: z.string(),
  at: z.string(),
  level: z.enum(["info", "warn", "error"]),
  scope: z.enum(["show", "episode", "api", "queue", "email"]),
  message: z.string(),
  refLabel: z.string().nullable(),
});
export type LogEntry = z.infer<typeof LogEntry>;

export const Settings = z.object({
  maxActiveShows: z.number().int().min(1).max(25),
  minEpisodeMinutes: z.number().int().min(1).max(600),
  maxEpisodeMinutes: z.number().int().min(1).max(600),
  trendLookbackDays: z.number().int().min(7).max(90),
  adminEmail: z.string(),
});
export type Settings = z.infer<typeof Settings>;

export type MockScenario = "full" | "first-week" | "empty";

export interface ActionResult {
  ok: boolean;
  message: string;
}
