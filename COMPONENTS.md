# Podcast Intelligence · Components Map

A weekly brief for a podcast host. The app watches a list of YouTube podcasts, reads every new episode with AI, and every Monday morning tells the host **who to book, what to cover, and who is sponsoring**.

## 1. Components map

Read each row left to right: who does what, at which stage.

| Actor | Trigger | Input | Context | Processing | AI | Output |
|---|---|---|---|---|---|---|
| **Host / Admin**<br>(Aditya, signed in) | Opens the dashboard, or the Monday email arrives | Username + password; searches for a show to add or swap | The 10 monitored shows, past briefs, settings | Add / swap / remove a show; press **Run worker now** or **Send brief now** | — | Reads the brief, copies a booking note, sees system health |
| **Cron + Worker**<br>(Vercel) | Daily **19:00 UTC (00:30 IST)**; Mondays **01:00 UTC (~07:00 IST)** | One discovery job per active show | Each show's cursor (`last_seen_published_at`) and the date it was added (`active_from`) | Queue → run one job → call itself for the next (self-chaining) | — | Jobs finished, run summary on the System page |
| **YouTube**<br>(Data API v3) | Worker asks for new uploads | Channel's uploads playlist | Only videos published **after** the show was added | Fetch details (length, views); drop clips under 15 min; flag episodes over 120 min as skipped | — | New `episodes` rows + first view snapshot |
| **AI Model**<br>(Gemini) | An `extract_episode` job runs | The public YouTube URL (video), or title + description (fallback) | Prompt rules: guests ≠ host, specific topics, only *paid* sponsors | Validate JSON; retry once; rotate to a fallback model if limited | Reads the episode: **guests, topics, sponsors** with a quote and timestamp; later merges duplicates and writes the weekly summary | Validated facts saved per episode |
| **Database**<br>(Neon Postgres) | Every step above | Episodes, people, topics, sponsors, jobs, briefs, logs | Show **intervals** (when each show was monitored) | Normalise names, dedupe YouTube↔duplicates, enforce the active-interval rule | — | Frozen weekly **brief** that never changes |
| **Email Service**<br>(Resend) | Monday mailer cron, or **Send brief now** | The finished brief | Recipients from `BRIEF_RECIPIENTS` | Build HTML + plain text; escape all third-party text | — | One email: summary, top guests, topics, sponsors, "Open full dashboard" |

> **Scope:** YouTube podcasts only. Spotify support exists in the code but is switched off (no keys). Audio is never downloaded, and dynamically inserted audio ads are not detected.

---

## 2. The end-to-end flow

```
            ┌──────────────── every night, 00:30 IST ────────────────┐
            │                                                        │
Cron #1 ──► startRun ──► 1 discover_show job per active show          │
            │                                                        │
            ▼                                                        │
      processOne()  ── claims ONE job (FOR UPDATE SKIP LOCKED)        │
            │            then calls POST /api/worker/next (chain)    │
            ▼                                                        │
  discover_show ──► YouTube: uploads since the show's cursor          │
            │        • under 15 min  → ignored                       │
            │        • over 120 min  → stored as "skipped"           │
            │        • else          → new episode + extract job     │
            ▼                                                        │
  extract_episode ─► Gemini reads the video ─► guests / topics /      │
            │         sponsors ─► normalised and saved               │
            ▼                                                        │
  (Monday IST) weekly_analysis  — waits until all other jobs finish   │
            │  1. refresh YouTube view counts (new snapshot)         │
            │  2. consolidate duplicates with Gemini                 │
            │  3. score guests, topics, sponsors                     │
            │  4. Gemini writes a grounded summary + angles          │
            │  5. save the FROZEN brief (one per week)               │
            └────────────────────────────────────────────────────────┘

Cron #2 (Mon ~07:00 IST) ──► send the brief once ──► Resend ──► inbox
```

If the chain ever breaks, **Run worker now** restarts it, and the next nightly cron resumes anything still pending.

---

## 3. What the AI does (and what it must not do)

| Step | Input | Output | Guard rails |
|---|---|---|---|
| **Extract** (per episode) | Video by URL (1 frame / 4 s, low resolution) + title + description | Guests, 3–6 topics, sponsors with a ≤25-word verbatim quote + timestamp | Sponsors = paid promotions only, never brands merely discussed. Output is validated; one retry with the error; then fail |
| **Fallback** | Title + description only | Same JSON, labelled **Metadata only** / low confidence | Used when the video is private, blocked, or too long for the token limit |
| **Consolidate** (weekly) | New names/labels + existing ones | Which records are the same person / brand / topic | Merges only when `confident`, only ids we sent; older record is kept; aliases recorded |
| **Summarise** (weekly) | The computed JSON (never transcripts) | 3–5 "What matters" bullets + one counter-programming angle per topic | Names appear only as `[guest:ID]` tokens that we replace; any bullet with an unknown id is dropped |

AI output is **untrusted**: it is validated, length-limited, and never rendered as HTML.

---

## 4. How the brief is scored

Window: a 30-day lookback, but a guest/topic must have at least one episode in the **last 7 days**. Only episodes published while their show was **active** count.

