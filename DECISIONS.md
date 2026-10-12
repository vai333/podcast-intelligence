# Decisions

Front-end phase. The backend (Neon, cron, Gemini, Resend) is not built yet. Every item below is a choice made while designing the dashboard, with the reason and what was rejected.

## Home is a summary plus three doors (changed after review)
- **What:** `/dashboard` (and each past week's home) shows only the "What matters this week" summary, a compact trust line (coverage, lineup changes) and three large buttons: Guests, Topics, Sponsors. Each button opens that section for the same week at `/dashboard/briefs/[week]/guests|topics|sponsors`, with a week selector, a tab switch between the three sections, and a link to the all-time explorer.
- **Why:** The first version put all three ranked lists on one scrolling page, which the reviewer found chaotic. A short summary with clear entry points is calmer and still answers "what happened" in seconds.
- Each button carries a count and a one-line teaser (for example "Priya Raghavan is on 3 shows") so it says what is inside without listing it.
- The "Brief" nav item stays highlighted on the latest week's section pages (`onLatestBrief` in `nav-config.ts`).

## Home opens with a scroll story, then the brief (changed after review)
- **What:** The home page now starts with a full-screen WebGL particle story (`src/components/home/*`). As the page scrolls, about 56,000 particles (38,000 on phones) morph from a studio microphone (we are listening) into a head and shoulders (Guests), a network globe (Topics) and a broadcast beacon (Sponsors). Each chapter shows its count and top three, with a button into that section. The brief's header, summary and the three section cards follow underneath.
- **How it looks sharp:** particles are small crisp discs, each lit like a point on a solid surface (key, fill and rim light from per-point normals), the far side of a solid is dimmed, and a sparse additive glow pass plus distant stars add depth. Points are ordered along a Z-order curve, so the morph flows instead of scrambling. The scroll holds still briefly on each chapter.
- **The guest** is modelled on a classic construction drawing of a man's head (Loomis method), in three-quarter view turned towards the text: a long, lean face with a forward-projecting chin clear of the neck, a buzz cut (darker, denser, slightly fuzzy points with a natural hairline), flattened side planes, strong brow, open almond eyes, angular nose, cheekbones and a square jaw, the ear, and a neck with its two diagonal muscles, no shoulders. Like the drawing, it is mostly lines: bright pencil-style strokes trace the brows, eyelids, nose, lips, jaw, chin, ear and neck, and the construction lines (centre line, brow line, side circle) are drawn in the accent colour. Strokes are marked by an albedo above 1 (1.25 stroke, 1.5 guide), which the shader draws at full brightness whatever the lighting.
- **Light theme** draws solid, slightly larger ink dots (shadows near-black, lit areas warm grey, edges in the accent) because dots on a pale background cannot add up into light the way they do on black.
- The point clouds are generated in a Web Worker (about 0.4 s), so the page stays responsive while they build.
- **Cost and fallbacks:** three.js loads only on the home page, in its own chunk, after the page is interactive. With reduced motion, or without WebGL, the story is replaced by a plain intro. "Skip to the brief" is always visible.

## Visual theme: near-black with an orange accent (changed after review)
- **What:** Dark is now the default theme (light is the alternate), with near-black surfaces, thin borders, an orange accent, bold white headings, small orange "eyebrow" labels above headings, and Plus Jakarta Sans. This follows the reference image the reviewer supplied. Tokens live in `src/app/globals.css` and mirror in `src/lib/tokens.ts`.
- **Buttons and active states use dark text on the orange** in dark mode. White on that orange is only about 3:1, which fails the 4.5:1 text rule. Light mode uses a deeper orange (`#c2410c`) with white text.
- **Top navigation bar** (changed after review; it was a left sidebar). Seven items sit in the bar, and System and Settings are under an Admin menu. Tablets show icons only; phones keep the bottom bar. "All times IST" and data freshness moved to the page footer.
- No photographs are used; the hero has a soft orange glow instead.

## Design direction: "Briefing Scroll, console underneath"
- **What:** The brief's section pages are a single reader column (about 760px) of ranked rows with no cards and no charts. Guests, topics, sponsors, shows, episodes and system pages use the same tokens but are denser, with tables and charts.
- **Why:** The product exists so Aditya can answer three questions in two minutes on a Monday morning, often on a phone. A reader layout mirrors the email and scans fastest. Tables and charts only earn their place on the explorer pages.
- **Rejected:** a dense analytics console as the base (fails the 2-minute scan and mobile); a card/bento workspace (nested cards waste space and elevation is costly in dark mode); a tabbed 3-pane view (hides two of the three answers); one mixed "insight inbox" feed (guest, topic and sponsor scores are not comparable).
- Both a Chief Design Engineer and a UI/UX expert evaluated three branches each and independently reached this structure.

## Scores are hidden on the brief
- **What:** Rows show rank, a heat label (Strong / Medium / Emerging) and "because" chips such as "3 shows in 12 days" and "Top 4% by views". Raw numbers only appear in the "Why ranked here" popover.
- **Why:** A bare 0.73 is false precision and gives no reason to act. Rank plus evidence is more trustworthy.
- Heat bands: score at or above 0.7 is Strong, at or above 0.45 is Medium, otherwise Emerging (`heatFor` in `src/lib/scoring.ts`). These thresholds are a first guess and should be tuned on real data.

## Session length: 30 days, sliding (deviates from the spec's 7 days)
- **Why:** Aditya reads weekly, so a 7-day cookie would force a fresh magic-link login on almost every Monday. The user chose this.
- **Not built yet:** auth is visual only. The login page shows the same generic message whether or not the address matches (so the admin is not revealed).

## The data seam
- Pages import only `repo` and the DTO types from `src/lib/data`. `repo` is one async interface (`src/lib/data/repo.ts`).
- The mock lives in `src/lib/data/mock/`. The real Drizzle/Neon implementation will implement the same interface in `src/lib/data/db/`, so swapping is a one-line change in `src/lib/data/index.ts`.
- `src/lib/scoring.ts` is pure (no I/O) and follows spec section 8.2. The backend should reuse it unchanged. It has unit tests including a swap that happens mid-window.
- Briefs are frozen when created. Swapping a show later never changes a past brief (spec section 9).
- A "Sample data" switcher in the top bar shows three scenarios: 12 weeks of history, first week only, and brand new with no data. It is mock-only and is deleted with the mock.
- Mock "now" is fixed at Mon 12 Oct 2026, 7:10 AM IST so the data is identical on every render. Mutations advance it by 3 minutes each.

## Sample data is clearly fake
- Show names are the real seed list from the spec. Every episode, guest, company, sponsor and episode link is invented, and a banner says so. Links point to placeholder IDs and will not open real videos.

## Dates
- `src/lib/time.ts` is the only place dates are formatted. IST is UTC+5:30 with no DST, so it shifts by a fixed offset and reads UTC fields. It does not use `Intl` for dates, so server and client can never disagree (no hydration mismatches).

## Swap flow
- Inline Swap on each show row opens one side sheet (full screen on mobile): Search, Pair, Replace. The final confirmation lists, in plain words, that it is effective now, there is no backfill, history is kept and past briefs are frozen. There is deliberately no type-to-confirm, because nothing is deleted.
- Pairing a YouTube channel with a Spotify show shows a match note and lets each link be cleared. Spotify-only shows are warned about up front, since they are analysed from title and description only.
- Re-adding a past show starts a new tracking period (a new interval on the same show), with no backfill. The mock stores several intervals per show; the real schema should use an `intervals` table (open question in spec section 9).

## Charts
- Recharts is loaded lazily only on pages that draw a chart, inside a fixed-height box. The brief page ships none of it.
- Every chart has a "View as table" toggle. Animation is off, which also covers reduced-motion.
- The guest page uses a lightweight SVG swimlane (one row per show, one dot per episode, size by views) instead of a line chart, because it shows a media round at a glance.
- The Topics page charts only the top 5 topics as lines with distinct dash patterns. Grouping the rest as "Other" made one grey block dominate, so the full list is in the heatmap table instead.

## Accessibility
- Colour is never the only cue: every badge has an icon and text, lines have dash patterns, and charts have table views.
- Text contrast is at least 4.5:1 in both themes. `src/lib/tokens.test.ts` enforces it for every text/background token pair.
- Dialogs, popovers, menus and tooltips use Radix primitives for correct focus handling.
- Axe (WCAG 2.1 AA plus best practices) was run on every route in the original theme, then again on the home, section, shows, system and topics pages after the restyle in both dark and light: no violations remain.

## Known gaps
- No real auth, database, cron or email yet.
- Guest merge/rename is a disabled button (a placeholder until the backend exists).
- Near-miss "Emerging" topics need the backend payload to include them.
- The mobile brief is dense: guest rows show two episodes and wrap their action buttons. Worth a second pass after real data is in.
- Sponsor detection (and so the Sponsors section) covers baked-in and host-read placements and description links only. Dynamically inserted audio ads are not captured, and the UI says so.


---

# Backend decisions

## Gemini model: `gemini-3.8-flash`, with fallback models
- **What:** The spec's default `gemini-2.5-flash` is retired for new API keys (the API answers "no longer available to new users"). The default is now `gemini-3.8-flash`, then `GEMINI_FALLBACK_MODELS` (`gemini-3.6-flash,gemini-3.5-flash`) are tried in order when a model is rate limited or overloaded.
- **Why:** The supplied key is on the free tier, which allows about 20 requests per day **per model**, and the primary model also returns 503 under load. A model chain triples daily capacity and made every real test succeed.
- **Rejected:** a single model (stalls whenever that one model's quota or availability runs out).

## Cost and rate-limit handling
- A 429 is not a failure: the job is deferred (without counting an attempt) until the quota resets, and when the quota is a daily one every pending extraction is deferred at once, so they don't each burn a request.
- Video frames are sampled at 0.25 fps (one every 4 seconds) on top of low media resolution. Podcast value is in the audio, and this cut a real 59-minute episode from 321K to 148K input tokens.
- Videos expected to exceed `GEMINI_MAX_VIDEO_TOKENS` (default 230,000, just under the free tier's 250K tokens/minute) are analysed from title and description instead of retrying forever.

## Shorts and clips are ignored, not stored
- **What:** Uploads shorter than `min_episode_minutes` are skipped silently. Only episodes **longer** than the maximum are stored as `skipped` (and logged).
- **Why:** Real channels post many clips (The Neon Show had 50 uploads in 3 weeks, mostly under a minute). Storing each as a skipped episode would flood the Episodes page and make "analyzed X of Y" meaningless.

## Row-per-interval for show history
- **What:** Each tracking period is one `shows` row with `active_from` / `active_to`. Re-adding a show creates a new row with the same channel and Spotify IDs. The dashboard groups rows by channel ID so a re-added show appears once, with several intervals.
- **Why:** It matches the spec's schema exactly and keeps history accurate without a separate table. Chosen over an `intervals` table for simplicity (spec section 9 allowed either).
- Swaps run in one transaction guarded by an advisory lock, so the cap and duplicate checks cannot race.

## Job statuses
- A job that uses up its 2 attempts is marked `failed` (shown in the System queue and retryable). `skipped` is used for jobs that had nothing to do (for example a show removed after its job was queued). The spec said exhausted jobs become `skipped`; `failed` is more honest for the dashboard.
- The weekly analysis is held back until every other ready or running job has finished, so it never sees half-processed data.
- Catch-up: besides Mondays, the nightly run also queues last week's brief if it is missing and that week has analysed episodes (so a missed Monday heals itself).

## Grounded narrative
- Gemini may name a guest, topic or sponsor only through id tokens like `[guest:ID]`, which we replace with names. A bullet that uses an unknown id, the wrong kind, or leaves stray brackets is dropped. If nothing valid remains, the built-in wording is used. Counter-programming angles are kept only for topics present in the data.

## Consolidation
- Gemini decides duplicates in small batches, and only `confident` groups whose ids we actually sent are merged. The older record is always kept, aliases are recorded, and any failure just skips the step.

## Demo data
- `episodes.is_demo` marks dummy rows so they can be cleared precisely. Demo episodes get fake video IDs (`demo-...`) that are never sent to YouTube (the view refresh skips them), and their "YouTube" link opens the show's real channel page.
- Real discovery starts at the moment of seeding (`last_seen_published_at = now`), so it never re-imports what the demo covers. Demo briefs are produced by the real weekly pipeline, which doubles as a test of it.

## Auth
- Magic link: 32 random bytes, only the SHA-256 hash is stored, valid 15 minutes, single use (atomic update). The response is identical for any email. Rate limit: 5 requests per IP per 15 minutes (the one place that answers differently, with 429, and it applies to everyone).
- Session: signed JWT (jose) in an httpOnly, SameSite=Lax cookie, 30 days sliding (reissued when older than a day). The middleware checks it for `/dashboard/*` and `/api/admin/*`; every server action and admin route re-checks it.
- Without a mail provider the link is printed to the server log in development only. In production it is never logged.

## Data layer
- The dashboard reads a `World` built from Neon (`src/lib/data/db/world.ts`) and reuses the same derive/compose code as the mock, so both behave identically. This loads all episodes per request, which is fine at this scale (hundreds a year) and is wrapped in React `cache()` so one render loads it once. If it ever gets large, move individual queries into SQL.
- `serverExternalPackages: ["ws", "@neondatabase/serverless"]` is required; bundling `ws` breaks the database WebSocket handshake in Next.

## Show matching needs a human
- Real channel search is ambiguous (generic names, look-alike channels). The matcher scores name similarity first (exact title beats an article-less look-alike, "X with Host" counts as a match, whole words only) and popularity second, but `npm run seed` prints every match for confirmation. "Zero to Infinity" had no confident match and is left unlinked (shown as "Needs attention").

## Demo history replaced by real episodes (changed after review)
- **What:** The invented demo history was removed and the last five weeks of real episodes from the ten monitored shows were loaded instead (`npm run backfill:real`, `scripts/backfill-real.ts`). Every episode link now opens the exact YouTube video; the demo rows could only link to the show's channel because the episodes did not exist.
- **How:** the script deletes the demo episodes, what only they referenced, the demo briefs and the demo lineup intervals; moves each active show's tracking start back five weeks; runs discovery; queues extraction oldest-first; then queues one `weekly_analysis` job per week, which waits until extraction is finished. Episode length limits come from Settings, as always.
- **The one exception to "no backfill":** this is a deliberate, one-time bootstrap so the dashboard starts with real history. Normal adds and swaps still track from now.
- **Gemini free tier:** about 20 requests a day per model, so around 60 analyses a day across the three models. Deferred jobs resume on the next nightly run; the briefs appear once the weeks' episodes are analysed.
- Past briefs no longer say "Not emailed yet": only the latest brief is ever emailed.

## The five past weeks were analysed by hand (changed after review)
- **What:** With Gemini's free tier too slow to analyse 86 episodes, the past five weeks were analysed by Claude reading each episode's title and description (`scripts/import-extractions.ts`), saved through the same `saveExtraction` function the Gemini pipeline uses, and labelled **Metadata only** (low confidence). Four episodes keep Gemini's video analysis. The five briefs were then built with `npm run briefs:generate`; Gemini still merges duplicate names and writes each brief's summary, and it analyses every new week from now on.
- **Limits:** no audio or video was heard, so sponsors spoken aloud and guests named only in the audio are not captured. Sponsors come from description links and wording (Vested, Odoo, CoinDCX, The 1% Club, Neurogum, Ditto, FDE Academy).
- **Guest ranking changed:** a guest's views are now ranked among interview episodes, not among all episodes. Daily news shows (Markets by Zerodha, Daybreak) have no guests and far more views, so under the old rule no interview could ever reach the top 10%. The "2+ shows" media-round rule is unchanged.
- **A show's own company is never its sponsor:** Zerodha on Markets by Zerodha is self-promotion. The prompt says so, and the save step drops a sponsor whose name is part of the show's name.

## Looser trending rules and a top-3 brief (changed after review)
- **Rules** (`TREND_RULES` in `src/lib/scoring.ts`): a guest trends on a media round (2+ shows) or when their best episode has above-median views among interview episodes (was top 10%); a topic trends on 2+ shows and 2+ episodes in the lookback (was 3 episodes). Tested on the real five weeks: guests per week went from 0,0,0,1,0 to 4,3,4,2,1 and topics from 0,1,4,4,2 to 1,5,5,6,6. The latest week has fewer guests because new episodes have not collected views yet.
- **Top 3:** the email and a new "Top 3 this week" panel on the dashboard brief show the top three guests, topics and sponsors (`BRIEF_TOP_N`); the email adds "+ N more in the full dashboard", and the section pages list everything.
- **The five past briefs were emailed** (`npm run briefs:send`, which sends every unsent brief once, oldest first).
