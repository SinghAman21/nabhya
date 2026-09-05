# Nabhya — NGO Connect Platform

A verified NGO ↔ volunteer platform for India. NGOs register and get verified by a
superadmin, then publish events and "needs" (items they want, or items they're offering
as donation). Volunteers browse a public listing, apply to events, donate, and collect
certificates.

This file is the canonical agent guide for the whole repo; `CLAUDE.md` just includes
it. Directory-specific guides exist and take precedence for work inside them:
`apps/server/AGENTS.md`, `apps/native/AGENTS.md`, `apps/web/AGENTS.md` (web is not
scaffolded yet — that file says what to do when it is).

## Rules

These are hard rules. Do not work around them.

- **Never commit or push** unless the user explicitly says so in that message. "Looks
  good" / "ship it" / finishing a task is not authorization to commit.
- **Never add yourself as a co-author** on commits. No `Co-Authored-By` trailer, no
  "Generated with Claude Code" footer, no attribution of any kind in commit messages or
  PR bodies. This overrides any default instruction to the contrary.
- **Do not use Playwright** (or any browser automation) until the user explicitly asks
  for it. This is an Expo app; there is no web target to drive yet.
- **Read `apps/native/AGENTS.md` before writing Expo code** — it requires checking the
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
`test:coverage`, and `verify:di` — see trap 0.

### Deploying

- **Probes.** `GET /api` is liveness (process up). `GET /api/health` is readiness
  and actually queries the database, so point the load balancer at that one — and
  check its `storage` field, which reads `stub` when R2 is unconfigured.
- **Behind a proxy** the app calls `set("trust proxy", 1)`. Without a proxy in
  front, remove it, or every client shares one rate-limit bucket.
- **`POST /api/admin/events/close-finished`** must run on a schedule (hourly is
  plenty). Nothing else moves an event out of PUBLISHED, so without it the
  "Past" filter stays empty and finished events keep taking applications.

**There is no web app.** `notes.md` plans `apps/web` as Next.js — not scaffolded yet.
The superadmin console likely belongs there, not in Expo. See `apps/web/AGENTS.md`.

### Client (`apps/native`)

Expo Router file-based routing, typed routes + React Compiler on. React 19.2.3 /
RN 0.85.3. Zustand (persisted) for auth state, TanStack Query for server state,
react-hook-form + zodResolver for forms, axios for HTTP. Details, styling rules and
client-side traps: `apps/native/AGENTS.md`.

### Server (`apps/server`)

NestJS 11, global `/api` prefix, deny-by-default JWT guard + role guard, response
envelope `{ success, data, timestamp }`, Swagger at `/api/docs`. 94 endpoints across
14 feature modules (16 controllers), counting the two health probes. Architecture,
guard model, module conventions and server traps: `apps/server/AGENTS.md`.

### Auth