| Section | Counts as trending when | Score |
|---|---|---|
| **Guests** | On **2+ shows** (a media round) **or** top 10% by views | `0.6 × min(shows/3, 1) + 0.4 × views` |
| **Topics** | On **2+ shows**, **3+ episodes** | `0.5 × min(shows/4, 1) + 0.3 × min(eps/6, 1) + 0.2 × views`; marked **Rising** if this week beats the prior 3-week average |
| **Sponsors** | Seen in the last 7 days | Ranked by distinct shows, then views; **New** vs **Returning** |

On screen the numbers are shown as **Strong / Medium / Emerging** plus plain reasons ("3 shows in 9 days · top 4% by views").

---

## 5. Show lineup rules (swap / add / remove)

| Action | What happens | What never happens |
|---|---|---|
| **Add** | New row, tracked from *now*; blocked at the cap (default 10) | No backfill of old episodes |
| **Swap** | One transaction: old show closed (`active_to = now`), new one opened | Nothing deleted; past briefs untouched |
| **Remove** | `active_to = now`; shown under *Past shows* | Episodes, guests, sponsors all kept |
| **Re-add** | A **new** row with the same channel ID (a new tracking period) | The earlier period is not altered |

---

## 6. Screens

| Screen | Purpose |
|---|---|
| **Home** | A full-screen scroll story first: particles morph from a microphone (with the live "Monitoring N shows" heartbeat) into a sketched guest's head (construction-drawing style), a topic network and a sponsor beacon, each with its count and top three. Then the brief: week selector, "What matters" summary, and three buttons (Guests · Topics · Sponsors) |
| **Guests / Topics / Sponsors (this week)** | Ranked rows with evidence, links to the source episode, copy-ready booking note / episode idea |
| **Past briefs** | Every week, frozen exactly as it was sent |
| **Explore** | All-time guests, topics (12-week chart + heatmap), sponsors |
| **Shows** | Lineup, swap flow, lineup-history timeline |
| **Episodes** | Status, analysis depth, views, re-run extraction |
| **System** | Queue counts, last cron runs, API usage, log, Run worker now, Send brief now |
| **Settings** | Show cap, episode length limits, lookback days |

All times are shown in **IST**.

---

## 7. Safety and failure handling

| Concern | How it is handled |
|---|---|
| **Access** | Username + password → signed, httpOnly, 30-day sliding cookie. Middleware protects every `/dashboard` page and `/api/admin` route; every server action re-checks. Failed logins are limited to 5 per 15 min |
| **Cron routes** | Require `Authorization: Bearer CRON_SECRET`, otherwise 401 |
| **One failure never stops a run** | Each show, episode, API and AI call is wrapped; the failure is logged and the run continues |
| **Retries** | A job gets 2 attempts, then is marked failed (retry button on System). A job stuck "running" for 10 min is re-queued |
| **AI rate limits** | Not a failure: the job waits and resumes; daily limits defer *all* pending extractions at once. Models rotate (primary → two fallbacks) |
| **YouTube quota** | Usage is tracked; discovery pauses before the daily limit; channel searches are cached 24 h |
| **Idempotent** | One brief per week; sending twice is blocked unless you choose **Resend** |
| **Secrets** | Server-only environment variables; never logged or sent to the browser |

---

## 8. Data at a glance

```
shows ──< episodes ──< view_snapshots          (views over time, never overwritten)
              │   ├──< episode_guests >── guests ──< guest_aliases
              │   ├──< episode_topics >── topics ──< topic_aliases
              │   ├──< episode_sponsors >── sponsors ──< sponsor_aliases
              │   └── extractions                (raw AI result + token usage)
jobs            queue (discover / extract / refresh / weekly)
briefs          one frozen row per week (payload, narrative, coverage, sent_at)
ingestion_log   every skip and failure
cron_runs · api_usage · settings · login_attempts · search_cache
```

---

## 9. Known limits

- **Sponsors:** only baked-in / host-read ads and description links are caught. Ads inserted dynamically by the podcast host are invisible.
- **Views:** exist only for YouTube.
- **Gemini free tier:** about 20 requests per day per model and 250K tokens per minute, so throughput is modest until billing is enabled.
- **Metadata-only episodes** are labelled; guests or sponsors spoken only in the audio may be missing from them.
- **Demo data** (`npm run seed:demo`) is invented and flagged `is_demo`; `npm run demo:clear` removes it.

---

## 10. Where to look in the code

| Concern | Path |
|---|---|
| Cron + worker routes | `src/app/api/cron/*`, `src/app/api/worker/next` |
| Queue, discovery, extraction, weekly | `src/lib/pipeline/*` |
| YouTube client, dedupe | `src/lib/sources/*` |
| Gemini client, prompts, schemas | `src/lib/ai/*` |
| Scoring (pure, tested) | `src/lib/scoring.ts` |
| Lineup changes, brief reading and sending | `src/lib/services/*` |
| Email template | `src/lib/email/*` |
| Login | `src/lib/auth/*`, `src/middleware.ts` |
| Pages and components | `src/app/dashboard/*`, `src/components/*` |
| Home scroll story (WebGL) | `src/components/home/*` |
| Decisions and reasons | `DECISIONS.md` |
