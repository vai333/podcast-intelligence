// Validates environment variables once, with clear messages. Secrets never reach the client:
// this module is server-only (nothing under src/components imports it).
import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blank, s.optional());

const Schema = z.object({
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required (Neon pooled connection string)"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be a long random string"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ADMIN_USERNAME: z.preprocess(blank, z.string().default("admin")),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  ADMIN_EMAIL: opt(z.string().email()),
  APP_URL: z.string().url("APP_URL must be a full URL, e.g. https://your-app.vercel.app"),
  YOUTUBE_API_KEY: z.string().min(10, "YOUTUBE_API_KEY is required"),
  GEMINI_API_KEY: z.string().min(10, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.preprocess(blank, z.string().default("gemini-3.8-flash")),
  /**
   * Tried in order when the primary model is rate limited or overloaded. Each model has its own free-tier
   * quota, so more models means more daily capacity.
   */
  GEMINI_FALLBACK_MODELS: z.preprocess(blank, z.string().default("gemini-3.6-flash,gemini-3.5-flash")),
  /** Videos expected to need more input tokens than this are analysed from title and description instead. */
  GEMINI_MAX_VIDEO_TOKENS: z.preprocess(blank, z.coerce.number().int().min(10_000).default(230_000)),
  GEMINI_DAILY_EPISODE_LIMIT: z.preprocess(blank, z.coerce.number().int().min(1).default(40)),
  SEED_BACKFILL_DAYS: z.preprocess(blank, z.coerce.number().int().min(0).default(7)),
  // Optional until configured. Features that need them switch off with a clear message.
  SPOTIFY_CLIENT_ID: opt(z.string()),
  SPOTIFY_CLIENT_SECRET: opt(z.string()),
  RESEND_API_KEY: opt(z.string()),
  EMAIL_FROM: opt(z.string()),
  BRIEF_RECIPIENTS: opt(z.string()),
  DATA_SOURCE: z.preprocess(blank, z.enum(["db", "mock"]).default("db")),
});

export type Env = z.infer<typeof Schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${lines}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export const spotifyEnabled = () => !!env().SPOTIFY_CLIENT_ID && !!env().SPOTIFY_CLIENT_SECRET;
export const emailEnabled = () => !!env().RESEND_API_KEY && !!env().EMAIL_FROM;

export function briefRecipients(): string[] {
  const e = env();
  const list = (e.BRIEF_RECIPIENTS ?? e.ADMIN_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list;
}
