# Phase 2 — Payout Service & Route API Client

**Status:** COMPLETED  
**Date:** 2026-11-14  
**Branch / Commit:** No commit (pending user sign-off)

---

## Goal

Implement the `PayoutsModule` — NestJS service, Razorpay Route API client, controller,
and module wiring — so that:

1. An NGO can submit their banking + KYC profile (`POST /api/org/payout`).
2. When a superadmin verifies an NGO, Razorpay Route onboarding is triggered in the background.
3. Admins can inspect and retry-sync any NGO's payout profile.
4. The refund endpoint placeholder is registered (full logic in Phase 3).

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/server/src/modules/payouts/razorpay-route.service.ts` | Thin HTTP client for Razorpay Route's 4-step linked-account onboarding API |
| `apps/server/src/modules/payouts/payouts.service.ts` | Business logic: save profile, start onboarding, handle webhook events, retry sync |
| `apps/server/src/modules/payouts/payouts.controller.ts` | 5 endpoints (GET/POST org/payout, GET admin org payout, POST retry-sync, POST refund placeholder) |
| `apps/server/src/modules/payouts/payouts.module.ts` | NestJS module wiring |
| `packages/db/src/migrations/0019_payout_notification_types.sql` | Adds `PAYOUT_ACTIVATED` and `PAYOUT_ONBOARDING_FAILED` to `notification_type` enum |

## Files Modified

| File | Change |
|------|--------|
| `apps/server/src/app/app.module.ts` | Added `PayoutsModule` to `imports[]` |
| `apps/server/src/modules/admin/admin.module.ts` | Added `PayoutsModule` to `imports[]` |
| `apps/server/src/modules/admin/admin.service.ts` | Added `@Inject(PayoutsService)` to constructor; `void this.payoutsService.startOnboarding(organizationId)` on VERIFIED |
| `packages/shared/src/engagement.ts` | Added `PAYOUT_ACTIVATED`, `PAYOUT_ONBOARDING_FAILED` to `notificationTypeSchema` |
| `packages/db/src/schema/engagement.ts` | Added `PAYOUT_ACTIVATED`, `PAYOUT_ONBOARDING_FAILED` to `notificationTypeEnum` |
| `packages/db/src/migrations/meta/_journal.json` | Appended entry idx 19 for migration 0019 |
| `apps/server/test/endpoints.spec.ts` | Updated route count: `148 → 153` (5 new routes) |

---

## New Endpoints (5 routes → count: 148 → 153)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/org/payout` | `organisation` | Get calling NGO's payout profile |
| `POST` | `/api/org/payout` | `organisation` | Submit/update NGO banking & KYC profile |
| `GET` | `/api/admin/organizations/:id/payout` | `superadmin` | Inspect any NGO's payout profile |
| `POST` | `/api/admin/organizations/:id/payout/retry-sync` | `superadmin` | Re-trigger Razorpay onboarding for stuck profiles |
| `POST` | `/api/admin/donations/:id/refund` | `superadmin` | Placeholder (Phase 3 implementation) |

---

## Architecture Decisions

### `RazorpayRouteService`

- Pure HTTP client — no DB writes, no state.
- Uses `fetch` with `Basic ${base64(keyId:keySecret)}` auth.
- Reads `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` lazily via a `credentials` getter;
  throws `InternalServerErrorException` if unset (same pattern as `StubPaymentProvider`).
- Each of the 4 steps is a separate method so `PayoutsService` can:
  - Persist identifiers after each step (idempotent resume).
  - Skip steps whose identifiers are already stored.
- **Step 4 (`linkBankAccount`)** receives the plaintext account number from the caller
  — `PayoutsService` decrypts it inline and passes it. It is never logged.

### `PayoutsService`

- **`savePayoutProfile`** — encrypts account number with AES-256-GCM, extracts last 4,
  upserts `organization_payout_profiles`, sets status `SUBMITTED`.
- **`startOnboarding`** — fire-and-forget from `AdminService.reviewOrganization`.
  Steps through the 4 Razorpay calls, persisting IDs after steps 1 & 2 so a retry
  can resume. On any failure: sets status `NEEDS_CLARIFICATION` + `statusReason`,
  fires `PAYOUT_ONBOARDING_FAILED` notification. On success: sets `UNDER_REVIEW`.
- **`handleAccountWebhook`** — maps Razorpay account events to enum values and
  notifies the NGO team for `ACTIVATED` / `REJECTED` / `NEEDS_CLARIFICATION`.
- **`retrySync`** — resets identifiers to `NOT_STARTED` and re-triggers `startOnboarding`.
  Only allows retry from `NOT_STARTED`, `SUBMITTED`, `NEEDS_CLARIFICATION`, `REJECTED`.

### Migration 0019

PGlite (the test harness) cannot run multiple SQL statements in one prepared call.
Migration 0019 uses `-->statement-breakpoint` between the two `ALTER TYPE ... ADD VALUE`
statements so the harness runs each one separately.

---

## Verification Results

```
pnpm --filter server verify:di
  Checked 42 injectable class(es) — All dependencies resolved ✓
  (was 39 before Phase 2; added PayoutsController, PayoutsService, RazorpayRouteService)

pnpm --filter server test src/common/crypto/encryption.spec.ts
  5/5 passed ✓

pnpm --filter server test test/donations.spec.ts
  18/18 passed ✓
  (migration 0019 ran cleanly through PGlite)
```

---

## What Phase 3 Will Do

1. **Razorpay account webhooks** — `POST /api/payouts/webhook` calling `handleAccountWebhook`.
2. **Transfer logic** — after a donation `COMPLETED`, initiate a Razorpay Route transfer
   to the NGO's linked account ID; store `razorpayTransferId` + `transferStatus`.
3. **Refund implementation** — `POST /api/admin/donations/:id/refund` using
   `razorpay.payments.refund()`.
4. **80G receipt PDF** — attach donor PAN + address when `wants80G` is true.
