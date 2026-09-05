# nabhya

A verified NGO ↔ volunteer platform for India. See `AGENTS.md` for the full
architecture guide — this file is just how to get it running locally.

## Stack

pnpm workspaces + Turborepo, NestJS 11 server, Expo (React Native) client,
Drizzle ORM on Supabase Postgres, Supabase Auth. Node >= 22, `pnpm@10.10.0`.

```
apps/native      Expo SDK 56 + Expo Router (the client)
apps/server      NestJS 11 API, global prefix /api, port 3000
packages/db      Drizzle schema + pg client        (@nabhya/db)
packages/env     env validation                     (@nabhya/env)
packages/shared  Zod schemas shared client<->server  (@nabhya/shared)
packages/config  base biome/tsconfig                 (@nabhya/config)
scripts/         interactive Supabase setup wizard (pnpm db:setup)
```

## 1. Install dependencies

From the repo root (installs every workspace package, server and client included):

```bash
pnpm install
```

## 2. Set up a Supabase project

You need one Supabase project providing both the Postgres database and auth:

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Project Settings → Authentication → Sessions** (or Providers → Email): set JWT
   signing keys to **asymmetric (ES256/RS256)**. This is required — the server
   verifies tokens against a JWKS endpoint that only exists in asymmetric mode.
3. **Authentication → Sign In / Providers → Email**: since this app has no email
   provider wired yet, turn off **"Confirm email"** — otherwise signup won't return
   a session until a confirmation email is clicked, and none gets sent.
4. **Project Settings → Database**: copy the **Transaction pooler** connection string
   (port `6543`) and the **Session pooler** connection string (port `5432`) — see
   the note below on why the session pooler is used instead of Supabase's own
   "Direct connection" entry.
5. **Project Settings → API**: copy the **Project URL** and the **anon / public**
   key (never the `service_role` key — that one must never leave the server).

> **Why the session pooler instead of "Direct connection":** Supabase's direct
> connection host (`db.<ref>.supabase.co`) is IPv6-only unless your project has the
> IPv4 add-on enabled, which fails to resolve on plenty of networks/ISPs. The
> session pooler (same host as the transaction pooler, port `5432` instead of
> `6543`) is IPv4-reachable and works just as well for the single, stable
> connection Drizzle Kit needs for migrations.

## 3. Configure environment files

Neither app reads a committed env file — you create these yourself, and both are
gitignored. **The server reads `.env`; the client reads `.env.local`** (Expo's own
env loading prioritizes `.env.local` automatically, so no extra config is needed
there) — don't mix these up.

**`apps/server/.env`** (create this file):

```bash
# Pooled connection (transaction-mode pgbouncer, port 6543) — used by the app.
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"

# Session pooler (port 5432) — used by Drizzle Kit for push/generate/studio.
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

CORS_ORIGIN="http://localhost:8081"
NODE_ENV="development"

SUPABASE_AUTH_JWKS_URL="https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"
```

`<project-ref>`, `<password>` and `<region>` come from the connection strings you
copied in step 2. R2 (object storage) and Dodo (payments) vars are optional — see
`apps/server/.env.example` for the full list; leaving them unset falls back to
in-memory stubs in development.

Fastest path for this file: run `pnpm db:setup` from the repo root — an interactive
wizard that asks for these same values and writes the file for you.

**`apps/native/.env.local`** (create this file):

```bash
EXPO_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="<anon-public-key>"

# Optional in development — falls back to 10.0.2.2:3000 on the Android emulator
# and localhost:3000 elsewhere. Required for a physical device: use your
# machine's LAN IP, e.g. http://192.168.1.42:3000
# EXPO_PUBLIC_API_URL="http://192.168.1.42:3000"
```

## 4. Push the database schema and seed it

```bash
pnpm db:push    # applies packages/db/src/schema to Supabase
pnpm --filter @nabhya/db db:seed   # seeds the 3 roles + 10 cause categories
```

`db:seed` reads env relative to its own working directory, not `apps/server/`, so
if it can't find your Supabase credentials, export them into your shell first:

```bash
set -a; source apps/server/.env; set +a
pnpm --filter @nabhya/db db:seed
```

## 5. Run it

**Server** (NestJS API on `http://localhost:3000/api`, Swagger at `/api/docs`):

```bash
pnpm --filter server dev
# or, from the repo root: pnpm dev:server
```

**Client** (Expo):

```bash
cd apps/native
pnpm dev            # same as: pnpm start
pnpm android         # open on Android emulator/device
pnpm ios             # open on iOS simulator/device
pnpm web             # not a real target yet — no web app is scaffolded
```

**Both at once** from the repo root (Turborepo runs every app's `dev` script):

```bash
pnpm dev
```

## Feed-ranking API (server-only)

The server exposes a unified feed that mixes generic posts, published events, open needs
and published announcements. The first client integration is intentionally pending; test
these routes through Swagger at `http://localhost:3000/api/docs` or an API client.

| Route | Access | Purpose |
|---|---|---|
| `GET /api/feed/for-you` | Optional auth | Personalized ranking. Uses Haversine distance when optional user coordinates are set, otherwise city/state; also considers category interests, follows, recency, urgency and engagement. |
| `GET /api/feed/trending` | Public | Recent, time-decayed engagement ranking. A valid optional token adds location context and viewer flags. |
| `GET /api/feed/following` | Authenticated | Reverse-chronological content from explicitly followed organizations. |
| `POST` / `DELETE /api/organizations/:id/follow` | Authenticated | Follow or unfollow a verified, active NGO. |
| `POST` / `DELETE /api/feed/:type/:id/like` | Authenticated | Like/unlike an item. |
| `POST` / `DELETE /api/feed/:type/:id/save` | Authenticated | Save/unsave an item. |
| `POST /api/feed/:type/:id/share` | Authenticated | Record a share. |
| `POST /api/feed/:type/:id/impression` | Authenticated | Record an impression; recent impressions down-rank For You only. |
| `GET` / `POST /api/feed/:type/:id/comments` | Public / authenticated | List or add comments. |

`type` is one of `POST`, `EVENT`, `NEED`, or `ANNOUNCEMENT` (route matching is case-insensitive).
The schema change is included in migration `0007_feed_ranking.sql`; run `pnpm db:push` in
local development before exercising these routes.

## Everyday scripts

- `pnpm check` — Biome lint/format (writes fixes)
- `pnpm --filter server test` / `test:watch` / `test:coverage` — server test suite
  (runs against a real Postgres compiled to WASM via PGlite, no live database needed)
- `pnpm --filter server verify:di` — catches NestJS dependency-injection mistakes
  that `tsc` can't (run this after touching any constructor)
- `pnpm db:generate` — generate a Drizzle migration after a schema change
- `pnpm db:studio` — Drizzle Studio, a GUI over your Supabase database

See `AGENTS.md` for the full architecture guide, per-role feature docs, and the
list of known traps before making non-trivial changes.
