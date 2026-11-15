# Phase 6 — Testing, Developer Tooling & Verification

**Status:** COMPLETED  
**Date:** 2026-11-14  
**Branch / Commit:** No commit (per agent rules: user authorization required)

---

## Goal

1. Provide developer tooling to simulate HMAC-signed Razorpay Route webhooks locally without needing a live webhook tunnel (`simulate-razorpay-route-webhook.ts`).
2. Add end-to-end integration tests for `PayoutsService` (profile encryption, masking, account webhooks, retry-sync, and direct refunding).
3. Execute the full regression and dependency injection verification suite.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `apps/server/scripts/simulate-razorpay-route-webhook.ts` [NEW] | CLI tool to trigger HMAC-SHA256 signed `transfer.processed`, `transfer.failed`, and `account.*` events against `http://localhost:3000/api/donations/webhook`. |
| `apps/server/package.json` | Added npm script alias `"simulate:route-webhook": "tsx scripts/simulate-razorpay-route-webhook.ts"`. |
| `apps/server/test/payouts.spec.ts` [NEW] | 9 integration tests covering `savePayoutProfile`, masking, AES-256-GCM verification, account webhooks, retry sync guards, and direct refunds. |
| `apps/server/src/modules/payouts/payouts.service.ts` | Omitted string `"system"` in `audit.record` to comply with Postgres UUID `performed_by` column. |

---

## Developer Tooling Usage

Developers can test Razorpay Route webhooks locally:

```bash
# 1. Simulate direct settlement transfer succeeding:
pnpm --filter server run simulate:route-webhook transfer <donationId> processed

# 2. Simulate direct settlement transfer failing at beneficiary bank:
pnpm --filter server run simulate:route-webhook transfer <donationId> failed

# 3. Simulate an NGO's Razorpay Route account being activated:
pnpm --filter server run simulate:route-webhook account <organizationId> activated

# 4. Simulate an NGO's KYC needing clarification:
pnpm --filter server run simulate:route-webhook account <organizationId> needs_clarification
```

---

## Final Verification Results

```
pnpm --filter server verify:di
  Checked 42 injectable class(es) — All dependencies resolved ✓

pnpm --filter server test src/common/crypto/encryption.spec.ts test/donations.spec.ts test/payouts.spec.ts
  Test Files: 3 passed (3)
  Tests:      35 passed (35)
    - src/common/crypto/encryption.spec.ts (5 tests) ✓
    - test/donations.spec.ts (21 tests) ✓
    - test/payouts.spec.ts (9 tests) ✓

pnpm --filter server test test/endpoints.spec.ts
  exposes the expected number of endpoints (153) ✓
  mounts every route under the /api prefix ✓
```
