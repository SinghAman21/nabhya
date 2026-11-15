# Razorpay Route: direct-to-NGO donations

Status: backend_completed (Phases 0-4 and Phase 6 Completed; Phase 5 Frontend Documented)
Last updated: 2026-11-14

## Progress tracker

| Phase | Description | Status | Evidence / Notes |
|---|---|---|---|
| **Phase 0** | Architecture decisions & security design | **`[COMPLETED]`** | Isolated table + AES-256-GCM encryption selected |
| **Phase 1** | Schema, encryption & shared contracts | **`[COMPLETED]`** | Migration 0018, `payouts.ts`, `encryption.ts`, shared schemas |
| **Phase 2** | Route API client & Payouts NestJS module | **`[COMPLETED]`** | `RazorpayRouteService`, `PayoutsService`, `PayoutsController`, migration 0019 — 42 DI classes ✓, 18/18 tests ✓ |
| **Phase 3** | Provider `transfers` payload & webhook state machine | **`[COMPLETED]`** | Route transfers in checkout, `transfer.*` webhooks, 80G Form 10BD PDF receipt, `refundDonation` with `reverse_all: 1` — 21/21 tests ✓ |
| **Phase 4** | Admin approval hook, audit logs & notifications | **`[COMPLETED with Phase 2/3]`** | Hook in `reviewOrganization`, retry sync, audit trail, team notifications |
| **Phase 5** | Client screens (NGO bank setup, DonateSheet 80G, Admin) | `[ON HOLD - DOCS READY]` | Follow `docs/plans/frontend-razorpay-route.md` |
| **Phase 6** | End-to-end integration tests & test-mode validation | **`[COMPLETED]`** | `simulate-razorpay-route-webhook.ts`, `test/payouts.spec.ts` (9/9 ✓), full suite (35/35 ✓) |

---

## Goal

Make every donation settle directly into the receiving NGO's bank account using
Razorpay Route. Each NGO becomes a Razorpay linked account under the platform
account. Checkout orders carry a `transfers` entry for the full donation amount,
so Nabhya never holds or forwards donor money.

Razorpay Route is the chosen model. The alternatives were rejected:

- **RazorpayX collect-then-payout** keeps donor money in the platform account
  before paying it out, which adds holding and compliance risk.
- **NGO-owned Razorpay accounts** add onboarding friction and do not fit the
  single-checkout product.

## Verdict

The existing donation code is a clean base: one `PaymentProvider` adapter, one
signature-verified webhook, server-computed paise amounts, and a unique
`provider_payment_id` replay guard. There is no legacy payment provider to
migrate; `razorpay-payment.provider.ts` is the only real adapter and
`stub-payment.provider.ts` is dev-only.

The hard part is not adding `transfers` to the order call. It is the payout
onboarding lifecycle, the activation gate, and refund/reversal.

## Prioritised gaps

### P0 - must be closed before a single live donation

1. **No payout data model.** `organizations.ts` has no PAN/bank/Route fields,
   and `donations.ts` has no transfer/refund columns
   (`packages/db/src/schema/organizations.ts:86-142`,
   `packages/db/src/schema/donations.ts:34-83`). Nothing records whether an NGO
   can actually receive money.
2. **Orders do not route money.** `RazorpayPaymentProvider.createCheckout`
   sends only `amount`, `currency`, `receipt`, `notes`
   (`apps/server/src/modules/donations/razorpay-payment.provider.ts:46-52`).
   Without a `transfers` array, every donation settles to the platform account.
3. **No activation gate.** `DonationsService.createCheckout` only checks
   `VERIFIED` + `ACTIVE` through `getPublicById`
   (`apps/server/src/modules/donations/donations.service.ts:73-76`). A verified
   NGO with no Route account still gets a checkout.
4. **No Route API client at all.** Nothing calls `POST /v2/accounts`,
   stakeholders, `/products`, or the settlement `PATCH`. There is no `payouts`
   module.
