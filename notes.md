# Architecture Notes — Nabhya

NGO social platform: NGOs onboard and get verified; volunteers discover NGOs, donate items, or offer help.

## Principle

**Zod schemas are the single source of truth.** Every input shape, validation rule, and TypeScript type is defined once in `packages/shared/` and consumed by both the NestJS API and the clients. No manual type duplication, no drift between frontend and backend.

## Monorepo Structure (target)

```
nabhya/
  packages/
    shared/         ← Zod schemas + inferred types (requests AND responses)
    db/             ← Drizzle schema + queries (currently EMPTY — top priority)
    api-client/     ← (planned) HTTP client + TanStack Query hooks, shared by native + web
    design/         ← (planned) design tokens + shared Tailwind preset (colors, spacing, type)
    env/            ← t3-oss env validation
    config/         ← biome, tsconfig

  apps/
    server/         ← NestJS 11 API (Swagger at /api/docs)
    native/         ← React Native (Expo SDK 56) — Android + iOS
    web/            ← (planned) Next.js — discovery, marketing, NGO/admin dashboards
```

## The Flow (implemented)

1. **Define once** in `packages/shared` — e.g. `signUpSchema`, per-step onboarding schemas, plus a merged `onboardingSchema`.
2. **Server validates** via `ZodValidationPipe` (`apps/server/src/common/pipes/zod-validation.pipe.ts`) — controllers import the shared schema, never re-declare validation.
3. **Clients validate** via `react-hook-form` + `zodResolver(sameSchema)` — inline field errors before submit, payload shape guaranteed to match the API.

> Status: shared package, validation pipe, RHF forms, and the 5-step onboarding UI all exist. What remains is making the backend real (see below).

### Response schemas too — not just inputs

Hand-written response types (e.g. a plain `SignUpResponse` interface) reintroduce the drift this doc exists to prevent. Rule:

- Every endpoint gets a Zod **response** schema in `packages/shared`.
- The client parses responses (`schema.parse(res.data)`) so a backend shape change fails loudly at the boundary, not silently deep in the UI.
- The server response envelope (`{ success, data, timestamp }` from the transform interceptor) is itself a shared schema that wraps the per-endpoint data schema.

## Database-First (the current blocker)

`packages/db/src/schema/index.ts` is empty; everything downstream is blocked on it. Design for the **full domain from day one**, not just NGOs:

- `users` — id, email, password hash, `role: 'ngo' | 'volunteer' | 'admin'`. The volunteer side needs the role column now, even before volunteer features exist.
- `organizations` — 1:1 with an NGO user; name, phone, org type, address fields, team size, founding year, description, website, logo URL, verification status.
- `documents` — org KYC uploads (registration, PAN, logo): storage key, type, review status.
- `refresh_tokens` — hashed refresh tokens for rotation/revocation.
- Later: `needs` (what an NGO is asking for), `donations` (item pledges), `volunteer_offers`.

Use **`drizzle-zod`** to generate base Zod schemas from tables so DB ⇄ validation can't drift either; shared schemas refine/extend the generated ones.

Migrations: generated via `drizzle-kit generate` and applied in CI/deploy — no `drizzle-kit push` against prod.

## Auth — Better Auth (adopted)

Auth is handled by **Better Auth** (wired with Neon Auth), not hand-rolled JWT:

- Better Auth owns the `user`, `session`, `account`, `verification` tables — no custom password hashing, refresh-token, or email-verification tables.
- App-specific user fields (`role: 'ngo' | 'volunteer' | 'admin'`, `phone`, `profile_photo`, `verification_status`) live as Better Auth additional fields or a 1:1 `user_profile` table.
- NestJS guard validates the Better Auth session; `@Public()` opts routes out, `@CurrentUser()` resolves the session user.
- Rate limiting (`@nestjs/throttler`) still applies on auth routes.
- See `schema.md` → Amendments for the full DB reconciliation.

## Onboarding state lives server-side

Today `isOnboarded` / step progress lives only in Zustand — lost on reinstall, and trivially spoofable by editing local state. The backend stores the current step + completion; the client caches it via TanStack Query and hydrates the store from the API, not the other way around.

## Web App Strategy

Web ships as **Next.js with plain Tailwind**, not react-native-web/universal components.

**Share these across native + web:**
- `packages/shared` — schemas/types
- `packages/api-client` — HTTP client + TanStack Query hooks (this is where the real duplication is)
- `packages/design` — design tokens extracted from `apps/native/src/constants/design-system.ts` into a Tailwind **preset** consumed by both NativeWind (native) and Tailwind (web). Same colors/spacing/typography → identical look without shared components.

**Do NOT share rendered components.** Universal UI (Tamagui/Solito/react-native-web inside Next.js) means the web app renders RN primitives forever: everything is client-side (no server components), SEO/SSR ergonomics suffer, bundles grow, and web-only needs (hover, tables, complex layout) fight the abstraction. Nabhya's web surface (public NGO discovery = SEO-critical, plus admin/dashboard) diverges from the mobile screens anyway.

Cost of this choice: UI primitives (Button, Input, Card) are written twice. That's cheap and predictable; debugging react-native-web inside Next.js is neither. Revisit only if web turns out to be ~90% the same screens as mobile.

## Production Hardening Checklist

- [ ] **Env validation at boot** — `packages/env` enforced in server bootstrap; missing `DATABASE_URL` fails startup, not first query.
- [ ] **API versioning** — client expects `/api/v1/...`, server serves `/api/...`. Adopt NestJS URI versioning (`v1`) now, before more endpoints exist.
- [ ] **Security middleware** — helmet, explicit CORS allowlist.
- [ ] **Rate limiting** — `@nestjs/throttler`, strictest on auth.
- [ ] **Structured logging** — pino (nestjs-pino), request IDs.
- [ ] **Health check** — `GET /health` for deploy probes.
- [x] **File uploads** — documents/logos go to Supabase Storage via **presigned URLs**; the API stores keys + metadata only, never proxies file bytes.
- [ ] **Error envelope** — global exception filter already exists; keep error shapes in a shared Zod schema too.
- [ ] **CI** — biome + typecheck + build on PR; migrations applied on deploy.

## Roadmap (order matters)

1. `packages/db` schema (full domain, both roles) + first migration.
2. Real auth: register/login/refresh/logout with guard + hashing + rotation.
3. Server-side onboarding state + document upload (presigned URLs) + verification status.
4. Extract `packages/design` (tokens + Tailwind preset) and `packages/api-client`; replace remaining mock mutations.
5. `apps/web` (Next.js): public NGO discovery + NGO dashboard.
6. Volunteer side: signup with role, browse NGOs, needs/donations/offers.

## Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `zod` | shared, native, web, server | Schema definition + validation |
| `drizzle-zod` | db, shared | Generate Zod schemas from tables |
| `react-hook-form` + `@hookform/resolvers` | native, web | Form state + Zod bridge |
| `argon2`, `@nestjs/jwt` | server | Auth |
| `@nestjs/throttler`, `helmet`, `nestjs-pino` | server | Hardening |

## Why Not Alternatives

| Alternative | Why not |
|-------------|---------|
| **gRPC** | Protobuf compile step, no Zod reuse, overkill for CRUD without streaming. |
| **tRPC** | Fights NestJS DI/middleware patterns; better with Next-only stacks. |
| **GraphQL** | Duplicates schema definition (SDL + Zod), codegen build step; unnecessary for this data shape. |
| **class-validator** | Decorator-based, doesn't work in the plain-TS shared package. Zod works everywhere. |
| **Tamagui / Solito / react-native-web for web** | See Web App Strategy — logic + tokens are shared, components are not. |
