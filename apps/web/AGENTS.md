# apps/web - no separate web package

There is **no separate `apps/web` package**. The existing Expo app has an Android
target and an Expo Web rendering target under `apps/native`; this directory holds
only this guide. Do not import from it, add it to CI, or treat it as an existing
Next.js app. `docs/architecture/notes.md` is a historical proposal for a separate
Next.js app, and the superadmin console currently lives in the Expo `(admin)` group.

If you are asked to scaffold it:

- Make it a pnpm workspace package (`apps/web` with its own `package.json`) wired
  into Turborepo's `dev`/`build`/`check-types` tasks, using the shared presets from
  `@nabhya/config` and **Biome** (not ESLint/Prettier).
- Reuse the contracts: request/response shapes come from `@nabhya/shared` (Zod),
  role vocabulary from its `roles.ts` (`volunteer` / `organisation` / `superadmin`),
  env validation validated at import (follow the pattern of
  `apps/native/src/lib/env.ts`, or extend `@nabhya/env` with a client entry);
  nothing committed to `.env*`.
- Auth is Supabase Auth via `@supabase/supabase-js`'s browser client: sign in with
  `signInWithPassword`/`signUp`, read the access token off the session, send it as a
  Bearer token; on web the token lives in localStorage. Mirror the native client's
  force-logout-on-401 interceptor behaviour (see `apps/native/src/lib/api/auth.ts`
  and `client.ts` for the pattern to follow).
- Talk to the existing API only (`/api`, port 3000, CORS via `CORS_ORIGIN` - add
  the web origin there). Do not add web-only endpoints without wiring them into the
  server's conventions (guards, Zod pipes, `Paginated<T>`, org scoping from the
  token - see `apps/server/AGENTS.md`).
- Good first scope: the superadmin console (verification queues, moderation, audit
  log) plus SEO-friendly public pages - NGO profiles, event pages, and the
  certificate verification page (`GET /api/certificates/:code/verify` is public by
  design).
- The Expo Web rendering target already exists inside `apps/native`. Do not use
  browser automation just because that target exists; the root guide requires an
  explicit user request. This directory's future separate web package does not
  change that rule.