5. **Webhooks only understand payments.** `parseWebhook` maps
   `payment.captured`, `payment.failed`, `refund.processed`; everything else
   becomes `IGNORED` (`razorpay-payment.provider.ts:107-139`).
   `transfer.processed`, `transfer.failed`, `settlement.processed`,
   `product.route.under_review`, `product.route.needs_clarification`, and
   `product.route.activated` are all dropped. `PaymentEvent` has no
   transfer/account fields (`payment.types.ts`).
6. **No idempotency for Route events.** The existing protection is
   `provider_payment_id` unique plus the PENDING-only guard
   (`donations.service.ts:154-157`). Route events reference account/product/
   transfer ids, so they need their own state guards.
7. **Refund/reversal is broken and unrouted.** `refund.processed` is parsed from
   `payload.payment.entity` (`razorpay-payment.provider.ts:127-133`), but
   Razorpay sends refunds under `payload.refund.entity`. There is no refund API
   call and no `reverse_all`.
8. **Sensitive-data handling is undefined.** There is no encryption utility
   anywhere in the server. Worse, `getById` spreads **every** organization
   column and is used by the public `GET /organizations/:id`
   (`organizations.service.ts:179-205`). Adding bank/PAN columns to
   `organizations` would leak them publicly.
9. **No admin or NGO payout UX.** The admin dossier has no payout section; the
   NGO verification journey has only Documents -> Review -> Verified
   (`apps/native/src/lib/org-verification.ts:113`); there is no payout screen
   or retry path.
10. **No test-mode Route path.** `scripts/simulate-razorpay-webhook.ts` only
    fires `payment.captured`/`payment.failed`, and the stub has no Route
    simulation (`stub-payment.provider.ts`).

### P1 - needed for a coherent launch

- Onboarding does not collect legal name, PAN, bank, or stakeholder details
  (`onboarding.service.ts:102-128`; `packages/shared/src/onboarding.ts`;
  `packages/shared/src/organization.ts:19-22`).
- Admin approval has no payout hook (`admin.service.ts:576-641`), and
  `AdminModule` imports only `FeedModule` (`admin.module.ts:8`).
- The public organization payload has no `donationsEnabled` flag, so
  `ngos/[id].tsx` always opens `DonateSheet`
  (`apps/native/src/app/ngos/[id].tsx:221-229`).
- The donation ledger/export has no transfer or refund columns
  (`donations.service.ts:284-321`, `332-419`; `AdminDonationRow` at
  `packages/shared/src/donations.ts:154-171`).
- No payout permission exists; `money.view` is the nearest action
  (`packages/shared/src/publishing.ts:149-191`).
- Receipt wording still says "Nabhya collects on the NGO's behalf"
  (`receipt-pdf.ts:38-39`, `145-147`) - inaccurate once funds settle directly.
- `test/endpoints.spec.ts:264` hardcodes 148 routes, so every new route must
  update it deliberately.

### P2 - operational polish

- No payout attention count on the admin dashboard, and no "sync from Razorpay"
  fallback if a webhook is missed.
- No notification types for payout activation/failure (the notification enum is
  in `packages/db/src/schema/engagement.ts`).
- No reconciliation view (donation amount vs transferred amount vs platform
  fee).
- Pre-existing, not caused by this work: `getById` already returns the owner's
  email/phone on the public profile. Do not add payout data to that payload.

## Implementation plan

### Phase 0 - decisions that shape the code `[COMPLETED]`

- `[COMPLETED]` **Store payout state in a separate `organization_payout_profiles` table, not on `organizations`.** 1:1, keeps sensitive fields out of public queries, and lets admin dossier join explicitly.
- `[COMPLETED]` **Field-level AES-256-GCM authenticated encryption at rest.** Bank account number encrypted via `node:crypto`; only masked `bankAccountLast4` stored plaintext. Key managed via `ENCRYPTION_MASTER_KEY`.
- `[COMPLETED]` **Full amount transfers with fee support in v1.** `transferAmountMinor` and `platformFeeMinor` columns added.
- `[COMPLETED]` **Indian 80G Form 10BD compliance.** `wants80G`, `donorPan`, and `donorAddress` added to donation schema and tables.
- `[PENDING]` **Rollout: block donations until payout activation.** Notify verified NGOs and give them a "Set up payouts" screen.

