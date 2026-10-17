# Deployment

Two deploy targets:

| Piece | Where | What it runs |
|---|---|---|
| **API** (`apps/server`, NestJS) | **Render** (Web Service + Cron Job) | Long-running Node process, global prefix `/api` |
| **Web** (`apps/native`, Expo web export) | **Vercel** (static) | react-native-web bundle of the Expo app |

The mobile app is **not** deployed by either — it ships through EAS Build to the
Play Store / App Store (see the bottom of this file). `apps/web` (the planned
Next.js app) does not exist yet.

The two targets are coupled by exactly two things:
- the web client's `EXPO_PUBLIC_API_URL` → the Render URL,
- the server's `CORS_ORIGIN` → the Vercel URL.

Get one wrong and the app loads but every API call is blocked or hangs.

---

## Part 1 — API on Render

### Repo-specific gotchas (read before configuring)

1. **The listen port is hardcoded.** `apps/server/src/index.ts:92` is
   `await app.listen(3000)` and never reads `PORT`. Render injects `PORT` and
   routes to that port, so pick one:
   - **Set `PORT=3000`** in Render's env (no code change), **or**
   - **Patch the line** to `await app.listen(Number(process.env.PORT) || 3000);`.
   If `PORT` and the hardcoded value disagree, Render's health check fails and
   the service never goes live.
2. **`NODE_ENV=production` disables schema push.** `database.module.ts:31` skips
   `drizzle-kit push` in production. Migrations must run via a **Pre-Deploy
   Command** (below) or the tables won't exist.
3. **Production refuses the stub providers.** With `NODE_ENV=production`,
   `storage.module.ts`, `donations.module.ts` and `mail.module.ts` **throw on
   boot** unless real Supabase Storage, Razorpay and Resend credentials are set.
   So those vars are mandatory in prod, not optional.
4. **Behind a proxy** `trust proxy` is set automatically in production
   (`index.ts:29`) — correct for Render. Don't unset `NODE_ENV=production` or it
   is dropped and every client shares one rate-limit bucket.

### Service config

New → **Web Service** → connect the repo.

| Setting | Value |
|---|---|
| Root Directory | repo root (blank / `.`) |
| Runtime | Node |
| Node version | 22 (matches root `engines`; set `NODE_VERSION=22` if needed) |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter server build` |
| Start Command | `node apps/server/dist/index.mjs` |
| Pre-Deploy Command | `pnpm --filter @nabhya/db db:migrate` |
| Health Check Path | `/api/health` |

`pnpm` is used (root `packageManager: pnpm@10.10.0`); Render handles it via corepack.

> `apps/server`'s `start` script is `node dist/index.mjs`, and `tsdown` emits
> exactly `apps/server/dist/index.mjs` — verified.

> If you instead set Root Directory = `apps/server`, use Build
> `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter server build` and
> Start `node dist/index.mjs`. The repo-root variant is simpler.

### Environment variables (Render)

**Required:**

| Var | Notes |
|---|---|
| `NODE_ENV` | `production` (triggers `trust proxy`, skips push, enforces stubs below) |
| `PORT` | `3000` **only if** you keep the hardcoded listen port |
| `DATABASE_URL` | Supabase pooled connection (port 6543) |
| `DIRECT_URL` | Supabase direct connection (port 5432); migrations use this |
| `CORS_ORIGIN` | comma-separated web origins — see "CORS_ORIGIN" below |
| `SUPABASE_AUTH_JWKS_URL` | JwtGuard verifies tokens against this |
| `SUPABASE_URL` | Supabase Storage — **required in prod** (boot throws without it) |
| `SUPABASE_SERVICE_ROLE_KEY` | same |
| `RAZORPAY_KEY_ID` | **required in prod** |
| `RAZORPAY_KEY_SECRET` | same |
| `RAZORPAY_WEBHOOK_SECRET` | same |
| `RESEND_API_KEY` | **required in prod** (`mail.module.ts:12` throws without it) |

**Optional / have defaults:**

| Var | Default | Notes |
|---|---|---|
| `MAIL_FROM_EMAIL` | `noreply@graphex.me` | must be on a domain **verified in Resend** |
| `MAIL_FROM_NAME` | `Nabhya` | display name |
| `TEAM_INVITE_URL_BASE` | first `CORS_ORIGIN` entry | base URL for team-invite accept links |

Do **not** set any `EXPO_PUBLIC_*` here — those are client-side and belong on
Vercel.

### CORS_ORIGIN

Comma-separated list of **browser** origins, exact match, no trailing slash and
no path. `index.ts:39` splits on `,` and checks exact membership, so no
wildcards:

```
https://nabhya.vercel.app,https://your-custom-domain.com
```

- Native apps, curl, server-to-server and the Razorpay webhook send no `Origin`
  header and are always allowed — do **not** list the mobile app.
- Vercel **preview** deployments get random URLs and will be blocked unless each
  is listed.
- `localhost` is auto-allowed in dev only; don't add it in production.
- The schema requires `min(1)`, so it can't be empty.

### Migrations and seeding

- **Migrations:** the Pre-Deploy Command runs `pnpm --filter @nabhya/db db:migrate`.
  `drizzle.config.ts` reads `DIRECT_URL` straight from `process.env`, so it works
  without an `.env` file.
- **Seed once:** roles + the 10 cause categories must exist. Run a one-off job:
  ```
  pnpm --filter @nabhya/db db:seed
  ```
  (Or `pnpm db:seed` from the repo root.)

### Cron job

Add a Render **Cron Job**, hourly, calling `POST /api/admin/events/close-finished`.
Nothing else moves an event out of PUBLISHED, so without it the "Past" filter
stays empty and finished events keep taking applications.

**Caveat:** that route is guarded `@Roles("superadmin")` + JWT
(`publishing.controller.ts:342`), so the job must send a superadmin Bearer token.
There is no secret-header bypass today; the token will eventually expire.

### First superadmin

`AdminService.grantSuperadmin` is deliberately unrouted. Set `user_roles` by hand
or run a script against the prod DB — otherwise the `(admin)` console is
unreachable.

### Verify

- `https://nabhya.onrender.com/api/health` → readiness. Its `storage` field must
  read `supabase`, not `stub`.
