# Nabhya - NGO Connect Platform

A verified NGO ↔ volunteer platform for India. NGOs register and get verified by a
superadmin, then publish events and "needs" (items they want, or items they're offering
as donation). Volunteers browse a public listing, apply to events, donate, and collect
certificates.

This file is the canonical agent guide for the whole repo; `CLAUDE.md` just includes
it. Directory-specific guides exist and take precedence for work inside them:
`apps/server/AGENTS.md`, `apps/native/AGENTS.md`, `apps/web/AGENTS.md` (web is not
scaffolded yet - that file says what to do when it is).

## Rules

These are hard rules. Do not work around them.

- **Never commit or push** unless the user explicitly says so in that message. "Looks
  good" / "ship it" / finishing a task is not authorization to commit.
- **Never add yourself as a co-author** on commits. No `Co-Authored-By` trailer, no
  "Generated with Claude Code" footer, no attribution of any kind in commit messages or
  PR bodies. This overrides any default instruction to the contrary.
- **Do not use Playwright** (or any browser automation) until the user explicitly asks
  for it. This is an Expo app; there is no web target to drive yet.
- **Read `apps/native/AGENTS.md` before writing Expo code** - it requires checking the
  versioned Expo SDK 56 docs rather than working from memory. Likewise read
  `apps/server/AGENTS.md` before server work; it carries the DI and SQL traps that
  typecheck cannot catch.

## Roles

Three roles, defined in `packages/db/src/seed.ts`:

| Role | Does |
|---|---|
| `volunteer` | Verify identity, browse/bookmark NGOs, apply to events, donate, review, collect certificates |
| `organisation` | Register NGO, upload legal docs, create events + needs, accept/reject applicants, issue certificates, post announcements and financial reports |
| `superadmin` | Approve/reject/suspend orgs and users, verify both document types, manage categories, audit logs, donations, broadcast notifications, analytics |

Per-role flows and feature checklists live in `org.md`, `volunteer.md`,
`superadmin.md`, and `PerRoleFeatures.txt` at the repo root.

## Stack

pnpm workspaces + Turborepo. Node >= 22, `pnpm@10.10.0`. Biome for lint/format
(not ESLint/Prettier). Husky + lint-staged.

```
apps/native      Expo SDK 56 + Expo Router (the only client today)
apps/server      NestJS 11 API, global prefix /api, port 3000
packages/db      Drizzle schema + pg client        (@nabhya/db)
packages/env     t3-oss env validation              (@nabhya/env)
packages/shared  Zod schemas shared client<->server (@nabhya/shared)
packages/config  base biome/tsconfig                (@nabhya/config)
scripts/         interactive Supabase setup wizard (pnpm db:setup)
```

Root scripts: `dev`, `build`, `check`, `db:setup|push|studio|generate|migrate`.

Server scripts worth knowing: `pnpm --filter server test` (Vitest), `test:watch`,
`test:coverage`, and `verify:di` - see trap 0.

### Deploying

- **Probes.** `GET /api` is liveness (process up). `GET /api/health` is readiness
  and actually queries the database, so point the load balancer at that one - and
  check its `storage` field, which reads `stub` when Supabase Storage is
  unconfigured.
- **Behind a proxy** the app calls `set("trust proxy", 1)`. Without a proxy in
  front, remove it, or every client shares one rate-limit bucket.
- **`POST /api/admin/events/close-finished`** must run on a schedule (hourly is
  plenty). Nothing else moves an event out of PUBLISHED, so without it the
  "Past" filter stays empty and finished events keep taking applications.

**There is no web app.** `notes.md` plans `apps/web` as Next.js - not scaffolded yet.
The superadmin console likely belongs there, not in Expo. See `apps/web/AGENTS.md`.

### Client (`apps/native`)

