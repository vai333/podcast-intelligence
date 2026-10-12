// The single seam between the UI and data. The mock implementation lives in ./mock;
// the real Drizzle/Neon one will implement this same interface.
import type {
  ActionResult,
  Brief,
  BriefListItem,
  EpisodeQuery,
  EpisodeRow,
  GuestDetail,
  GuestListItem,
  Lineup,
  LogEntry,
  Paged,
  Settings,
  ShowCandidate,
  SponsorDetail,
  SponsorListItem,
  SystemStatus,
  TopicDetail,
  TopicsOverview,
} from "./types";

export interface Meta {
  now: string; // the app's notion of "now" (ISO UTC)
  isSample: boolean; // true while running on mock data
  lastDataAt: string; // when data last changed (freshness chip)
}

export interface Repo {
  meta(): Promise<Meta>;

  getLatestBrief(): Promise<Brief | null>;
  getBrief(weekStart: string): Promise<Brief | null>;
  listBriefs(): Promise<BriefListItem[]>;

  listGuests(q?: string): Promise<GuestListItem[]>;
  getGuest(id: string): Promise<GuestDetail | null>;
  getTopicsOverview(): Promise<TopicsOverview>;
  getTopic(id: string): Promise<TopicDetail | null>;
  listSponsors(): Promise<SponsorListItem[]>;
  getSponsor(id: string): Promise<SponsorDetail | null>;

  getLineup(): Promise<Lineup>;
  searchShows(q: string): Promise<ShowCandidate[]>;

  listEpisodes(q: EpisodeQuery): Promise<Paged<EpisodeRow>>;

  getSystemStatus(): Promise<SystemStatus>;
  getLogs(opts?: { level?: LogEntry["level"] }): Promise<LogEntry[]>;
  getSettings(): Promise<Settings>;

  mutations: {
    swapShow(outShowId: string, candidate: ShowCandidate): Promise<ActionResult>;
    addShow(candidate: ShowCandidate): Promise<ActionResult>;
    removeShow(showId: string): Promise<ActionResult>;
    readdShow(showId: string): Promise<ActionResult>;
    runWorkerNow(): Promise<ActionResult>;
    sendBriefNow(opts: { resend: boolean }): Promise<ActionResult>;
    rerunExtraction(episodeId: string): Promise<ActionResult>;
    retryFailedJobs(): Promise<ActionResult>;
    saveSettings(s: Settings): Promise<ActionResult>;
  };
}