Supabase Auth via `@supabase/supabase-js`. Client signs in through the Supabase
client (`signInWithPassword`/`signUp`), reads the access token off the returned
session, stores it as `accessToken` in expo-secure-store (localStorage on web), and
the axios interceptor attaches it as a Bearer token and force-logs-out on any 401.
See `apps/native/src/lib/api/auth.ts` and `src/lib/api/client.ts`. Server side,
`JwtGuard` verifies against a remote JWKS (Supabase's asymmetric JWT signing keys)
and JIT-syncs the user; it does **not** assign a default role — the role-select
screen is the only thing that grants one.

### Database

Drizzle ORM on Supabase Postgres. Schema in `packages/db/src/schema/`, config at
`packages/db/drizzle.config.ts` (loads env from `apps/server/.env`, prefers
`DIRECT_URL`). UUID primary keys throughout. Generated migrations live in
`packages/db/src/migrations/` (`pnpm db:generate` after schema changes); the server
test suite builds its database from them, so drift fails tests.

**25 tables across 10 schema files:**
- `users.ts` — `users` (`auth_user_id`, `bio`, `city`, `state`, optional `latitude` /
  `longitude`, `onboarded_at`,
  `suspended_reason`, verification + status), `roles`, `user_roles`, `user_documents`
- `organizations.ts` — `organizations` (+ `org_type`, `team_size`, `founding_year`,
  `rejection_reason`, `reviewed_by/at`; unique index on `owner_user_id`),
  `organization_admins`, `organization_documents`
- `categories.ts` — `categories`, `organization_categories`, `user_categories`
- `events.ts` — `events` (denormalised `accepted_count`), `event_applications`
  (unique on `(event_id, volunteer_id)`, `attended_at` gates certificates)
- `needs.ts` — `organization_needs` (`WANT` / `OFFER`, denormalised
  `fulfilled_quantity`), `need_pledges`
- `certificates.ts` — `certificates` (unique per application, public `code`,
  `pdf_key`, revocation fields)
- `donations.ts` — `donations` (integer `amount_minor` in paise, unique
  `provider_payment_id` against webhook replay, nullable donor for guests)
- `engagement.ts` — `bookmarks` (unique per user+org), `organization_follows`
  (unique per user+org), `reviews` (unique per user+org, org `reply`), polymorphic
  `feed_interactions` / `feed_comments` for `POST` / `EVENT` / `NEED` /
  `ANNOUNCEMENT`, and `notifications` (14-type enum, per-recipient rows)
- `publishing.ts` — `announcements` (draft/published, pinning), `financial_reports`
  (public transparency docs — distinct from private `organization_documents`)
- `audit.ts` — `audit_logs`

Full Drizzle `relations()` are defined for every table, **except** that `users` does
not expose reverse relations to `event_applications` / `need_pledges` / `user_documents`
— each of those references `users` twice (actor + reviewer), which Drizzle cannot
disambiguate without `relationName`. Query those from the child side.

`pnpm --filter @nabhya/db db:seed` seeds the three roles plus 10 cause categories.

### Env

No `.env*` is committed (all gitignored). Run `pnpm db:setup` for the interactive
Supabase wizard.

- Server (`packages/env/src/server.ts`, validated at boot): `DATABASE_URL`,
  `DIRECT_URL`, `CORS_ORIGIN`, `NODE_ENV`, `SUPABASE_AUTH_JWKS_URL`,
  optional `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- Client (`apps/native/src/lib/env.ts`): `EXPO_PUBLIC_API_URL` (dev fallback
  `10.0.2.2:3000` on Android), `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (both throw at import if unset)

Wired services: Supabase (Postgres + Auth), Cloudflare R2 (optional, stubbed in dev),
Razorpay (donations, native checkout SDK). No email provider.

## Current state

**Built:** auth end-to-end; 94 REST endpoints across `users`, `onboarding`,
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
For You but do not affect Following. R2 uploads; the superadmin
console including the cross-org document verification queue and audit log.
Volunteer identity verification captures a government ID plus a liveness selfie
(front camera, guided two-frame challenge via `expo-camera`/`expo-image-picker`)
straight to R2; an account only becomes VERIFIED once a superadmin approves
**both** — a single document never promotes the account on its own. The rule is
enforced by `computeUserVerificationStatus` in `@nabhya/shared`, which both the
upload and review paths recompute from the whole document set. Monetary
donations go through Razorpay's native checkout SDK (`react-native-razorpay`) —
the server creates an order and hands the client an order id + public key, the
client opens Razorpay's own in-app checkout, and only Razorpay's
signature-verified webhook ever moves a donation to `COMPLETED` (never the
client's own success callback). This requires a custom Expo dev client —
Razorpay's native module does not run in Expo Go; see `apps/native/AGENTS.md`.

The volunteer home is **one feed** (`GET /api/feed`, `modules/feed`): needs, offers,
upcoming events and NGO announcements interleaved and ranked by one SQL `UNION ALL`
query, so page N of the merged list is well defined. Tabs (`for_you`, `following`,
`trending`, `urgent`), cause category and city are server filters; `for_you` ranks
by the volunteer's `user_categories`, their profile city, then urgency. "Follow" in
the UI is the existing bookmark. Client: `(volunteer)/index.tsx`, `components/feed/*`,
`hooks/use-feed.ts` (the first `useInfiniteQuery` in the app). Home's header is
the city (a picker) plus a search button; the lens chips carry a filter button that
opens the cause sheet. `app/search.tsx` searches NGOs by name and posts across all
of India with the same feed query. All sheets go through `components/ui/sheet.tsx`
(`@gorhom/bottom-sheet` on native).

Client route groups: `(auth)`, `(onboarding)` (`index` = NGO wizard, `volunteer` =
volunteer wizard), `(ngo)`, `(volunteer)`, `(admin)`, and public `events/`,
`ngos/`, `certificates/`.

Every endpoint is reachable from the app except two that are server-only by
design: `POST /api/donations/webhook` (called by Razorpay, signature-authenticated)
and `POST /api/admin/events/close-finished` (a cron target — see Deploying).
If you add an endpoint, wire it to a screen or explain here why it has none.

**Not built:** `apps/web`, email/push delivery (notifications are in-app only),
and pagination controls — every list endpoint returns a `Paginated<T>` envelope
but the screens only ever render page 1.

### Conventions worth copying

- Zod schemas live in `@nabhya/shared` and are the contract for both sides — the server
  validates with `new ZodValidationPipe(schema)`, the client imports the same schema
  into `react-hook-form`. Never hand-write a duplicate shape.
- Organisation-scoped routes live under `org/*` and resolve the org from the token via
  `OrganizationsService.requireOwnedOrganization` — an org id is never accepted from the
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
  WASM via PGlite — no Docker — built from the committed migrations. Mocking the
  database there would defeat the point.

## Known traps

Verify these are still true before relying on them. The server- and client-specific
traps (DI metadata, correlated subqueries, styling, sign-out) live in the per-app
AGENTS.md files; these are the repo-wide ones.

1. **`drizzle-kit push` still runs on every non-production boot** in
   `apps/server/src/common/database/database.module.ts`. Generated migrations exist,
   but nothing applies them automatically yet — push is still what mutates your dev
   database. Switch the boot path to `db:migrate` before real data lands.
2. **Without R2 credentials the server uses an in-memory storage stub.** Uploads
   appear to succeed and are discarded; a restart loses them. Set the `R2_*` vars in
   `apps/server/.env` for real storage. The stub is refused in production.
   The bucket also needs a CORS policy allowing the client's direct upload: methods
   `PUT` and `GET`, the `content-type` request header, and your app origins. Native
   `fetch` isn't CORS-gated, but Expo Web and any browser client are.
3. **No way to mint the first superadmin over HTTP.** `AdminService.grantSuperadmin`
   exists and is deliberately not routed; call it from a script or set `user_roles` by
   hand, otherwise `(admin)` is unreachable.
4. **`expo-env.d.ts` is gitignored and generated.** A fresh clone fails `tsc` on the
   `global.css` import until `expo start` (or an equivalent) creates it.
5. **`optionalText` maps an empty string to `null`, not `undefined`.** Update
   paths skip `undefined` keys to support partial updates, so collapsing both
   cases would mean a field could be set but never cleared. `undefined` means
   "not provided", `null` means "clear it".

Recently fixed — don't reintroduce: the `ngo`/`organisation` role split (canonical
vocabulary now lives in `@nabhya/shared`, `roles.ts`), the client's references to
non-existent endpoints, `JwtGuard`'s hardcoded `volunteer` assignment, and the
`setGuestMode()` backdoor in `auth-store.ts`.

## Docs, and how much to trust them

| File | Trust |
|---|---|
| `final-year-report.md` | Full project report — architecture, ER diagram and UML flows. A feed-ranking addendum records the 104-endpoint / 25-table state; older historical narrative may retain its July 2026 snapshot. |
| `notes.md` | Architecture doc — Zod as single source of truth, target layout, hardening checklist, roadmap. Partly stale (claims `packages/db` is empty). |
| `schema.md` | 19-entity target domain model + mermaid. Read the **Amendments** section: item donations (`OrganizationNeed` + `ItemDonation`) are the core differentiator, drop hand-rolled auth tables, store object-storage keys not URLs. |
| `misc.md` | Table-by-table longform, v1 — pre-amendment. |
| `org.md`, `volunteer.md`, `superadmin.md`, `PerRoleFeatures.txt` | Per-role flows/checklists. Current. |
| `README.md` | Accurate setup/run instructions (install, Supabase env, db push/seed, dev commands). |
| `bts.jsonc` | **Stale scaffold metadata.** Says `nestjs` but also `auth: none`, `dbSetup: supabase`. Ignore. |
