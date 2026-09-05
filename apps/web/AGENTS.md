# apps/web — not scaffolded yet

There is **no web app**. This directory holds only this guide; do not import from it,
add it to CI, or "fix" its absence from the workspace. `notes.md` at the repo root
plans it as a Next.js app, and the superadmin console currently living in the Expo
`(admin)` group most likely belongs here once it exists.

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
- Talk to the existing API only (`/api`, port 3000, CORS via `CORS_ORIGIN` — add
  the web origin there). Do not add web-only endpoints without wiring them into the
  server's conventions (guards, Zod pipes, `Paginated<T>`, org scoping from the
  token — see `apps/server/AGENTS.md`).
- Good first scope: the superadmin console (verification queues, moderation, audit
  log) plus SEO-friendly public pages — NGO profiles, event pages, and the
  certificate verification page (`GET /api/certificates/:code/verify` is public by
  design).
- Only after a web target exists does browser automation (Playwright) become
  fair game — and still only when the user explicitly asks for it.