- `https://nabhya.onrender.com/api` → liveness.
- Swagger: `https://nabhya.onrender.com/api/docs`.

---

## Part 2 — Web on Vercel

### Service config

Import the repo, then:

| Setting | Value |
|---|---|
| Root Directory | `apps/native` |
| Framework Preset | `Other` (pinned by `apps/native/vercel.json` → `"framework": null`) |
| Install Command | default; if workspace resolution fails, `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `expo export --platform web` (from `vercel.json`) |
| Output Directory | `dist` (from `vercel.json`) |

`apps/native/vercel.json` already carries the build/output/rewrites:

```json
{
  "framework": null,
  "buildCommand": "expo export --platform web",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/ngos/:id", "destination": "/ngos/[id].html" },
    { "source": "/events/:id", "destination": "/events/[id].html" },
    { "source": "/needs/:id", "destination": "/needs/[id].html" },
    { "source": "/certificates/:code", "destination": "/certificates/[code].html" },
    { "source": "/team/invites/:token", "destination": "/team/invites/[token].html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Why the rewrites: the static export emits dynamic routes as literal
`[id].html` files, so `/ngos/abc` has no matching file without a rewrite.
`cleanUrls` maps `/queue` → `queue.html`; Vercel checks the filesystem before
rewrites, so prerendered pages win and the catch-all only catches client-only
paths.

### Environment variables (Vercel)

Only these three, each set for **Production and Preview**:

| Var | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://nabhya.onrender.com` (no `/api`, no trailing slash) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

- `resolveApiUrl()` strips a trailing `/api` anyway (`env.ts:86`); endpoints add
  `/api` themselves.
- **Preview must have `EXPO_PUBLIC_API_URL` too.** Preview builds run in
  production mode, so a missing value makes `env.ts:83` **throw during export**.
- Server-only vars (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_AUTH_JWKS_URL`,
  `NODE_ENV`, `CORS_ORIGIN`, …) do **not** belong here. They are not inlined into
  the bundle (Expo only inlines `EXPO_PUBLIC_*`), but they're dead weight and
  invite confusion with the Render config.
- All `EXPO_PUBLIC_*` are **inlined at build time** — changing one requires a
  redeploy.

### Deploy and verify

- Deploy (`vercel --prod` or connect the repo; pushes auto-deploy by default).
- Load `/` — app shell renders.
- Open `/ngos/<id>` and `/certificates/<code>` — confirms the rewrites.
- Sign in and load the feed — confirms CORS + `EXPO_PUBLIC_API_URL`.
- Add a custom domain under Project → Domains, then add that origin to the
  server's `CORS_ORIGIN` too.

---

## Mobile app (context only)

Not covered by Vercel or Render. `react-native-razorpay` is a native module, so
Expo Go won't run it — every contributor needs a custom dev client
(`npx expo prebuild` once, then `expo run:android` / `run:ios`, then
`expo start --dev-client`). Production ships via **EAS Build** → Play Store /
App Store, with `EXPO_PUBLIC_API_URL` set to the Render URL in the EAS build env.

---

## Cutover order

1. **Render:** create the service, set env, deploy. Run `db:seed` once. Confirm
   `/api/health` reports `supabase`.
2. **Render:** add the hourly cron job (needs a superadmin token).
3. **Mint the first superadmin.**
4. **Vercel:** set the three `EXPO_PUBLIC_*` vars (Production + Preview), deploy.
5. **Back to Render:** add the Vercel URL to `CORS_ORIGIN`, redeploy.
6. Set `EXPO_PUBLIC_API_URL` in the EAS build env for the mobile app.

## Secrets hygiene

- Nothing is committed to `.env*` (all gitignored). Set vars in the Render and
  Vercel dashboards.
- `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_*`, `RESEND_API_KEY` and the DB URLs are
  server-only — never on Vercel, never with an `EXPO_PUBLIC_` prefix.
