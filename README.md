# Podcast Intelligence

A weekly brief for a podcast host. It watches a list of startup and business podcasts (default 10) on **YouTube** and **Spotify**, and every Monday morning (about 7:00 AM IST) emails a short brief answering three questions:

1. **Guests:** who is appearing on several shows in a short time (a media round, so likely bookable) or drawing unusually high views?
2. **Topics:** which themes overlap across shows (what to cover, and where to do something different)?
3. **Sponsors:** which brands are paying for podcast ads right now?

A password-less admin dashboard has the full detail, history, and a show-swapping interface.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Drizzle + Neon Postgres · Gemini (`@google/genai`) · Resend · hosted on the **Vercel Hobby** plan (two crons, no other infrastructure).

## How it works

```
Vercel Cron #1  daily 19:00 UTC (00:30 IST)  GET /api/cron/worker
   1. queue one discovery job per active show
   2. run one job, then call POST /api/worker/next to run the next (self-chaining, each link is short)
      discover_show  -> new YouTube/Spotify episodes (only those published after the show was added)
      extract_episode-> Gemini reads the video (or title + description) -> guests, topics, sponsors
      weekly_analysis-> (Mondays IST) views refresh, dedupe, scoring, grounded narrative, frozen brief
Vercel Cron #2  Mondays 01:00 UTC (about 07:00 IST)  GET /api/cron/mailer
   sends the finished brief once (idempotent)
Dashboard       reads the same Neon database
```

The queue is a Postgres table (`jobs`) claimed with `FOR UPDATE SKIP LOCKED`. A job stuck running for more than 10 minutes is re-queued; a job fails for good after 2 attempts. If the chain ever breaks, press **Run worker now** on the System page, or wait for the next nightly cron.

## Run it locally

```bash
npm install
cp .env.example .env.local        # then fill in the values (see "Get your API keys")
npm run db:migrate                # creates the tables in Neon
npm run seed                      # adds the 10 default shows (prints the matches for you to confirm)
npm run seed:demo                 # optional: 5 weeks of dummy history + 5 briefs (see below)
npm run dev -- -p 3100
```

Open http://localhost:3100. Sign in with `ADMIN_EMAIL`. Until email is configured, the sign-in link is printed in the terminal running the dev server (never in production).

Useful commands:

| Command | What it does |
|---|---|
| `npm run worker:drain` | Runs tonight's whole job queue in this process and prints each step |
| `npm run seed:demo` | Dummy history for the last ~9 weeks and 5 weekly briefs (needs an empty database) |
| `npm run demo:clear` | Removes the demo episodes; `-- --all` empties every table to start clean |
| `npm test` | Unit tests |
| `npm run test:db` | Integration tests against your real Neon database (queue, swaps, login tokens) |
| `DATA_SOURCE=mock npm run dev` | Dashboard on built-in sample data, no database needed |

### About the demo data
`seed:demo` stores about nine weeks of **dummy** episodes (guests, companies, sponsors and episodes are invented; the shows are the real ones), then generates five weekly briefs through the real weekly pipeline. Every demo episode is flagged `is_demo`. Demo episode links open the show's real YouTube channel page, not a video. Real discovery starts from the moment you seed, so it never re-imports what the demo stands in for.

## Get your API keys

- **Neon:** create a project at neon.tech, copy the **pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`, then run `npm run db:migrate`.
- **YouTube:** Google Cloud Console > create a project > APIs & Services > enable **YouTube Data API v3** > Credentials > Create credentials > API key. The default quota is 10,000 units a day; a channel search costs 100 units, so searches are cached for 24 hours.
- **Gemini:** Google AI Studio > Get API key. See "Gemini free tier" below.
- **Spotify (optional):** developer.spotify.com/dashboard > Create app > copy the Client ID and Client Secret (client credentials flow, no user login). Without it, only YouTube is checked and Spotify-only shows can't be monitored.
- **Resend (optional until you want email):** resend.com > API Keys, and verify a sender domain or address. Put the key in `RESEND_API_KEY` and the sender in `EMAIL_FROM`. Sign-in links and the Monday brief both need it.
- `CRON_SECRET` and `SESSION_SECRET`: any long random strings (`openssl rand -hex 32`).

## Deploy to Vercel (Hobby)

1. Push the project to GitHub and import it in Vercel.
2. Under **Settings > Environment Variables** add every variable from `.env.example` (production). Set `APP_URL` to your production URL, for example `https://your-app.vercel.app`, with no trailing slash.
3. Run `npm run db:migrate` once from your machine (it uses the same `DATABASE_URL`) and `npm run seed` if the database is new.
4. Deploy. `vercel.json` already declares the two crons. Vercel sends `Authorization: Bearer $CRON_SECRET` to them automatically.
5. Open the site, sign in, check **System**, and press **Run worker now** once to confirm the queue runs.

Keep production deployment protection off for the production domain, because the worker calls its own `/api/worker/next` route over HTTP.

Hobby cron timing is only guaranteed within the scheduled hour, so the worker lands between about 00:30 and 01:29 IST and the mailer between about 06:30 and 07:29 IST. If the brief isn't ready when the mailer fires, it exits cleanly and the System page has **Send brief now**.

## Gemini free tier (important)

A free Gemini key allows about **20 requests per day per model** and 250,000 input tokens per minute. Each episode analysed costs one request, and a video uses roughly 45 to 50 tokens per second. To get the most out of it:

- The client rotates through `GEMINI_MODEL` then `GEMINI_FALLBACK_MODELS`; each model has its own daily allowance.
- When every model is exhausted, extraction jobs wait and resume automatically (they do not count as failures).
- Videos longer than `GEMINI_MAX_VIDEO_TOKENS` are analysed from title and description only, and labelled "Metadata only".
- With billing enabled these limits are far higher; raise `GEMINI_DAILY_EPISODE_LIMIT` if you want.

## Known limitations

- Sponsor detection covers **baked-in and host-read** placements and sponsor links in descriptions. **Dynamically inserted audio ads are not captured.** Audio-based detection is a reserved extension point (`src/lib/sources/rss.ts`), not built.
- View counts exist **only for YouTube**. Spotify episodes have none.
- Spotify-only episodes are analysed from title and description, which is the best possible without audio; they are labelled "Metadata only".
- Sample data and `seed:demo` rows are invented. The "Zero to Infinity" show could not be matched to a YouTube channel automatically; link the right one from the Shows page.

## Where things are

```
src/app/            routes: dashboard pages, /login, /api (cron, worker, auth, admin)
src/lib/db/         Drizzle schema and Neon client
src/lib/sources/    youtube.ts, spotify.ts, match.ts (dedupe), rss.ts (reserved stub)
src/lib/ai/         gemini.ts, prompts.ts, schemas.ts, normalize.ts
src/lib/pipeline/   queue, discover, extract, weekly, consolidate, narrative, worker
src/lib/services/   shows (swap/add/remove), briefs (read/send), show-search
src/lib/email/      Resend mailer and the brief template
src/lib/scoring.ts  pure scoring (spec 8.2), unit-tested
src/lib/data/       Repo interface; db/ (Neon) and mock/ (sample data) implementations
scripts/            seed, seed-demo, demo-clear, worker-drain, migrate
DECISIONS.md        every non-obvious decision, with the reason
```
