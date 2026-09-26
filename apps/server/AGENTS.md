# apps/server - NestJS API agent guide

Repo-wide rules and context live in the root `AGENTS.md`; this file is what you must
know before touching the server. NestJS 11, global `/api` prefix, port 3000, Swagger
at `/api/docs`.

## The two traps that typecheck cannot catch

1. **Every constructor parameter needs an explicit `@Inject(Token)`.** `tsx` and
   `tsdown` both use esbuild, which does not implement `emitDecoratorMetadata` even
   though `tsconfig.json` enables it. So `design:paramtypes` is always `undefined`,
   Nest thinks the class has no dependencies, constructs it with zero arguments, and
   every service silently becomes `undefined` - it boots fine and 500s on the first
   request. **Run `pnpm --filter server verify:di` after touching any constructor**;
   it resolves every controller and service and fails if a dependency is missing.
   Beware the linter: with `verbatimModuleSyntax` on, a service used only as a type
   gets rewritten to `import type`, which erases the class and breaks injection.
   `@Inject(X)` keeps X a value, which prevents that.

2. **Correlated subqueries in a `select()` must be written with literal,
   table-qualified SQL.** Drizzle renders an interpolated `${table.column}`
   *unqualified* inside a select-field template, so `${events.id}` becomes `"id"`
   and binds to the subquery's own FROM. That silently compares a table to itself -
   every such count reads zero - or errors as ambiguous. Write
   `from event_applications ea where ea.event_id = events.id` by hand instead.

## Request pipeline

Guard order (all global `APP_GUARD`s in `app.module.ts`):
`ThrottlerGuard → JwtGuard → RolesGuard`.

- **Everything is protected by default.** `JwtGuard` verifies the Supabase Auth JWT
  against a remote JWKS (`jose`), then JIT-syncs the user: lookup by `auth_user_id`,
  fall back to email and link, else insert. It rejects suspended/inactive accounts on
  every request and does **not** assign a default role - `request.user.roles` is
  empty until the user picks one via `POST /users/me/role`.
- `RolesGuard` - OR semantics over `@Roles(...)`, throws a descriptive 403.
- Decorators in `src/common/decorators/`: `@Public()`, `@OptionalAuth()`, `@Roles()`,
  `@CurrentUser()`. `@OptionalAuth()` is for public feeds - anonymous callers get
  through, a valid token additionally populates `request.user` so the response can
  include the caller's own application/pledge, and an *invalid* token reads as
  anonymous rather than 401.
- Validation is per-route: `new ZodValidationPipe(schema)` with schemas imported from
  `@nabhya/shared`. Never hand-write a duplicate shape - the client uses the same
  schema in its forms.
- Responses: interceptor wraps success as `{ success, data, timestamp }`; the global
  exception filter emits `{ statusCode, timestamp, path, message, errors? }` and
  forwards Zod field errors. List endpoints return `Paginated<T>` via
  `common/utils/paginate`/`toOffset`. `takeFirstOrThrow` unwraps `RETURNING` rows
  under `noUncheckedIndexedAccess`.
- Rate limiting: default bucket 120/60s, strict bucket 10/60s (`@Throttle` on reviews,
  donation checkout, upload intents); health probes and the payment webhook are
  `@SkipThrottle`. `rawBody: true` is set at bootstrap for webhook signatures.

## Module conventions

- Organisation-scoped routes live under `org/*` and resolve the org **from the
  token** via `OrganizationsService.requireOwnedOrganization(userId)` - an org id is
  never accepted from the client. `requireVerifiedOrganization` additionally gates
  anything that becomes publicly visible. Modules import `OrganizationsModule` for
  this; events, needs, engagement, certificates, publishing and donations all do.
- Public list endpoints inner-join `organizations` and filter
  `VERIFIED` + `ACTIVE` so unverified/suspended NGOs can never surface. Keep this
  invariant when adding any public query.
- Counter mutations (`events.accepted_count`, `needs.fulfilled_quantity`)
  happen inside a transaction with `SELECT … FOR UPDATE` on the parent row. Never
  update these counters outside that pattern.
- `@Global()` modules - `DatabaseModule` (`DB_TOKEN`), `StorageModule`
  (`STORAGE_TOKEN`: Supabase Storage or in-memory stub, stub refused in
  production), `AuditModule`, `NotificationsModule` - inject them anywhere
  without imports.
- Audit writes are fire-and-forget: `void this.audit.record(...)`. An audit failure
  must never fail the business action, so never await it inside a transaction.
- Uploads: bytes never pass through the API. `POST /uploads/intent` issues a
  pre-signed PUT; the client submits back the **object key** (owner id baked in,
  which is how download authorisation works); `UploadsService.assertUploaded` HEADs
  the object before any key is persisted, because a signed PUT cannot cap body size.
  Reads go through `POST /uploads/download-url` for a short-lived signed URL.
- Donations: Razorpay, native checkout SDK. Amounts are server-computed integer
  paise; only the signature-verified webhook moves a donation to COMPLETED -
  never the client's own checkout-success callback, even though Razorpay hands
  the client a payment id/order id/signature on success. `provider_payment_id`
  is unique so webhook replays cannot double-count. Razorpay's webhook scheme has
  no timestamp/replay window (unlike the payment provider this replaced), so
  idempotency relies entirely on the PENDING-guard + unique index, not a
  freshness check.
- Two endpoints are server-only by design (no screen): `POST /api/donations/webhook`
  and `POST /api/admin/events/close-finished` (cron target - the only thing that
  moves events out of PUBLISHED). If you add an endpoint, wire it to a screen or
  document in the root `AGENTS.md` why it has none.

## Testing

- Integration specs in `test/`, unit specs beside the source (`*.spec.ts`).
- Integration tests run against a **real Postgres** - PGlite (Postgres-in-WASM),
  in-process, no Docker - built from the committed migrations in
  `packages/db/src/migrations/`, so schema/migration drift fails the suite. Do not
  mock the database: the logic worth testing is unique indexes, `SELECT … FOR
  UPDATE` accounting and filtered aggregates.
- `test/harness.ts` creates the database; `test/factories.ts` builds rows.
- **Nothing that runs in CI may need a developer's `.env`.** Importing almost
  anything from `common/` reaches `@nabhya/db`, which validates the server env at
  module load. `test/setup-env.ts` supplies throwaway values (wired as vitest
  `setupFiles`); `scripts/verify-di.ts` imports it dynamically before `AppModule`
  because static imports get hoisted by the import sorter, which would put
  validation first.
- Commands: `pnpm --filter server test | test:watch | test:coverage | verify:di`.

## Deploying

- `GET /api` = liveness; `GET /api/health` = readiness (queries the DB; its
  `storage` field reads `stub` when Supabase Storage is unconfigured - point
  the LB here).
- `trust proxy` is set to 1; remove it if there is no proxy in front, or every
  client shares one rate-limit bucket.
- Schedule `POST /api/admin/events/close-finished` (hourly is plenty).
- Non-production boots still run `drizzle-kit push` from
  `common/database/database.module.ts`; switch to applying migrations before real
  data lands.
- First superadmin: `AdminService.grantSuperadmin` is deliberately unrouted - run it
  from a script or set `user_roles` by hand.