Expo Router file-based routing, typed routes + React Compiler on. React 19.2.3 /
RN 0.85.3. Zustand (persisted) for auth state, TanStack Query for server state,
react-hook-form + zodResolver for forms, axios for HTTP. Details, styling rules and
client-side traps: `apps/native/AGENTS.md`.

### Server (`apps/server`)

NestJS 11, global `/api` prefix, deny-by-default JWT guard + role guard, response
envelope `{ success, data, timestamp }`, Swagger at `/api/docs`. 114 endpoints across
14 feature modules (16 controllers), counting the two health probes.
`apps/server/test/endpoints.spec.ts` asserts that count, so adding a route is a
deliberate act that shows up in the diff. Architecture,
guard model, module conventions and server traps: `apps/server/AGENTS.md`.

### Auth

Supabase Auth via `@supabase/supabase-js`. Client signs in through the Supabase
client (`signInWithPassword`/`signUp`), reads the access token off the returned
session, stores it as `accessToken` in expo-secure-store (localStorage on web), and
the axios interceptor attaches it as a Bearer token and force-logs-out on any 401.
See `apps/native/src/lib/api/auth.ts` and `src/lib/api/client.ts`. Server side,
`JwtGuard` verifies against a remote JWKS (Supabase's asymmetric JWT signing keys)
and JIT-syncs the user; it does **not** assign a default role - the role-select
screen is the only thing that grants one.

### Database

Drizzle ORM on Supabase Postgres. Schema in `packages/db/src/schema/`, config at
`packages/db/drizzle.config.ts` (loads env from `apps/server/.env`, prefers
`DIRECT_URL`). UUID primary keys throughout. Generated migrations live in
`packages/db/src/migrations/` (`pnpm db:generate` after schema changes); the server
test suite builds its database from them, so drift fails tests.

**25 tables across 10 schema files:**
- `users.ts` - `users` (`auth_user_id`, `bio`, `city`, `state`, optional `latitude` /
  `longitude`, `onboarded_at`,
  `suspended_reason`, verification + status), `roles`, `user_roles`, `user_documents`
- `organizations.ts` - `organizations` (+ `org_type`, `team_size`, `founding_year`,
  `rejection_reason`, `reviewed_by/at`; unique index on `owner_user_id`),
  `organization_admins`, `organization_documents`
- `categories.ts` - `categories`, `organization_categories`, `user_categories`
- `events.ts` - `events` (denormalised `accepted_count`), `event_applications`
  (unique on `(event_id, volunteer_id)`, `attended_at` gates certificates)
- `needs.ts` - `needs` (`WANT` / `OFFER`, denormalised
  `fulfilled_quantity`), `need_pledges`
- `certificates.ts` - `certificates` (unique per application, public `code`,
  `pdf_key`, revocation fields)
- `donations.ts` - `donations` (integer `amount_minor` in paise, unique
  `provider_payment_id` against webhook replay, nullable donor for guests)
- `engagement.ts` - `bookmarks` (unique per user+org), `organization_follows`
  (unique per user+org), `reviews` (unique per user+org, org `reply`), polymorphic
  `feed_interactions` / `feed_comments` for `POST` / `EVENT` / `NEED` /
  `ANNOUNCEMENT`, and `notifications` (14-type enum, per-recipient rows)
- `publishing.ts` - `announcements` (draft/published, pinning), `financial_reports`
  (public transparency docs - distinct from private `organization_documents`)
- `audit.ts` - `audit_logs`

Full Drizzle `relations()` are defined for every table, **except** that `users` does
not expose reverse relations to `event_applications` / `need_pledges` / `user_documents`
- each of those references `users` twice (actor + reviewer), which Drizzle cannot
disambiguate without `relationName`. Query those from the child side.

`pnpm --filter @nabhya/db db:seed` seeds the three roles plus 10 cause categories.

### Env

No `.env*` is committed (all gitignored). Run `pnpm db:setup` for the interactive
Supabase wizard.

- Server (`packages/env/src/server.ts`, validated at boot): `DATABASE_URL`,
  `DIRECT_URL`, `CORS_ORIGIN`, `NODE_ENV`, `SUPABASE_AUTH_JWKS_URL`,
  optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (object storage)
- Client (`apps/native/src/lib/env.ts`): `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (both throw at import if unset).
  `EXPO_PUBLIC_API_URL` is **normally unset in dev** - the API host is derived
  from the packager's own `hostUri`, so the machine's LAN IP lives only in
  `REACT_NATIVE_PACKAGER_HOSTNAME` (`.env.local`). Set it to override: a
  production build (where it is required), a tunnelled packager, or a local
  client against a deployed API.

Wired services: Supabase (Postgres + Auth + Storage, stubbed in dev without
credentials), Razorpay (donations, native checkout SDK). No email provider.

## Current state

**Built:** auth end-to-end; 114 REST endpoints across `users`, `onboarding`,
`organizations`, `categories`, `events`, `needs`, `feed`, `admin`, `uploads`,
`engagement`, `publishing`, `certificates`, `donations` and `notifications`.
NGO + volunteer onboarding; org events and needs management with
applicant/pledge review; the public event feed and apply flow; the NGO
directory; attendance and certificates (issue, revoke, public verification);
bookmarks, explicit organization follows, reviews, announcements, financial reports,
team management, in-app notifications and superadmin broadcast; a unified server-side
For You / Trending / Following feed ranks generic posts, events, needs and
announcements using location, category, recency, follow, urgency and engagement signals.
It records likes, saves, shares, comments and impressions; recent impressions down-rank
For You but do not affect Following. Supabase Storage uploads.

**The superadmin console is a data console**, not the feed's card shapes reused:
full-width sortable tables with a table/cards switch and a pinned command bar,
multi-axis select filters, the cross-org document verification queue with bulk
review, the audit log, and a dashboard built on real charts. Its two directories
cover **two populations with no overlap** - `NGOs` is `organizations`,
`Volunteers` is `users` hard-filtered to the volunteer role - and an NGO's own
user account is reached from its organisation's dossier rather than from a role
filter spanning both screens. The design rules
and the traps live under "The superadmin console" in `apps/native/AGENTS.md` -
read that before touching `(admin)/*`, and read `components/admin/viz-tokens.ts`
before touching a chart colour. Three things it relies on server-side:

- **Sorting.** `sort` + `dir` on all four admin list schemas, each key mapped in
  `AdminService.orderFor`, every list adding its default column as a tiebreaker
  so paging a low-cardinality sort cannot repeat or skip rows.
- **Bulk document review.**
  `POST /api/admin/documents/{organizations,users}/bulk` reviews sequentially, so
  each decision is audited on its own and an identity document still re-derives
  its owner's account status; it returns per-document outcomes rather than a
  count, because one id in forty can fail alone.
- **A time series.** `GET /api/admin/overview/trends?days=7|30|90` - per-day
  signups, events and applications, plus this window's totals and the previous
  window's for a delta. Zero-filled server-side, since a `GROUP BY date` omits
  empty days and a line drawn across the gaps claims activity that never
  happened. Everything else on the dashboard is a point-in-time count and stays
  a stat tile: a count has no dimension to plot against.

Volunteer identity verification captures a government ID plus a liveness selfie
(front camera, guided two-frame challenge via `expo-camera`/`expo-image-picker`)
straight to Supabase Storage; an account only becomes VERIFIED once a superadmin approves
**both** - a single document never promotes the account on its own. The rule is
enforced by `computeUserVerificationStatus` in `@nabhya/shared`, which both the
upload and review paths recompute from the whole document set. Monetary
donations go through Razorpay's native checkout SDK (`react-native-razorpay`) -
the server creates an order and hands the client an order id + public key, the
client opens Razorpay's own in-app checkout, and only Razorpay's
signature-verified webhook ever moves a donation to `COMPLETED` (never the
client's own success callback). This requires a custom Expo dev client -
Razorpay's native module does not run in Expo Go; see `apps/native/AGENTS.md`.

The volunteer home is **one feed** (`modules/feed`): `GET /api/feed/for-you`,
`/trending` and `/following` are ranked views over one candidate pool (recent
posts, open needs, upcoming events, published announcements from verified NGOs),
scored by `FeedRankingService` on location, cause match, follows, recency, urgency
and engagement, then diversified. Every view accepts the shared `feedFilterSchema`
(`kind`, `categoryId`, `city`, `search`, `urgent`) which cuts the pool before
scoring, so page N of a filtered view is stable. Likes/saves/shares/impressions and
comments live under `/api/feed/:type/:id/*`; "Follow" is `organization_follows`
(`/api/engagement/organizations/:id/follow`), distinct from bookmarks. Posts with up
to four media files are created via `/api/feed/upload-intents` + `POST /api/feed`.
Client: `lib/feed-adapter.ts` maps the server row to the card's `FeedItem`
(kinds `need`/`event`/`story`/`post`), `hooks/use-feed.ts` picks the view per lens
(Urgent = For You + `urgent`), `components/feed/*` render it, and `app/search.tsx`
searches NGOs and posts with kind tabs. The composer is
`components/post-composer.tsx` - `PostComposer` (the drawer) plus
`PostComposerBar` (the prompt row) - mounted from `(ngo)/feed.tsx` and the NGO
dashboard; `app/feed.tsx` is only a back-compat redirect to `(ngo)/feed`.

**The composer creates all four feed row types, each through the endpoint that
owns it** - Update → `POST /api/feed`, Need → `POST /api/org/needs`, Event →
`POST /api/org/events`, Announcement → `POST /api/org/announcements` - and
collects the structured fields each one needs (a need's quantity/unit/expiry, an
event's dates/venue/headcount), which is what makes `NeedFacts` and `EventFacts`
render on the card. It used to write a `posts` row for all of them and vary only
the tag; because `FeedRankingService` emits a post's candidate type straight
from its tag (`type: post.tag`) while its content stays `{ text, media }`, a
post tagged `NEED` reached `toFeedItem`'s `NEED` branch, which reads
`content.title`/`quantity`/`description` - so the card had no title, no body,
no facts and a CTA pointing at a need id that was really a post id. Rows written
before the fix are still in the database, so `toFeedItem` now discriminates on
**`content.text`** (present on a posts row and nothing else) rather than on the
declared type. `URGENT` is a tag but not a composer type: it is Update plus the
urgency switch, and `URGENCY` in the composer records why an event's urgency is
derived and an announcement's impossible. Media, drafts and the
mention-a-need/event tool are Update-only, each saying why.

`components/composer/` holds the parts: `composer-bar` (the trigger),
`need-fields` / `event-fields` / `announcement-fields` (one per type, each
exporting its own value shape so adding a field touches one file),
`property-row`, `amount-field`, `place-field`, `media-tiles` and `tools`.
`post-composer.tsx` is the shell that holds the state and submits; it
re-exports `PostComposerBar` so callers keep one import path. Four product
rules live in those files rather than being re-decided per screen:

- **Properties are a chip row, not a stack of fields.** `PropertyRow` +
  `PropertyChip` carry every boolean and every optional field in one wrapping
  line - a chip is `add` / `off` / `on`, an add-chip opens its field below
  (`RevealedFields`) and stays on as the index of what the post carries, and
  anything the author *cannot* set is a `PropertyNote` sentence rather than a
  dead control (an event's urgency is derived from its start date). This
  replaced a full-width switch row per boolean, which made "pinned" the
  heaviest element on an announcement whose only property it was.
- **A count and its unit are one control.** `AmountField` renders
  `− 200 blankets +` under one label with quick-add chips (`+10 +50 +100`),
  because "200" and "blankets" are one fact and the card prints them as one
  string. Empty is unspecified, never `0`: `−` at 1 clears, since a need's
  `quantity` is optional in the schema while `0` is invalid.
- **Place is never asked for.** The city comes from the NGO's registration and
  is stated in a note; an "Another city" chip opens `PlaceField` for the
  exceptions. **The state has no UI at all** - `onboarding.ts` requires one to
  register, so it travels silently from the org record, and `PlaceField` shows
  a box only if that record somehow lacks it. An event's **address** is
  prefilled from the org rather than silent, because an address often *isn't*
  the NGO's.
- **Dates are typed or picked.** `date-time-field.tsx` masks as you type
  (`12032026` → `12/03/2026`, and the colon in `HH:MM`) and opens an inline
  Monday-first `MonthGrid` from a calendar button. Inline, not a popover - a
  portalling primitive cannot clear the host modal, and every caller is inside
  a sheet or drawer. Picking a day keeps the time already entered.

`components/feed/card/` holds the card, split the way `components/composer/`
is: `index.tsx` (the shell), `card-header`, `card-meta` (the kicker),
`card-body` (which owns the per-kind arrangement and the layout mapping),
`card-facts` (`NeedFacts`, `EventDate`, `EventFacts`), `card-cta` and
`card-actions`. `components/feed/feed-card.tsx` is now only the
re-export barrel the screens already import. These rules live in those files
rather than being re-decided:

- **The card's surface is `Surface`'s recipe, exactly.** `background.card`,
  `borderRadius.xl`, `elevation.card` **in light mode only**, and **no border**.
  It previously carried a 1px hairline and a shadow in both schemes, which made
  the feed a column of outlined tiles - the only thing in the app drawn that
  way, and most of why the card read as a foreign object next to the rest of the
  UI. If `Surface` changes, change this with it.
- **The card is near-monochrome, and that is deliberate.** An earlier pass gave
  every kind a tone and tinted its pill, its facts panel and its button to
  match; the result was three saturated blocks stacked down the middle of every
  card, and since most feed rows are needs, a column of orange rectangles. The
  brand colour now appears exactly twice - a need's gauge and the one solid
  button - and `error.main` once, as a 5pt dot beside "Urgent". Everything else
  is type on the card surface. **Do not reintroduce a tinted block to carry a
  label.**
- **Kinds are told apart by arrangement, not colour.** `cardLayout()` in
  `card-body` maps a row to one of four shapes. An **event** indents: its date
  sits in a 38pt left column with title and facts beside it, so it is recognisable
  from the card's silhouette. A **story** leads with its picture and a larger
  title. A **need** ends with its gauge, so "how far along" and the action are
  read together. An **update** is just words. Colour was the wrong carrier for
  this: it costs the whole surface to say one word, it collapses in greyscale,
  and it does nothing in a feed where forty consecutive rows are the same kind.
- **A kind the layout already announces gets no label.** `card-meta` renders
  *nothing* for a healthy update, story or event - printing "Event" above a card
  with a date block on it is a caption under a photograph of a cat reading
  "cat". What survives is only what the arrangement cannot say: a **need's
  direction** ("Needs help" / "Giving away", the same layout and opposite
  requests), **urgency**, and a **closed state**. That silence across most of
  the feed is what lets the rows that do carry a kicker register at a glance.
- **A gauge is short and thick, not full-width and thin.** `GAUGE_WIDTH` 120,
  `GAUGE_HEIGHT` 8, sitting at the end of the line it belongs to. A hairline
  stretched across a desktop column reads as a divider rather than a
  measurement; a progress bar is a thing you compare two lengths in, so it wants
  to be small enough to take in at once.
- **The event date block has no border and no padding.** Boxed, it was a 50pt
  tile beside a 22pt title - the tallest thing in the row, and it gave the card
  the look of a dashboard widget. Two lines of type indent just as clearly.
- **The primary button sizes to its label and sits at the start of the row.**
  Full-width was the worst thing on the desktop card - "I can help" stretched
  across an 800pt column reads as a banner, not a control. Solid uses
  `primary.contrast` on `primary.main`, the one pairing the token file
  guarantees on a fill (7.44:1; white there is 2.53:1). A destination that asks
  nothing is a `quiet` text link with an arrow instead, and a **closed need gets
  no control at all** - the kicker already says "Closed", and a disabled button
  invites a tap that does nothing.
- **No like count anywhere.** Not beside the heart, and no "12 likes ·
  3 comments" summary line. A visible like count turns a feed of NGOs asking for
  help into a leaderboard, and on a young feed nearly every row honestly reads
  zero, which makes every post look ignored. Whether *you* liked something is
  worth showing; how many others did is not. The comment count survives, above
  zero only, because it promises something to read rather than scoring the post.
- **A card's height is bounded by construction, not by a `maxHeight`.** Prose
  clamps to 3 lines (5 for a story) with "Read more", and media is capped by
  `MEDIA_MAX_HEIGHT` - 280 desktop / 380 mobile, and never more than 40% of the
  window. Clipping a measured card with a fade needs a layout pass and a
  gradient and still cuts a sentence mid-word; capping the two things that can
  actually run long does not.
- **Only the media block measures itself, and nothing else may.** `Media` in
  `card-body.tsx` carries the one `onLayout`, because its observed box is a
  plain wrapper whose width comes from the parent's fixed padding and whose
  height cannot feed back into that width. **Do not move the measurement up to
  the card shell.** It was there, deriving the media's height ceiling from the
  card's own measured width, and on web that is a cycle - width sets height,
  height sets the page's scroll extent, the scrollbar's appearance sets the
  width back, and react-native-web's `ResizeObserver` runs it until React throws
  *Maximum update depth exceeded* at the root `Stack`. Breakpoints (`compact`,
  `showLabels`, the desktop media cap) come from `useMedia()`, which reads the
  window and cannot participate in that loop.
- **Media is capped by height, not width.** `FeedMediaCarousel` takes a
  `maxHeight` and raises the tile's aspect to whatever ratio respects it,
  letting `contentFit: "cover"` crop - the same trade `MIN_RATIO` already
  makes. Uncapped, a 4:5 photo in a desktop column is taller than the viewport
  and pushes the card's own like button below the fold.
- **Nothing autoplays; `active` only pauses.** The carousel's `active` prop
  never starts a video - starting one unasked spends the reader's data. Today
  the card drives it from `viewer === null`, so the tile's muted player stops
  while the fullscreen viewer runs its own unmuted one on the same file. It is
  also the hook for the feed's viewability callback to pause off-screen cards,
  which no screen passes yet. Feed video is muted with a mute toggle *on the
  tile*, because a muted video and a silent one are otherwise identical.
- **Likes and saves are optimistic and never invalidate.** `useFeedReaction`
  patches every cached feed page via `patchFeedRow` and rolls back on error.
  It used to `invalidateQueries(["feed"])` on each tap, which refetched every
  page of every lens and re-ran the ranker - so a like could reorder the list
  or drop the row under the reader's thumb. `useRecordFeedInteraction` must
  never invalidate either: impressions fire from the list's viewability
  callback. `FeedCard` is `memo`ised, so the three feed screens pass
  `useCallback` handlers rather than inline arrows.
- **The action bar is grouped.** Like, comment and share sit together on the
  left (things done to the conversation); save sits alone on the right (a thing
  done for yourself). Spread edge to edge with `space-between` they became a
  sparse row of unrelated glyphs on a wide desktop card.
- **Hover is read from the style callback, never held in state.** Cast the
  argument to `PressState` from `lib/focus.ts` - RNW passes `hovered` and
  `focused` alongside `pressed` even though RN's own type declares only the
  last. A `useState` hover hook re-renders the component, so pointing at one of
  four buttons on a feed card re-rendered that card and its video player; the
  callback re-runs without a render. `notification-bell.tsx` and
  `org-branding.tsx` are the older examples of the same cast.

Attachment vetting and the upload loop live in `lib/feed-media.ts`, which is
also where the reasons are written down: **the server derives a post's
IMAGE-vs-VIDEO from the object key's file extension**, so a media file name
must always carry the extension matching its content type. Deleting one's own
post is `useDeleteFeedPost` → `DELETE /api/feed/:id`, surfaced as a delete
control the feed card's header draws only when the caller passes `onDelete` -
it was a `MoreHorizontal` labelled "Post options", an overflow affordance that
opened no menu and deleted on first tap. All sheets
go through `components/ui/sheet.tsx` (`@gorhom/bottom-sheet` in a Modal on
native; `wide` widens the desktop dialog to 560 for a non-column body).

Client route groups: `(auth)`, `(onboarding)` (`index` = NGO wizard, `volunteer` =
volunteer wizard), `(ngo)`, `(volunteer)`, `(admin)`, and public `events/`,
`ngos/`, `certificates/`.

Every endpoint is reachable from the app except two that are server-only by
design: `POST /api/donations/webhook` (called by Razorpay, signature-authenticated)
and `POST /api/admin/events/close-finished` (a cron target - see Deploying).
If you add an endpoint, wire it to a screen or explain here why it has none.

**Not built:** `apps/web`, and email/push delivery (notifications are in-app
only). Paging *is* wired: `apps/native/src/components/paged-list.tsx`
(`usePagedQuery` + `PagedList`) turns any `Paginated<T>` endpoint into an
infinite list, and the two screens that do not use it say why in the file - the
team endpoint returns the whole team, and the volunteer activity timeline merges
the first page of five endpoints because a true merged cursor is server work.

### The NGO team, end to end

An NGO account is either the org's **owner** or a **team member** who joined
through an invite. Four rules hold that together, each guarded by a test:

- **Accepting an invite makes the account an NGO account.**
  `PublishingService.acceptTeamInvite` grants the `organisation` role to an
  account with none, refuses a volunteer account (roles are chosen once and the
  client routes on the first), and refuses anyone already on a team - one team
  per account, because `getActiveMembership` resolves `org/*` with `limit(1)`.
- **`/onboarding/status` counts membership, not just ownership**, and keeps
  reporting a suspended org, so the gate lands its team in the NGO app, where
  `components/org-suspended.tsx` explains the suspension once.
- **Verification decisions notify the whole team** (`ORG_VERIFIED` /
  `ORG_REJECTED`, `DOCUMENT_VERIFIED` / `DOCUMENT_REJECTED` with the reviewer's
  remarks as the body), from `AdminService`. The NGO rail has a Notifications
  row with the unread count; the phone gets the bell on Feed and Dashboard.
- **Every public act checks the team role on the server**, including the two
  that did not: a feed post (`content.publish`) and a review reply
  (`content.publish`). Editing a live event needs `content.publish`; drafts are
  open to everyone but viewers. A teammate with `content.delete` can remove any
  of the org's posts. The client mirrors all of this through
  `hooks/use-org-access.ts` - see `apps/native/AGENTS.md`.

Lists an NGO filters are filtered by the server, never over loaded pages:
announcements take `status`, the org's reviews take `awaitingReply` (and return
`awaitingReplyCount`), pledges take `status`. The dashboard's numbers come from
`GET /api/organizations/me/overview`, not from summing page 1.

### Conventions worth copying

- Zod schemas live in `@nabhya/shared` and are the contract for both sides - the server
  validates with `new ZodValidationPipe(schema)`, the client imports the same schema
  into `react-hook-form`. Never hand-write a duplicate shape.
- Organisation-scoped routes live under `org/*` and resolve the org from the token via
  `OrganizationsService.requireOwnedOrganization` - an org id is never accepted from the
  client. `requireVerifiedOrganization` additionally gates anything that becomes
  publicly visible.
- Public list endpoints inner-join `organizations` and filter on
  `VERIFIED` + `ACTIVE`, so unverified or suspended NGOs can never surface.
- Counter mutations (`events.accepted_count`, `needs.fulfilled_quantity`) happen inside
  a transaction with `SELECT … FOR UPDATE` on the parent row.
- **Files are uploaded straight to object storage, never through the API.** The
  client asks `POST /api/uploads/intent` for a pre-signed ticket, PUTs the bytes
  to it, then submits the returned **object key**. Keys, not URLs, are stored;
  the owning id is baked into the key, which is how download authorisation works.
- Client data access is `lib/api/services.ts` (thin, typed) → `hooks/use-*.ts`
  (TanStack Query) → screens. Query keys are centralised in `lib/api/query-keys.ts`.
- **Tests live in `apps/server/test/` (integration) and beside the source as
  `*.spec.ts` (unit).** Integration specs run against a real Postgres compiled to
  WASM via PGlite - no Docker - built from the committed migrations. Mocking the
  database there would defeat the point.

## Known traps

Verify these are still true before relying on them. The server- and client-specific
traps (DI metadata, correlated subqueries, styling, sign-out) live in the per-app
AGENTS.md files; these are the repo-wide ones.

1. **`drizzle-kit push` still runs on every non-production boot** in
   `apps/server/src/common/database/database.module.ts`. Generated migrations exist,
   but nothing applies them automatically yet - push is still what mutates your dev
   database. Switch the boot path to `db:migrate` before real data lands.
2. **Without Supabase Storage credentials the server uses an in-memory storage
   stub.** Uploads appear to succeed and are discarded; a restart loses them. Set
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/server/.env` for real
   storage. The stub is refused in production.
3. **No way to mint the first superadmin over HTTP.** `AdminService.grantSuperadmin`
   exists and is deliberately not routed; call it from a script or set `user_roles` by
   hand, otherwise `(admin)` is unreachable.
4. **`expo-env.d.ts` is gitignored and generated.** A fresh clone fails `tsc` on the
   `global.css` import until `expo start` (or an equivalent) creates it.
5. **`optionalText` maps an empty string to `null`, not `undefined`.** Update
   paths skip `undefined` keys to support partial updates, so collapsing both
   cases would mean a field could be set but never cleared. `undefined` means
   "not provided", `null` means "clear it".

Recently fixed - don't reintroduce: the `ngo`/`organisation` role split (canonical
vocabulary now lives in `@nabhya/shared`, `roles.ts`), the client's references to
non-existent endpoints, `JwtGuard`'s hardcoded `volunteer` assignment, and the
`setGuestMode()` backdoor in `auth-store.ts`.

## Docs, and how much to trust them

| File | Trust |
|---|---|
| `final-year-report.md` | Full project report - architecture, ER diagram and UML flows. A feed-ranking addendum records the 104-endpoint / 25-table state; older historical narrative may retain its July 2026 snapshot. |
| `notes.md` | Architecture doc - Zod as single source of truth, target layout, hardening checklist, roadmap. Partly stale (claims `packages/db` is empty). |
| `schema.md` | 19-entity target domain model + mermaid. Read the **Amendments** section: item donations (`OrganizationNeed` + `ItemDonation`) are the core differentiator, drop hand-rolled auth tables, store object-storage keys not URLs. |
| `misc.md` | Table-by-table longform, v1 - pre-amendment. |
| `org.md`, `volunteer.md`, `superadmin.md`, `PerRoleFeatures.txt` | Per-role flows/checklists. Current. |
| `README.md` | Accurate setup/run instructions (install, Supabase env, db push/seed, dev commands). |
| `bts.jsonc` | **Stale scaffold metadata.** Says `nestjs` but also `auth: none`, `dbSetup: supabase`. Ignore. |
