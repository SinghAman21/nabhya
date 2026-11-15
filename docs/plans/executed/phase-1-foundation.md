# Execution Report: Phase 1 — Environment, Cryptography & Database Foundation

> **Feature:** Razorpay Route (Direct NGO Settlements)  
> **Status:** COMPLETED & VERIFIED  
> **Date:** November 10, 2026  
> **Target Repo Modules:** `packages/env`, `packages/shared`, `packages/db`, `apps/server`

---

## 1. Executive Summary

Phase 1 establishes the **security, data isolation, and validation foundation** required for direct marketplace settlements via Razorpay Route. 

Before Phase 1, bank account numbers could not be safely ingested because no field-level encryption existed, the `donations` table could not account for transfers or platform fees, and no shared Zod schemas existed for banking and stakeholder KYC.

With Phase 1 completed:
- Financial credentials are cryptographically protected at rest using **AES-256-GCM**.
- Banking details and KYC state are partitioned into a dedicated `organization_payout_profiles` table, preventing accidental data leaks in public queries.
- Transfer tracking and Indian tax compliance fields (Section 80G / Form 10BD) are added to the `donations` table.
- All 18 donation integration tests pass on the updated migration suite against PGlite, and all 39 injectable NestJS classes pass dependency injection verification.

---

## 2. Inventory of Changes

### A. Environment Configuration (`packages/env`)

#### [`packages/env/src/server.ts`](file:///t:/college%20projects/nabhya/packages/env/src/server.ts)
- **Added `ENCRYPTION_MASTER_KEY`**:
  - Validated as a 64-character hex string (32 bytes).
  - Defaults to a development key in local environments; validated at server boot via `@t3-oss/env-core`.

#### [`apps/server/test/setup-env.ts`](file:///t:/college%20projects/nabhya/apps/server/test/setup-env.ts)
- Injected default 32-byte test key into `TEST_ENV` so CI and local test runs never require manual `.env` configuration.

---

### B. Security & Cryptography Engine (`apps/server`)

#### [NEW] [`apps/server/src/common/crypto/encryption.ts`](file:///t:/college%20projects/nabhya/apps/server/src/common/crypto/encryption.ts)
- **Algorithm**: `aes-256-gcm` (Authenticated Encryption with Associated Data).
- **Initialization Vector**: Fresh cryptographically random 12-byte IV generated per call (`randomBytes(12)`).
- **Authentication Tag**: 16-byte GCM authentication tag guaranteeing ciphertext integrity and tamper resistance.
- **Payload Format**: `${ivHex}:${authTagHex}:${ciphertextHex}`.
- **Methods**:
  - `encrypt(plaintext: string, keyHex?: string): string`
  - `decrypt(payload: string, keyHex?: string): string`

#### [NEW] [`apps/server/src/common/crypto/encryption.spec.ts`](file:///t:/college%20projects/nabhya/apps/server/src/common/crypto/encryption.spec.ts)
- **Unit Test Suite**:
  1. Plaintext round-trip fidelity test.
  2. Random IV divergence test (identical plaintexts produce distinct ciphertexts).
  3. Tampered ciphertext rejection test (authentication tag mismatch).
  4. Tampered auth-tag rejection test.
  5. Wrong key rejection test.
- **Result**: `5 passed (5)` in Vitest.

---

### C. Shared Contracts & Validation (`packages/shared`)

#### [NEW] [`packages/shared/src/payout.ts`](file:///t:/college%20projects/nabhya/packages/shared/src/payout.ts)
- **Regex Patterns**:
  - `PAN_REGEX`: `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/`
  - `IFSC_REGEX`: `/^[A-Z]{4}0[A-Z0-9]{6}$/`
  - `BANK_ACCOUNT_REGEX`: `/^\d{9,18}$/`
- **Schemas & Types**:
  - `createPayoutProfileSchema`: Validates legal name, business type (`trust`, `society`, `section8`, `ngo`), organization PAN, account holder name, account number, confirm account number (with `.refine()` equality check), IFSC, bank name, branch, and authorized signatory details (name, email, phone, DOB, signatory PAN, address).
  - `payoutProfileViewSchema`: Masked view response DTO guaranteeing `bankAccountLast4` is returned instead of full account numbers.
  - `razorpayOnboardingStatusSchema`: Enum for `NOT_STARTED`, `SUBMITTED`, `UNDER_REVIEW`, `ACTIVATED`, `NEEDS_CLARIFICATION`, `REJECTED`, `SUSPENDED`.

#### [`packages/shared/src/donations.ts`](file:///t:/college%20projects/nabhya/packages/shared/src/donations.ts)
- **Updated `createDonationSchema`**:
  - Added `wants80G`: boolean.
  - Added `donorPan`: optional uppercase 10-char PAN string.
  - Added `donorAddress`: optional address string.
  - Added validation refinement: if `wants80G` is `true`, `donorPan` is required under Indian Income Tax Form 10BD rules.

#### [`packages/shared/src/index.ts`](file:///t:/college%20projects/nabhya/packages/shared/src/index.ts)
- Exported all symbols from `./payout`.

---

### D. Database Schema & Migration (`packages/db`)

