# Audit remediation follow-up

**Branch:** `final-audit`
**Baseline:** [`final-audit.md`](final-audit.md), the repository audit report.
**Status:** Remediation is committed on `final-audit`; this ledger accompanies the documentation commit.

The request named `final-audit.png`; no file with that name is present in the
repository. I used the requested `final-audit.md` report as the task list. That
file records the pre-remediation baseline; this document records what changed
and what still needs a product decision.

## Addressed findings

| Finding | Remediation |
|---|---|
| F1–F3: file reads, team uploads, and storage-key ownership | Public NGO branding and attached financial reports can be read without sign-in only while attached to a verified, active NGO. Owners and permissioned active teammates can preview attached files before publication; superadmins retain review access. Organization upload tickets now resolve active team membership and purpose permissions. Persisted file keys are checked for expected owner and purpose before storage checks. See `apps/server/src/modules/uploads/`. |
| F4: announcement authorization | Draft creation/editing now excludes Viewers; publishing, editing a live announcement, and returning it to draft require `content.publish`. Cover uploads are checked against the owning NGO and permission. See `apps/server/src/modules/publishing/`. |
| F5: partial identity uploads | The verification screen distinguishes partial submission, preserves retry errors, uploads only a missing document after a partial submission, and keeps replacement mode latched during rejected-document retries. See `apps/native/src/app/verify-identity.tsx` and `apps/native/src/hooks/use-documents.ts`. |
| F6: review edits | The editor is prefilled. A new volunteer-authenticated `GET /api/organizations/:id/reviews/me` finds the caller's review even when it is outside the visible review pages; the UI waits for that result, shows a retry on failure, and refreshes it after save/delete. |
| F7: identity-decision notifications | Superadmin document decisions now create in-app notifications with the review remarks and route volunteers to identity verification. |
| F8: team Admin restrictions | Client labels and controls match server policy; Admins cannot invite, promote/demote, or remove another Admin, but can update that teammate's designation, public listing, or active status. The server's role-change assertion is synchronous so a rejected role change cannot race past the write. |
| F9: user deletion UI | The user dossier exposes reason-required soft deletion and restoration, and deleted users are excluded from the volunteer directory. NGO deletion remains deferred below. |
| F10: categories | Added superadmin category list/create/edit/archive/restore UI and guarded API operations. Archiving preserves existing assignments. Duplicate slugs now map wrapped Postgres unique errors to a conflict response. |
| F12: receipt wording | The checklist now says “View Donation Receipt”; guest checkout explains that the email is attached to the donation record and that email receipts are not available. The UI no longer promises delivery that the server cannot perform. |
| F13: trend-test fixtures | Corrected the trend fixture timestamps to use the current test window. Existing trend assertions are included in the passing focused admin test run. |
| F14: response-contract documentation | Marked the response-schema rule in `docs/architecture/notes.md` as a historical proposal and documented that the client unwraps the envelope without runtime validation. |
| F15–F16: public reactions and comment paging | Signed-out search reactions prompt sign-in with a route to login. Feed comments now load later pages and expose retry for a failed page. |
| F17 and product-document mismatches | Updated app/target and SDK documentation, the 142-route inventory, legacy endpoint exceptions, the scheduler comment, NGO/volunteer role checklists, identity-flow ordering, report-export wording, and the architecture note status. |

## Formerly awaiting product input - now built (uncommitted)

Each item was built with the default below; change the decision and the code
follows from the named file.

| Item | Decision taken | Where |
|---|---|---|
| Delete NGO | Soft delete with a required reason, restorable. Hidden like a suspension; live events cancelled, open needs closed, pending invites and ownership transfers revoked. Donations, certificates, applications and audit rows retained. Directory hides deleted NGOs unless filtered to them. | `AdminService.setOrganizationStatus`, migration `0017_org_soft_delete`, `org-detail-sheet.tsx`, `org-suspended.tsx` |
| Finance console | Ledger over every status with totals over the filter; filters for status, IST date window, NGO and search; superadmins see real donors on anonymous gifts. CSV export of exactly the filtered rows, capped at 50,000, formula-guarded, audited as `DONATIONS_EXPORTED`. Cross-NGO financial reports list. NGO "Download report" CSV without donor emails. | `FinanceService`, `(admin)/finance.tsx`, `DonationsService.exportForMyOrganization` |
| Receipts | PDF receipt (acknowledgement of payment, explicitly not 80G) stored privately and rebuilt if lost; emailed via Resend with the PDF attached on webhook completion, guests included. | `receipt-pdf.ts`, `MailService.sendDonationReceipt`, `GET /me/donations/:id/receipt/pdf` |
| Verification gate | Applying to events and pledging to needs require a VERIFIED identity; browsing, following, reviewing and donating stay open. | `common/utils/identity.ts`, `verification-note.tsx` |
| Runtime response schemas | Envelope on every response, `{ items, meta }` on every page, full schemas for onboarding status, checkout, receipts, exports and the ledger. Throws in dev, warns in prod; server specs parse real output through the same schemas. | `packages/shared/src/responses.ts`, `lib/api/http.ts` |

Route count is now 147. Verification: server, shared and native typecheck;
all 24 server spec files (414 tests) pass, including the previously stale
`users.spec.ts` storage keys; `verify:di` passes.

## Verification and limits

- Server and native TypeScript checks passed; shared package typecheck passed earlier in the remediation.
- `pnpm --filter server verify:di` passed.
- Focused existing server specs passed: endpoint inventory, uploads, publishing, admin, team permissions, and engagement (178 tests across six files).
- Biome check passed on changed TypeScript files. It reports existing explicit-`any` warnings in `apps/server/src/modules/admin/admin.service.ts`; those casts predate this branch's changes.
- `git diff --check` passed.
- Android and Expo Web were not launched; native camera, checkout, file picker/download, sharing, and browser rendering remain runtime-unverified. No browser automation or live product service was used.
- Existing unrelated working-tree changes under `packages/db/package.json` and `packages/db/src/seed-*.ts` were preserved and are excluded from the audit commits.
