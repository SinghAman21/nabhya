# Nabhya — NGO Connect Platform

A verified NGO ↔ volunteer platform for India. NGOs register and get verified by a
superadmin, then publish events and "needs" (items they want, or items they're offering
as donation). Volunteers browse a public listing, apply to events, donate, and collect
certificates.

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
  versioned Expo SDK 56 docs rather than working from memory.

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
scripts/         interactive Neon setup wizard (pnpm db:setup)
```

Root scripts: `dev`, `build`, `check`, `db:setup|push|studio|generate|migrate`.

**There is no web app.** `notes.md` plans `apps/web` as Next.js — not scaffolded yet.
The superadmin console likely belongs there, not in Expo.

### Client (`apps/native`)

Expo Router file-based routing, typed routes + React Compiler on. React 19.2.3 /
RN 0.85.3. Zustand (persisted) for auth state, TanStack Query for server state,
react-hook-form + zodResolver for forms, axios for HTTP.

Two styling systems coexist: NativeWind v4 + Tailwind 3.4 (brand primary `#FF7E40`)
with shadcn-style `@rn-primitives` components in `src/components/ui/`, *and* a token
system in `src/constants/design-system.ts` consumed via `useTheme()`. Most screens use
inline `style={{}}` from the tokens rather than Tailwind classes. Match whatever the
file you're editing already does.

Routing gate is `src/app/index.tsx`: no email → `/(auth)/login`, no role →
`/role-select`, NGO not onboarded → `/(onboarding)`, else the role tab group. Guards in
`(ngo)/_layout.tsx` and `(volunteer)/_layout.tsx` are **client-side only** and read role
from persisted Zustand — not from the server.

### Server (`apps/server`)

`src/index.ts`: global `/api` prefix, CORS from `CORS_ORIGIN`, global exception filter,
response envelope `{ success, data, timestamp }`, Swagger at `/api/docs`.

Two global guards in `app.module.ts`:
- `JwtGuard` — everything is protected by default. Verifies the Neon Auth JWT against a
  remote JWKS, then JIT-syncs the user (lookup by `neon_user_id`, fall back to email and
  link, else insert) and rejects suspended/inactive accounts. It does **not** assign a
  default role — `request.user.roles` is empty until the user picks one, so the
  role-select screen is the only thing that grants a role.
- `RolesGuard` — OR semantics over `@Roles(...)`, throws a descriptive 403.

Decorators in `src/common/decorators/`: `@Public()`, `@OptionalAuth()`, `@Roles()`,
`@CurrentUser()`. `@OptionalAuth()` is for the public feed — anonymous callers get
through, and a valid token additionally populates `request.user` so the response can
include the caller's own application/pledge. An invalid token reads as anonymous.

`AuditModule` is global and provides `AuditService`. Writes are fire-and-forget
(`void this.audit.record(...)`) — an audit failure must never fail the business action.

`common/utils/`: `paginate`/`toOffset` for the `Paginated<T>` envelope every list
endpoint returns, and `takeFirstOrThrow` for unwrapping `RETURNING` rows under
`noUncheckedIndexedAccess`.

### Auth

Neon Auth (Better Auth underneath) via `@neondatabase/auth`. Client signs in through
the Better Auth adapter, calls `getJWTToken()`, stores it as `accessToken` in
expo-secure-store (localStorage on web), and the axios interceptor attaches it as a
Bearer token and force-logs-out on any 401. See `apps/native/src/lib/api/auth.ts` and
`src/lib/api/client.ts`.

### Database

Drizzle ORM on Neon Postgres. Schema in `packages/db/src/schema/`, config at
`packages/db/drizzle.config.ts` (loads env from `apps/server/.env.local`, prefers
`DIRECT_URL`). UUID primary keys throughout.

**14 tables:**
- `users.ts` — `users` (`neon_user_id`, `bio`, `city`, `state`, `onboarded_at`,
  `suspended_reason`, verification + status), `roles`, `user_roles`, `user_documents`
- `organizations.ts` — `organizations` (+ `org_type`, `team_size`, `founding_year`,
  `rejection_reason`, `reviewed_by/at`; unique index on `owner_user_id`),
  `organization_admins`, `organization_documents`
- `categories.ts` — `categories`, `organization_categories`, `user_categories`
- `events.ts` — `events` (denormalised `accepted_count`), `event_applications`
  (unique on `(event_id, volunteer_id)`)
- `needs.ts` — `organization_needs` (`WANT` / `OFFER`, denormalised
  `fulfilled_quantity`), `need_pledges`
- `audit.ts` — `audit_logs`

