# Pickleball Scheduler

A When2Meet-style availability calendar for a small group. One person creates a
poll, shares the link, everyone paints the half-hour blocks they could play, and
the app ranks the windows where the most people overlap.

Creating a poll takes one click: every day for the next four weeks, 9am–9pm, is on
the calendar by default. Availability is marked on a month view — weeks stack like
a wall calendar, and clicking one opens it into the painting grid for those seven
days.

A poll has two tabs, because a group has two things to settle. **Times** is the
calendar. **Courts** is approval voting over a shared, site-wide directory of places to
play — court counts, indoor/outdoor, lights, and whether the lines are shared with
tennis. Everyone ticks every court they'd be happy with, and the one the most people
can live with rises to the top. Anyone can add to or correct the directory.

Built for ~4–8 coworkers picking a court time. Not a general-purpose meeting tool.

---

## Status

Working end to end and deployed live at
**https://pickleball-scheduler-13v.pages.dev**

Verified locally against a real (simulated) D1 database: poll create/read/edit,
participant upsert/delete, court add/edit/delete, court approval voting, input
validation, slot re-clamping when the grid shrinks, and static asset serving.

Both tabs were driven end-to-end in a real browser against the Vite dev server and
the built app served by wrangler: adding and editing a court, duplicate-name
refusal, two-step delete, backing and withdrawing a vote, live re-ranking, counts
surviving a reload, and switching tabs without losing painted cells or votes.

The calendar was driven the same way against a five-person poll: one-click create
on the defaults, accordion open/collapse, drag-painting inside an open week, the
per-day bars and week summaries in both "my times" and "everyone", cells surviving
a reload, narrowing the poll to weekends and watching the month reshape and
re-clamp, and a 360px viewport with no horizontal scroll anywhere on the page.

Verified against the deployed environment: static assets serve over HTTPS, and a
poll round-tripped through the real D1 database — `POST /api/poll` created it and
`GET /api/poll/:id` returned it with dates, hours, and participants intact.

Nothing is stubbed or mocked. There are no tests yet.

---

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| UI | React 19 + Vite | Plain SPA, no framework beyond React |
| Styling | Tailwind v4 (`@tailwindcss/vite`) + inline style tokens | Tailwind for layout, `src/theme.js` for all colour |
| API | Cloudflare Pages Functions | Same repo, same deploy, no separate service |
| Data | Cloudflare D1 (SQLite) | Free tier is 5 GB / 5M row reads / 100k row writes per day, and it does **not** pause when idle |
| Hosting | Cloudflare Pages | Free static hosting + a `*.pages.dev` URL |

The idle-pause point drove the database choice. A scheduling poll sits untouched
for a week and then has to work the instant someone opens the link — hosts that
suspend free-tier databases after N days of inactivity (Supabase does this at 7
days) would need a keep-alive cron. D1 scales to zero without pausing.

Deliberately **not** used: react-router (two routes, hand-rolled), a state
library, an ORM, any auth provider. Keep it that way unless something demands
otherwise.

---

## Quick start

```bash
npm install
npm run db:init:local        # apply schema.sql to the local simulated D1
npm run dev:api              # terminal 1 — Pages Functions + D1 on :8788
npm run dev                  # terminal 2 — Vite UI on :5173, proxies /api to :8788
```

Open <http://localhost:5173>. Vite's dev server proxies `/api/*` to wrangler
(configured in `vite.config.js`), so hot reload works while the real API runs.

To test the built app exactly as it deploys (no Vite, no proxy):

```bash
npm run preview              # builds, then serves dist/ + functions on :8788
```

Local D1 data lives in `.wrangler/state/` — gitignored, safe to delete to reset.

### Scripts

| Script | Does |
| --- | --- |
| `dev` | Vite UI only, proxying `/api` to :8788 |
| `dev:api` | `wrangler pages dev` — Functions + local D1 |
| `build` | Vite production build into `dist/` |
| `preview` | build + serve the whole thing through wrangler |
| `deploy` | build + `wrangler pages deploy` |
| `db:init:local` / `db:init:remote` | Apply `schema.sql` |