#### [NEW] [`packages/db/src/schema/payouts.ts`](file:///t:/college%20projects/nabhya/packages/db/src/schema/payouts.ts)
- **New Table: `organization_payout_profiles`**:
  - `id`: UUID Primary Key.
  - `organizationId`: UUID FK referencing `organizations.id` (Unique, `onDelete: cascade`).
  - `legalEntityName`: Varchar(150).
  - `businessType`: Varchar(50).
  - `pan`: Varchar(10).
  - `bankAccountEncrypted`: Text (AES-256-GCM string).
  - `bankAccountLast4`: Varchar(4) (Plaintext for UI display).
  - `ifsc`: Varchar(11).
  - `bankName`, `bankBranch`: Varchar(100).
  - `accountHolderName`: Varchar(120).
  - `signatoryName`, `signatoryEmail`, `signatoryPhone`, `signatoryDob`, `signatoryPan`, `signatoryAddress`.
  - `razorpayAccountId`, `razorpayStakeholderId`.
  - `razorpayStatus`: Enum `razorpay_onboarding_status` (Default: `NOT_STARTED`).
  - `statusReason`, `requirementsDue`: Text.
  - `isPennyDropVerified`: Boolean (Default: `false`).
  - `pennyDropRegisteredName`: Varchar(150).
  - `activatedAt`, `createdAt`, `updatedAt`: Timestamps.
  - Indexes: `org_payout_profiles_org_unique`, `org_payout_profiles_rzp_acc_unique`, `org_payout_profiles_status_idx`.
  - Relations: 1-to-1 relation with `organizations`.

#### [`packages/db/src/schema/donations.ts`](file:///t:/college%20projects/nabhya/packages/db/src/schema/donations.ts)
- **New Enum `transfer_status`**: `PENDING`, `PROCESSED`, `FAILED`, `REVERSED`.
- **Added Columns to `donations`**:
  - `wants80G`: Boolean (Default `false`).
  - `donorPan`: Varchar(10).
  - `donorAddress`: Text.
  - `platformFeeMinor`: Integer (Default `0`).
  - `transferAmountMinor`: Integer.
  - `destinationAccountId`: Varchar(50).
  - `razorpayTransferId`: Varchar(50).
  - `transferStatus`: Enum `transfer_status`.
  - `transferFailureReason`: Text.

#### [`packages/db/src/schema/index.ts`](file:///t:/college%20projects/nabhya/packages/db/src/schema/index.ts)
- Exported all symbols from `./payouts`.

#### [NEW] [`packages/db/src/migrations/0018_payout_profiles_and_transfers.sql`](file:///t:/college%20projects/nabhya/packages/db/src/migrations/0018_payout_profiles_and_transfers.sql)
- Contains Postgres DDL for creating enums `razorpay_onboarding_status`, `transfer_status`, table `organization_payout_profiles`, foreign keys, indexes, and `donations` column additions.

#### [`packages/db/src/migrations/meta/_journal.json`](file:///t:/college%20projects/nabhya/packages/db/src/migrations/meta/_journal.json)
- Appended migration entry `idx: 18`, tag `"0018_payout_profiles_and_transfers"`.

---

## 3. Verification & Validation Evidence

### 1. Encryption Unit Test Verification
```bash
pnpm --filter server test src/common/crypto/encryption.spec.ts
```
**Output:**
```
✓ src/common/crypto/encryption.spec.ts (5 tests) 7ms
Test Files  1 passed (1)
Tests       5 passed (5)
```

### 2. Migration Execution & Donation Integration Test
Ran integration test suite against in-process Postgres (PGlite), which executes all 18 SQL migration files from `meta/_journal.json`:
```bash
pnpm --filter server test test/donations.spec.ts
```
**Output:**
```
✓ test/donations.spec.ts (18 tests) 3029ms
Test Files  1 passed (1)
Tests       18 passed (18)
```
*Result: Database migration applied cleanly with zero SQL syntax errors or constraint violations.*

### 3. NestJS Dependency Injection Verification
Ran dynamic resolution audit across all server controllers and services:
```bash
pnpm --filter server verify:di
```
**Output:**
```
Checked 39 injectable class(es): AppController, AuditService, MailService, AdminController,
AdminService, FinanceService, CategoriesController, CategoriesService, CertificatesController,
CertificatesService, DonationsController, DonationsService, EngagementController, EngagementService,
EventsController, EventsService, OrgEventsController, FeedEngagementService, FeedRankingService,
FeedController, FeedService, NeedsController, NeedsService, OrgNeedsController, NotificationsController,
NotificationsService, OnboardingController, OnboardingService, OrganizationsController, OrganizationsService,
ImpactService, PublishingController, PublishingService, SearchController, SearchService, UploadsController,
UploadsService, UsersController, UsersService
All dependencies resolved ✓
```

---

## 4. Next Step: Phase 2 Hand-off

Phase 1 provides the complete foundation for **Phase 2: Backend Payout Service & Razorpay Route Client**:
1. Implement `RazorpayRouteService` in `apps/server/src/modules/donations/razorpay-route.service.ts` to execute Razorpay's 4-step onboarding API calls (`/v1/accounts`, `/v1/accounts/{id}/stakeholders`, `/v1/accounts/{id}/products`, `/v1/accounts/{id}/bank_accounts`).
2. Implement `PayoutService` and `PayoutController` in `apps/server/src/modules/organizations/` to expose `GET /api/org/payout`, `POST /api/org/payout`, and `POST /api/admin/organizations/:id/payout/retry-sync`.