Full Drizzle `relations()` are defined for every table, **except** that `users` does
not expose reverse relations to `event_applications` / `need_pledges` / `user_documents`
— each of those references `users` twice (actor + reviewer), which Drizzle cannot
disambiguate without `relationName`. Query those from the child side.

`pnpm --filter @nabhya/db db:seed` seeds the three roles plus 10 cause categories.

### Env

No `.env*` is committed (all gitignored). Run `pnpm db:setup` for the interactive Neon
wizard.

- Server (`packages/env/src/server.ts`, validated at boot): `DATABASE_URL`,
  `DIRECT_URL`, `CORS_ORIGIN`, `NODE_ENV`, `NEON_AUTH_URL`, `NEON_AUTH_JWKS_URL`
- Client (`apps/native/src/lib/env.ts`): `EXPO_PUBLIC_API_URL` (dev fallback
  `10.0.2.2:3000` on Android), `EXPO_PUBLIC_NEON_AUTH_URL` (throws at import if unset)

Wired services: Neon + Neon Auth only. No object storage, no email provider, no
payments.

## Current state

**Built:** auth end-to-end; the 14 tables above; ~50 REST endpoints across
`users`, `onboarding`, `organizations`, `categories`, `events`, `needs` and `admin`;
NGO + volunteer onboarding wired to the API; org events and needs management with
applicant/pledge review; the public event feed and apply flow; the superadmin console.

Client route groups: `(auth)`, `(onboarding)` (`index` = NGO wizard, `volunteer` =
volunteer wizard), `(ngo)`, `(volunteer)`, `(admin)`, and public `events/`.

**Not built:** monetary donations/payments, certificates, reviews, bookmarks,
notifications, announcements, financial reports, and file uploads (see traps).

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
- Client data access is `lib/api/services.ts` (thin, typed) → `hooks/use-*.ts`
  (TanStack Query) → screens. Query keys are centralised in `lib/api/query-keys.ts`.
- Screens compose `components/screen-shell.tsx` (`ScreenHeader`, `Surface`,
  `EmptyState`, `LoadingState`, `ErrorState`, `FilterChips`) + `status-pill.tsx`.

## Known traps

Verify these are still true before relying on them.

1. **`drizzle-kit push` runs on every non-production boot** in
   `apps/server/src/common/database/database.module.ts`, and `src/migrations/` doesn't
   exist. Data-loss footgun once there are real records — move to generated migrations
   before any real data lands.
2. **Document URLs are plain text columns with no upload path.** Verification is the
   spine of the product, but nothing writes these — the upload endpoints take a URL
   string. Needs S3/R2 before verification works end to end.
3. **No way to mint the first superadmin over HTTP.** `AdminService.grantSuperadmin`
   exists and is deliberately not routed; call it from a script or set `user_roles` by
   hand, otherwise `(admin)` is unreachable.
4. **The Tailwind config is light-mode only** (hard-coded hex, no dark variants), while
   screens theme through `useTheme()`. That's why cards/pills are composed from `View` +
   theme tokens instead of the shadcn `Card`/`Badge`, which would stay light-on-light in
   dark mode. Use those primitives only if you first make the Tailwind theme dark-aware.
5. **`expo-env.d.ts` is gitignored and generated.** A fresh clone fails `tsc` on the
   `global.css` import until `expo start` (or an equivalent) creates it.

Recently fixed — don't reintroduce: the `ngo`/`organisation` role split (canonical
vocabulary now lives in `@nabhya/shared`, `roles.ts`), the client's references to
non-existent endpoints, `JwtGuard`'s hardcoded `volunteer` assignment, and the
`setGuestMode()` backdoor in `auth-store.ts`.

## Docs, and how much to trust them

| File | Trust |
|---|---|
| `notes.md` | Architecture doc — Zod as single source of truth, target layout, hardening checklist, roadmap. Partly stale (claims `packages/db` is empty). |
| `schema.md` | 19-entity target domain model + mermaid. Read the **Amendments** section: item donations (`OrganizationNeed` + `ItemDonation`) are the core differentiator, drop hand-rolled auth tables, store object-storage keys not URLs. |
| `misc.md` | Table-by-table longform, v1 — pre-amendment. |
| `org.md`, `volunteer.md`, `superadmin.md`, `PerRoleFeatures.txt` | Per-role flows/checklists. Current. |
| `README.md` | **Stale boilerplate.** Says Hono and `bun install`. Ignore. |
| `bts.jsonc` | **Stale scaffold metadata.** Says `nestjs` but also `auth: none`, `dbSetup: supabase`. Ignore. |