---

## Deploy

One-time setup:

```bash
npx wrangler login
npx wrangler d1 create pickleball          # copy the printed database_id
# paste it into wrangler.toml -> [[d1_databases]] database_id
npm run db:init:remote                     # create tables in the real DB
npm run deploy                             # first deploy creates the Pages project
```

You get `https://pickleball-scheduler-13v.pages.dev`. That URL is the thing to
paste into Slack.

Cloudflare picks that hostname when the project is created and may append a short
suffix if the plain name is already taken globally — the project itself is still
named `pickleball-scheduler`. Each deploy also prints an immutable
`https://<hash>.pickleball-scheduler-13v.pages.dev` preview URL; share the
un-prefixed one above, since the hashed URL changes every deploy.

After that, deploys are automatic — see below. `npm run deploy` still works from
a laptop, but reaching for it means the live site is running code that is not on
`main`, which the next merge will silently overwrite.

### Production deploys

`.github/workflows/deploy.yml` builds and deploys on every push to `main`, so
merging a PR ships it. It also runs on `workflow_dispatch`, to retry a failed
deploy or re-sync the live site to `main` without an empty commit.

Each run applies `schema.sql` to the real database (the same thing
`npm run db:init:remote` does) **before** deploying, since the new build may
reference tables the live database does not have yet. That file is
`CREATE TABLE/INDEX IF NOT EXISTS` throughout, so it is a no-op once applied.
It only ever adds: a change that drops or alters a column still has to be run by
hand, before the merge.

Deploys are serialised (`concurrency: deploy-production`, no cancel-in-progress)
rather than superseded — cancelling one mid-flight can leave the schema applied
but the matching build unshipped. Two quick merges deploy in order and the later
one wins.

`--branch=main` is what makes the deploy production rather than another preview:
it matches the Pages project's production branch, so it serves at the project
URL and picks up `[env.production]` from `wrangler.toml`. If that deploy ever
shows up at `main.pickleball-scheduler-13v.pages.dev` instead of the bare URL,
the project's production branch is set to something other than `main` — fix it
in the Cloudflare dashboard under Settings → Build, or change the flag to match.

Uses the same two repo secrets as previews: `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`.

Do not also wire the repo to GitHub via the Cloudflare dashboard — that would
deploy every push a second time, racing this workflow.

### PR previews

`.github/workflows/preview.yml` deploys every pull request and comments the URL
on the PR:

```
https://<branch>.pickleball-scheduler-13v.pages.dev
```

That alias always points at the newest commit on the PR — the comment is edited
in place rather than reposted. Each build also gets an immutable
`https://<hash>.pickleball-scheduler-13v.pages.dev` URL, linked in the same
comment.

Cloudflare derives the subdomain from the branch name: lowercased, every
non-alphanumeric character turned into a dash, then cut to 28 characters.
`Feature/Add_Thing` serves at `feature-add-thing`. Two branches whose first 28
characters match after that mangling land on the same URL, and the newer deploy
wins — nothing is lost, but the older PR's link silently starts showing the
other branch. Cloudflare adds no hash to disambiguate, so keep the first 28
characters distinctive on long branch names. Deployments record the branch name
as typed, so cleanup on close is unaffected by any of this.

The workflow refuses to deploy a branch whose name contains anything outside
`A-Za-z0-9._/-`, since that name reaches wrangler as part of a command line.

Previews are Pages **preview** deployments, so they pick up `[env.preview]` from
`wrangler.toml` and talk to the **`pickleball-preview`** D1 database, not real
poll data. It is one shared throwaway database across all PRs — Pages does not
support per-branch configuration. Wipe it whenever with
`npm run db:init:preview` after a `DROP TABLE`, and apply schema changes there
too or previews of a schema-changing PR will 500.

Requires two repo secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
(token needs Account → Cloudflare Pages: Edit, plus D1: Edit for the binding).