### Phase 1 - schema and shared contracts `[COMPLETED]`

- `[COMPLETED]` New `packages/db/src/schema/payouts.ts`:
  - `razorpay_onboarding_status` enum: `NOT_STARTED | SUBMITTED | UNDER_REVIEW | ACTIVATED | NEEDS_CLARIFICATION | REJECTED | SUSPENDED`.
  - `organization_payout_profiles`: `organizationId` unique FK, `legalEntityName`, `businessType`, `pan`, `bankAccountEncrypted`, `bankAccountLast4`, `ifsc`, `bankName`, `bankBranch`, `accountHolderName`, `signatoryName`, `signatoryEmail`, `signatoryPhone`, `signatoryDob`, `signatoryPan`, `signatoryAddress`, `razorpayAccountId`, `razorpayStakeholderId`, `razorpayStatus`, `statusReason`, `requirementsDue`, `isPennyDropVerified`, `pennyDropRegisteredName`, `activatedAt`, timestamps.
- `[COMPLETED]` `packages/db/src/schema/donations.ts`: added `transfer_status` enum (`PENDING | PROCESSED | FAILED | REVERSED`), `platformFeeMinor`, `transferAmountMinor`, `destinationAccountId`, `razorpayTransferId`, `transferStatus`, `transferFailureReason`, `wants80G`, `donorPan`, `donorAddress`.
- `[COMPLETED]` `packages/db/src/schema/index.ts`: exported the payouts module.
- `[COMPLETED]` Migration `packages/db/src/migrations/0018_payout_profiles_and_transfers.sql` generated, applied, and registered in `meta/_journal.json`.
- `[COMPLETED]` New `packages/shared/src/payout.ts`: `PAN_REGEX`, `IFSC_REGEX`, `BANK_ACCOUNT_REGEX`, `razorpayOnboardingStatusSchema`, `createPayoutProfileSchema` (with confirm account number refinement), `payoutProfileViewSchema` (masked response DTO), and business type schemas. Exported from `packages/shared/src/index.ts`.
- `[COMPLETED]` `packages/shared/src/donations.ts`: updated `createDonationSchema` to include `wants80G`, `donorPan`, and `donorAddress` with validation refinement.
- `[COMPLETED]` `packages/env/src/server.ts`: added `ENCRYPTION_MASTER_KEY` (32-byte hex validation), with test-env fallback in `apps/server/test/setup-env.ts`.
- `[COMPLETED]` `apps/server/src/common/crypto/encryption.ts`: implemented AES-256-GCM `encrypt()` and `decrypt()` with 100% test coverage in `encryption.spec.ts`.
- `[COMPLETED]` Tests verified: `encryption.spec.ts` (5/5 passing), `donations.spec.ts` (18/18 integration tests passing against PGlite with migration 0018), and `verify:di` (39/39 injectable classes passing).

### Phase 2 - Route service and module `[PENDING]`

- `[PENDING]` New `apps/server/src/modules/payouts/razorpay-route.service.ts`:
  - `createLinkedAccount(orgId)`: `POST /v2/accounts` with legal entity mapping.
  - `createStakeholder(accountId, signatoryInput)`: `POST /v2/accounts/{id}/stakeholders`.
  - `requestRouteProduct(accountId)`: `POST /v2/accounts/{id}/products`.
  - `linkBankAccount(accountId, bankDetails)`: Decrypts `bankAccountEncrypted` in-flight and sends to Razorpay.
  - `syncStatus(orgId)`: Reconcile status directly from Razorpay.
- `[PENDING]` New `apps/server/src/modules/payouts/payouts.service.ts`:
  - `savePayoutProfile(orgId, input)`: Encrypts bank account number, stores last-4, saves KYC details.
  - `getPayoutProfile(orgId)`: Returns masked DTO (`bankAccountLast4`, masked PAN).
  - `retryOnboarding(orgId)`: Triggers sync with Razorpay.
