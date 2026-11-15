# Phase 3 — Payment Provider Transfers, Webhooks & 80G Receipts

**Status:** COMPLETED  
**Date:** 2026-11-14  
**Branch / Commit:** No commit (per agent rules: user authorization required)

---

## Goal

1. Wire Razorpay Route `transfers` payload into the checkout order creation flow.
2. Implement Route transfer webhooks (`transfer.processed`, `transfer.failed`) and dispatch `account.*` events to `PayoutsService`.
3. Gate direct donations: verified organizations must have an `ACTIVATED` payout profile with a linked account id before accepting live donations.
4. Implement full donation refund logic with `reverse_all: 1` in `PayoutsService.refundDonation`.
5. Update donation receipt generation (`receipt-pdf.ts`) with 80G Form 10BD details (donor PAN, address) and direct settlement wording.

---

## Files Modified

| File | Change |
|------|--------|
| `apps/server/src/modules/donations/payment.types.ts` | Added `destinationAccountId`, `transferAmountMinor` to `CheckoutRequest`; added `TRANSFER_PROCESSED`, `TRANSFER_FAILED`, `ACCOUNT_UPDATED` to `PaymentEventKind`; added `RefundRequest` and `RefundResult` interfaces. |
| `apps/server/src/modules/donations/razorpay-payment.provider.ts` | Added `transfers: [{ account, amount, currency, notes }]` on order creation; added handlers for `transfer.processed`, `transfer.failed`, and `account.*` webhooks; implemented `refund()` with `reverse_all: 1`. |
| `apps/server/src/modules/donations/stub-payment.provider.ts` | Updated stub checkout to accept Route accounts; added simulation for `transfer.processed`, `transfer.failed`, and `account.*` webhooks; implemented stub `refund()`. |
| `apps/server/src/modules/donations/donations.service.ts` | Gated donations on `payoutProfile.razorpayStatus === 'ACTIVATED'` (in live mode); saved `destinationAccountId`, `transferAmountMinor`, `transferStatus: PENDING`, `wants80G`, `donorPan`, `donorAddress`; expanded `handleWebhook` for Route transfer events and dispatched account webhooks to `payoutsService`; injected `PayoutsService`. |
| `apps/server/src/modules/donations/donations.module.ts` | Imported `PayoutsModule`. |
| `apps/server/src/modules/donations/receipt-pdf.ts` | Added `wants80G`, `donorPan`, `donorAddress`, `organizationPan`, `isDirectSettlement` to `ReceiptContent`; updated facts table and notes to reflect direct settlement and 80G compliance. |
| `apps/server/src/modules/payouts/razorpay-route.service.ts` | Added `getAccount(accountId)` and `refundPayment(paymentId, amountMinor, reverseAll)` methods. |
| `apps/server/src/modules/payouts/payouts.service.ts` | Implemented `refundDonation(adminId, donationId)` with `reverse_all: 1` and `syncStatus(organizationId)`. |
| `apps/server/src/modules/payouts/payouts.controller.ts` | Wired `POST /api/admin/donations/:id/refund` to `payouts.refundDonation`. |
| `apps/server/test/donations.spec.ts` | Added tests for 80G checkout recording, `transfer.processed` webhook handler, and `transfer.failed` webhook handler (all 21/21 passed). |
| `apps/server/test/endpoints.spec.ts` | Registered `PayoutsController` in test controller list; verified total 153 endpoints. |

---

## Key Design Implementations

### 1. Route Transfer Order Payload
When a donor initiates checkout for an active NGO:
- The server checks `organization_payout_profiles` for `razorpayAccountId`.
- The order payload sent to Razorpay includes:
  ```json
  {
    "amount": 250000,
    "currency": "INR",
    "receipt": "donation_uuid",
    "notes": { "referenceId": "donation_uuid" },
    "transfers": [
      {
        "account": "acc_xxxx",
        "amount": 250000,
        "currency": "INR",
        "notes": { "referenceId": "donation_uuid" },
        "on_hold": 0
      }
    ]
  }
  ```
- Funds settle directly into the NGO's bank account with zero intermediate holding by Nabhya.

### 2. State Machine for Route Transfers
- `PENDING`: Initial state upon checkout creation.
- `PROCESSED`: Webhook `transfer.processed` sets `transferStatus = 'PROCESSED'` and records `razorpayTransferId`.
- `FAILED`: Webhook `transfer.failed` sets `transferStatus = 'FAILED'` and records `transferFailureReason`.
- `REVERSED`: Refund webhook or admin refund call sets `transferStatus = 'REVERSED'` and `status = 'REFUNDED'`.

### 3. Refunds with Reverse All
- When an admin triggers `POST /api/admin/donations/:id/refund`, `payoutsService.refundDonation` calls Razorpay's refund API with:
  ```json
  {
    "amount": 250000,
    "reverse_all": 1
  }
  ```
- This ensures the transfer to the linked account is reversed along with the payment refund.

### 4. 80G Form 10BD Compliance
- When `wants80G: true`, `donorPan` and `donorAddress` are persisted on the donation row.
- `renderReceiptPdf()` includes the donor PAN in the facts table and updates the disclaimer to confirm that 80G records were saved for Form 10BD filing by the NGO.

---

## Verification Results

```
pnpm --filter server verify:di
  Checked 42 injectable class(es) — All dependencies resolved ✓

pnpm --filter server test src/common/crypto/encryption.spec.ts
  5/5 passed ✓

pnpm --filter server test test/donations.spec.ts
  21/21 passed ✓ (all 18 original tests + 3 new Route & 80G tests)

pnpm --filter server test test/endpoints.spec.ts
  exposes the expected number of endpoints (153) ✓
  mounts every route under the /api prefix ✓
  names every public route explicitly ✓
  names every optional-auth route explicitly ✓
```