PRs from forks are skipped — GitHub does not expose secrets to them, so the
deploy could only fail.

Closing or merging a PR deletes every deployment it made (one per push) and
rewrites the comment so the dead URL is not left looking live. To clear
strays by hand:

```bash
npx wrangler pages deployment list --project-name pickleball-scheduler \
  --environment preview --json | jq -r '.[] | "\(.Branch) \(.Id)"'
npx wrangler pages deployment delete <id> --project-name pickleball-scheduler --force
```

The preview database is deliberately left alone on close, since rows there
cannot be attributed to a PR. Reset it with a `DROP TABLE` plus
`npm run db:init:preview` when it gets noisy.

---

## Repo map

```
index.html                Vite entry, og: tags for Slack unfurls
vite.config.js            React + Tailwind plugins, /api proxy to :8788
wrangler.toml             Pages config + D1 binding (database_id is a placeholder)
schema.sql                Four tables, three indexes. Idempotent.

src/
  main.jsx                React root
  index.css               Tailwind import, reduced-motion block
  theme.js                ALL colour + font tokens live here
  lib/
    time.js               Date/slot key helpers, poll defaults, week grouping —
                          read this before touching the calendar
    api.js                fetch wrapper; throws Errors with renderable messages
    identity.js           per-poll localStorage identity
  components/
    Setup.jsx             create/edit form; defaults to everything, with the day
                          chips + hour selects folded behind "narrow it down"
    Board.jsx             state owner: TIMES/COURTS tabs, save loops, roster,
                          best-window ranking, vote tallies
    Calendar.jsx          month view: week rows + per-day summaries, one week
                          open at a time
    Grid.jsx              the painting surface for one week + mouse/touch painting
    Courts.jsx            CourtDirectory (list + add/edit/delete, optionally a
                          ballot) and the standalone /?courts page around it
    ui.jsx                small shared primitives

functions/api/poll/
  index.js                      POST   /api/poll
  [id]/index.js                 GET    /api/poll/:id
                                PUT    /api/poll/:id
  [id]/participant/[pid]/index.js   PUT    /api/poll/:id/participant/:pid
                                    DELETE /api/poll/:id/participant/:pid
  [id]/participant/[pid]/courts.js  PUT    /api/poll/:id/participant/:pid/courts
functions/api/court/
  index.js                      GET    /api/court
                                POST   /api/court
  [id].js                       PUT    /api/court/:id
                                DELETE /api/court/:id

shared/                   imported by Functions; lives outside functions/ so
  http.js                 Cloudflare never mistakes a helper for a route
  validate.js             all input validation + id generation
  db.js                   D1 row <-> API shape mapping
```

---

## Data model

```sql
poll(id, title, dates, start_hour, end_hour, created_at)
participant(id, poll_id, name, slots, updated_at)
court(id, name, area, court_count, indoor, lighted, tennis, surface, notes,
      created_at, updated_at)
court_vote(poll_id, participant_id, court_id, updated_at)
```

- `poll.id` — 6-char slug from a no-ambiguous-characters alphabet
  (`23456789abcdefghjkmnpqrstuvwxyz`). Unguessability is the only access control.
- `poll.dates` — JSON array of local-date strings `"YYYY-MM-DD"`.
- `start_hour` inclusive, `end_hour` exclusive, 30-minute slots between them.
- `participant.id` — generated client-side, kept in `localStorage` under
  `pb:me:<pollId>`. This is the whole identity system.
- `participant.slots` — JSON array of slot keys `"YYYY-MM-DD#<minutesFromMidnight>"`,
  e.g. `"2026-08-20#1080"` is 6:00pm on Aug 20.
- `court` has **no** `poll_id` and no owner column — the directory is site-wide and
  wiki-editable. `indoor` / `lighted` / `tennis` are 0/1 INTEGERs (SQLite has no
  BOOLEAN) and become real JSON booleans in `rowToCourt`. `surface` is one of
  `concrete | asphalt | tile | wood | other`, or `''` when unknown.