- `[PENDING]` New `payouts.controller.ts`:
  - `GET /api/org/payout`, `POST /api/org/payout`.
  - `GET /api/admin/organizations/:id/payout`, `POST /api/admin/organizations/:id/payout/retry-sync`.
- `[PENDING]` Register `PayoutsModule` in `app.module.ts`, update `test/endpoints.spec.ts` inventory.

### Phase 3 - payment provider, webhook, donations `[PENDING]`

- `[PENDING]` `payment.types.ts`: extend `CheckoutRequest` with transfer target (`destinationAccountId`, `transferAmountMinor`).
- `[PENDING]` `razorpay-payment.provider.ts`:
  - `createCheckout`: pass `transfers: [{ account, amount, currency, notes }]`.
  - `parseWebhook`: handle `transfer.processed`, `transfer.failed`, `account.activated`, `account.needs_clarification`, `account.rejected`.
- `[PENDING]` `donations.service.ts`:
  - `createCheckout`: check that NGO's `payoutProfile.razorpayStatus === 'ACTIVATED'`.
  - `handleWebhook`: split payment capture from transfer lifecycle and account updates.
- `[PENDING]` `receipt-pdf.ts`: update receipt template with NGO PAN, 80G URN, and donor PAN/address.

### Phase 4 - admin approval, notifications, audit `[PENDING]`

- `[PENDING]` `admin.service.ts`: in `reviewOrganization`, trigger background linked account onboarding when status becomes `VERIFIED`.
- `[PENDING]` Add audit actions: `PAYOUT_PROFILE_SUBMITTED`, `PAYOUT_ONBOARDING_TRIGGERED`, `PAYOUT_ACTIVATED`, `PAYOUT_SYNC_FAILED`.
- `[PENDING]` Add notifications: alert NGO team on `PAYOUT_ACTIVATED` or `PAYOUT_NEEDS_CLARIFICATION`.

### Phase 5 - client `[PENDING]` (Follow `docs/plans/frontend-razorpay-route.md`)

- `[PENDING]` NGO Payout setup form & status card in `(ngo)/verification.tsx`.
- `[PENDING]` Real-time IFSC lookup hook (`useIfscLookup`).
- `[PENDING]` Volunteer DonateSheet gatekeeper & 80G tax receipt opt-in.
- `[PENDING]` Superadmin dossier payout info & "Retry Razorpay Sync" button.

### Phase 6 - tests and verification `[PENDING]`

- `[PENDING]` Integration tests for Route checkout gating.
- `[PENDING]` Route webhook simulation script (`scripts/simulate-razorpay-route-webhook.ts`).
- `[PENDING]` Full regression run (`pnpm --filter server test`, `verify:di`).

- `lib/api/endpoints.ts`: `PAYOUTS` constants and admin payout/refund
  constants.
- `lib/api/services.ts` / `services-v3.ts`: `payoutsApi` (`mine`, `save`,
  `retry`, `adminGet`, `adminRetry`, `adminSync`, `refundDonation`).
- `lib/api/query-keys.ts`: `myPayout`, `adminPayout`.
- `hooks/use-organization.ts`: `useMyPayout`, `useSavePayout`,
  `useRetryPayout`.
- `hooks/use-admin.ts`: `useAdminPayout`, `useRetryPayout`,
  `useRefundDonation`.
- `lib/types/domain.ts`: `PayoutStatus`, `MyPayout`, `AdminPayout`; add
  `donationsEnabled` to `PublicOrganizationDetail`, `payout` to
  `AdminOrgDetail`, and transfer fields to `OrgDonation`.
- New `app/(ngo)/payouts.tsx` (recommended) or a fourth stage in
  `(ngo)/verification.tsx`: legal name, PAN, bank details, stakeholder details;
  status banner for `UNDER_REVIEW` / `NEEDS_CLARIFICATION` / `FAILED`;
  re-submit.
