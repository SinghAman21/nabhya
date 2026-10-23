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

## Still needs product input

- **Delete NGO:** Define soft-delete versus hard-delete, public visibility, retention/anonymization, linked users/events/donations/certificates, and audit behavior before adding a destructive operation. The checklist now marks this unbuilt.
- **Superadmin finance/report console:** Decide which donation states and financial reports are in scope, which donor fields are visible, who may access donor data, required filters, export format/columns, and audit requirements. These checklist items are now unchecked; no ledger/export routes were added.
- **Downloadable or emailed donation receipts:** The current product is view-only, with no email provider configured. If a downloadable artifact or email delivery is still required, provide its required fields/branding, delivery provider, and guest-data/privacy expectations.
- **Volunteer verification gate:** Product docs now match current behavior: identity verification does not block browsing or applying. If verification should gate applications or acceptance, specify the exact gate and update both UI and server policy.
- **Runtime response schemas:** No per-endpoint response parsing was added. The architecture notes are historical and the current guides state this limitation. If runtime validation is required, decide the rollout scope and whether generated/shared schemas are expected across all routes.

## Verification and limits

- Server and native TypeScript checks passed; shared package typecheck passed earlier in the remediation.
- `pnpm --filter server verify:di` passed.
- Focused existing server specs passed: endpoint inventory, uploads, publishing, admin, team permissions, and engagement (178 tests across six files).
- Biome check passed on changed TypeScript files. It reports existing explicit-`any` warnings in `apps/server/src/modules/admin/admin.service.ts`; those casts predate this branch's changes.
- `git diff --check` passed.
- Android and Expo Web were not launched; native camera, checkout, file picker/download, sharing, and browser rendering remain runtime-unverified. No browser automation or live product service was used.
- Existing unrelated working-tree changes under `packages/db/package.json` and `packages/db/src/seed-*.ts` were preserved and are excluded from the audit commits.