- `court_vote` is where the site-wide directory meets a single poll: an approval is
  the *existence* of a row, so there is no value column and a missing row is a "no".
  `GET /api/poll/:id` stitches these onto each participant as `courts`, so the
  client treats votes and slots the same way.

Slots are stored denormalised as JSON rather than one row per slot. At this scale
it's one row read per person instead of hundreds, and D1's free tier bills by rows
read. If you ever need to query *across* polls ("when is Dave usually free"),
that's the point to normalise.

### API

All responses are JSON. Errors are `{ "error": "human readable message" }` with a
4xx status; `src/lib/api.js` surfaces `error` directly into the UI.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/poll` | `{title, dates[], startHour, endHour}` | `201 {id}` |
| GET | `/api/poll/:id` | — | `{poll, participants[]}` |
| PUT | `/api/poll/:id` | same as POST | `{poll, participants[]}` |
| PUT | `/api/poll/:id/participant/:pid` | `{name, slots[]}` | `{id, name, slots, updatedAt}` |
| DELETE | `/api/poll/:id/participant/:pid` | — | `{ok:true}` |
| PUT | `/api/poll/:id/participant/:pid/courts` | `{courts[]}` | `{id, courts, updatedAt}` |
| GET | `/api/court` | — | `{courts[]}`, name-sorted |
| POST | `/api/court` | `{name, area, courtCount, indoor, lighted, tennis, surface, notes}` | `201 {court}` |
| PUT | `/api/court/:id` | same as POST | `{court}` |
| DELETE | `/api/court/:id` | — | `{ok:true}` |

Court create/rename returns `409` if another court already has that name
(case-insensitive) — the fix is to edit the existing entry, which anyone can do.

---

## Design decisions worth not undoing

**Creating a poll asks for nothing but a name.** Every day for four weeks, 9am–9pm
(`DEFAULT_START_HOUR` / `DEFAULT_END_HOUR` / `HORIZON_DAYS` in `time.js`). The
organiser doesn't know which days are worth asking about — that's the entire point
of the poll — so making them guess up front is a decision asked at the one moment
nobody can answer it. The day chips and hour selects still exist, folded behind
"narrow it down" and unfolded by default when *editing*, for the case where whole
days really are off the table for everyone. 28 days is also `LIMITS.dates`, so the
default payload sits exactly on the cap.

**A month of weeks, one open at a time.** The default poll is 672 cells; as one
flat grid that's a horizontal scroll nobody finishes. `Calendar.jsx` stacks weeks
like a wall calendar and expands one into `Grid.jsx` on click. A week is the unit
people think in, and seven columns fit a 360px phone with no sideways scrolling —
which is why `Grid.jsx` caps its columns at 38px and its hour gutter at 46px.
Collapsed rows still carry the answer: each day shows a ball-yellow bar for how
much of it is claimed (your share of the day in "my times", the group's best
overlap in "everyone"), so you can see where the group is converging without
opening anything. The bar is deliberately not a tinted cell — ball yellow washed
over the panel at half strength goes olive, and four weeks of olive squares reads
as noise.

**One row per participant, upserted.** Two people painting the grid at the same
moment write different rows, so there's no last-write-wins clobbering. Do not
"simplify" this into a single JSON blob per poll.

**Local state wins for your own row.** `Board.jsx` seeds `mine` from the server
exactly once per identity (`seededFor` ref) and never re-seeds from background
refreshes. Without that guard, the 20-second poll would overwrite cells the user
is mid-drag on. Writes are debounced 700 ms.

**Slot sanitising is server-side and silent.** `sanitizeSlots()` drops malformed
keys, off-grid times, and non-30-minute offsets rather than erroring, so a stale
client just loses cells that no longer exist. Editing a poll re-clamps every
participant's stored slots so tallies never count invisible cells.

**Approval voting, not a single pick.** Everyone ticks every court they could live
with, and the tally ranks by how many people backed each. A 2-2-1 split between
favourites tells you nothing; approvals tell you which court nobody objects to,
which is the actual question. It also mirrors the time grid exactly — mark
everything that works, count the overlap — so the two tabs teach each other.

**Vote writes replace the whole set.** `PUT .../participant/:pid/courts` deletes
that person's rows and re-inserts them in one batch, so a retry after a flaky save
can't double-count. It's a separate endpoint from the participant upsert on purpose:
votes and times are painted at different moments, and a shared endpoint would let a
vote write clobber cells the user is mid-drag on. They also get separate debounce
timers in `Board.jsx` for the same reason.

**The court directory is unowned on purpose.** Anyone can add, edit, or delete any
entry — there is no identity check, not even the localStorage one the poll uses. The
list is small and shared by people who know each other; a per-device owner column
would mostly mean nobody can fix a typo someone else made. The duplicate-name guard
and the two-step delete confirm are what stand in for permissions. Revisit this only
if the list is being vandalised, and add Cloudflare Access rather than a fake owner id.

**Poll id in the query string (`/?p=abc123`), not a path.** A static host only
ever has to serve `index.html`, so a shared link cannot 404 on a missing
SPA-fallback rule. Current wrangler rejects the usual Pages `/* /index.html 200`
splat as an infinite loop, and a dead link is the one bug this app can't ship
with. To move to `/p/:id`, add SPA fallback on the host and change `readRoute` /
`pollPath` in `App.jsx` — those two functions are the entire router.

**Touch painting hit-tests manually.** `touchmove` fires on the element where the
touch *started*, so `Grid.jsx` attaches a non-passive listener to the container
and uses `document.elementFromPoint` + `data-key`. `preventDefault` stops the
page scrolling mid-stroke. This is fiddly; test on a real phone after changing it.

**All colour comes from `src/theme.js`.** Tailwind is used for layout only. The
palette is an outdoor court at dusk — deep blue-green surface, white court lines,
and ball yellow reserved for exactly one meaning: a claimed block of time. If you
add a feature, don't give it a new accent colour.

---

## Known limitations

- **No auth.** Anyone with the link can edit anyone's row, or delete the poll's
  data via the API. Fine for coworkers; the slug is the only privacy. To lock it
  down, put Cloudflare Access in front of `/api/*`.
- **Identity is per-browser.** Same person on a second device creates a second
  row. There's a "that's me" claim flow on the name screen that adopts an
  existing participant id — which also means anyone can impersonate anyone.
- **No live updates.** 20-second polling. For real-time, a SQLite-backed Durable
  Object holding a WebSocket per poll is the free-tier-compatible path.
- **No timezone handling.** Everything is the viewer's local clock, with dates as
  bare strings. Fine for one office, wrong for a distributed team.
- **No poll deletion or expiry.** Rows accumulate forever. A scheduled Worker
  deleting polls older than ~90 days would be a sensible addition. The court
  directory is deliberately exempt — it's meant to accumulate.
- **The court directory is world-writable.** Any visitor can delete any court, and
  the API is reachable without opening the UI. Same fix as above: Cloudflare Access
  in front of `/api/*`.
- **No tests.** Vitest for `shared/validate.js` (`validatePoll`, `validateCourt`,
  `sanitizeCourtVotes`) plus the best-window ranking and vote tally in `Board.jsx`
  would cover the parts most likely to break.
- **Votes are per-poll, courts are global.** Deleting a court removes it from every
  poll that was voting on it, including ones already decided. Fine at this scale;
  worth a soft-delete flag if the directory ever gets busy.
- **No search or filtering on the directory.** Fine at a dozen courts; a filter row
  ("indoor only", "lighted") is the obvious next step past that.

## Ideas, roughly in value order

1. Copy a "best window" straight into an `.ics` invite.
2. Slack unfurl with live counts (needs a Slack app + `og:` refresh).
3. Recurring weekly polls that auto-roll to next week.
4. Minimum-players threshold ("show me windows where at least 4 can play").
5. Filter the directory (indoor only, lighted, ≥4 courts).
6. Lock in a winning court + window together, and put both in the `.ics`.