- `components/nav-items.ts`: add a Payouts row for the NGO rail; link from
  `(ngo)/donations.tsx` and `(ngo)/edit.tsx`.
- `app/ngos/[id].tsx`: use `donationsEnabled`; disable the Donate button and
  show "Donations open once this NGO finishes payout setup."
- `components/admin/org-detail-sheet.tsx`: add a Payouts `FactGroup` (status,
  account id, last-4, reason) and Retry/Sync controls.
- `(admin)/finance.tsx` and `(ngo)/donations.tsx`: show transfer status; add the
  admin refund action.
- Update `(volunteer)/giving.tsx` and receipt copy if the 80G sentence changes.

### Phase 6 - tests and verification

- `apps/server/test/donations.spec.ts`: checkout refused when payout is not
  activated; transfer payload present; transfer webhook updates the donation;
  duplicate delivery is a no-op; refund sets `REFUNDED` and reverses.
- New `apps/server/test/payouts.spec.ts`: mocked `fetch` for Route calls; status
  transitions; `needs_clarification` retry; permission checks; `syncStatus`.
- `apps/server/test/admin.spec.ts`: approval starts onboarding; dossier includes
  payout; rejection does not start it.
- `razorpay-payment.provider.spec.ts`: transfer payload, Route event parsing,
  refund payload parsing.
- Run `pnpm --filter server test`, `pnpm --filter server verify:di`,
  `pnpm check`, and `pnpm --filter @nabhya/db db:generate`.
- Manual: `pnpm --filter server exec tsx scripts/simulate-razorpay-route-webhook.ts <donationId> transfer.processed`,
  plus the Razorpay test-mode dashboard.

## Direct answers to the seven questions

1. **Existing payment code / legacy provider:** one Razorpay adapter plus a dev
   stub; no legacy migration. Extend the adapter and keep the stub for local
   E2E.
2. **Schema gaps:** a separate `organization_payout_accounts` table and
   transfer/refund columns on `donations`; migration `0018`.
3. **Onboarding/admin hooks:** approval in `AdminService.reviewOrganization` is
   the trigger; add a payout setup screen after verification; handle
   `UNDER_REVIEW`, `NEEDS_CLARIFICATION`, and `FAILED` with a retry.
4. **Security:** do not persist raw bank/PAN; if you must, AES-256-GCM with a
   dedicated env key. The existing HMAC plus unique payment id is sound; add
   account/transfer state guards, audit every payout decision, and never expose
   payout fields on the public org payload.
5. **Donation edge cases:** block checkout unless activated; a failed transfer
   leaves the donation `COMPLETED` but the transfer `FAILED` - the money is in
   the platform account, so surface it to the admin for retry/reversal; refunds
   use `reverse_all`; duplicate webhooks are state-guarded; receipts must stop
   claiming Nabhya collects the money; 80G remains the NGO's responsibility.
6. **Test mode / local webhooks:** create linked accounts and Route products in
   test mode, subscribe the existing webhook to Route events, use the signed
   route-webhook script, and use the stub for CI. Confirm `product.route.*`
   event names in the dashboard event log before relying on them.
7. **Risks / alternatives:** the real dependencies are Razorpay's Route
   approval/KYC timeline and stakeholder KYC, not code. Refunds can fail if the
   linked account lacks balance. Blocking existing NGOs until payout setup is a
   rollout risk. Route is still the right choice; RazorpayX collect-then-payout
   and NGO-owned accounts are worse for compliance or onboarding friction.

## Decisions to confirm before implementation

1. **Payout storage:** separate table plus no raw bank/PAN (recommended), or
   columns on `organizations` plus encryption?
2. **Fee model:** transfer the full donation in v1 (recommended), or retain a
   platform fee?
3. **Refund authority:** superadmin-only full refunds (recommended), or allow
   NGO-initiated refunds too?
4. **Rollout:** block donations until payout activation (recommended), or run a
   temporary transition flag?
5. **Payout setup placement:** a dedicated `(ngo)/payouts` screen (recommended),
   or a sixth step in the NGO wizard?
