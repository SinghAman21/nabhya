# Full product-to-code connectivity audit

**Audit date:** 2026-10-23
**Repository:** `nabhya`
**Method:** static source and document tracing, plus focused existing server tests. No source code or data was changed. No Android runtime, browser, or external service was used.

**Follow-up status:** This report records the baseline findings before remediation.
Changes made on branch `final-audit` and unresolved product decisions are tracked in
[`fix-1.md`](fix-1.md); consult that file for current status.

## 1. Executive summary

The repository has a substantial, mostly connected product: volunteer discovery, the ranked feed, event applications, donations, certificates, NGO publishing and operations, team invitations, notifications, and the superadmin verification console all have identifiable paths from screen to API and persistence. The authorization model is generally enforced on the server, and most screens use shared loading, empty, retry, and pagination components.

The audit does **not** establish that the product is fully coherent or runtime-working on both platforms. Four confirmed high-risk gaps are: public NGO financial documents and branding use an owner-only signed-download path; team members who are allowed to edit an NGO cannot get organization upload tickets; announcement drafts and unpublishing bypass the documented team permission model; and stored document keys are checked for existence and size but not bound to the submitter or record. Several checklist items also have no implementation, including category management, NGO deletion, and report exports.

**Targets actually present:** Android is configured as `com.nabhya.app` in `apps/native/app.json:14-22`. A web-rendered target exists inside that same Expo app: static web output and Metro are configured at `apps/native/app.json:24-27`, with Expo Web dependencies and a `web` script in `apps/native/package.json:30,55-69,84-92`. There is **no separate `apps/web` application**; its guide says it is not scaffolded (`apps/web/AGENTS.md:1-6`). The source paths are shared between Android and web in most flows, with platform branches for checkout, camera, file opening, and responsive layout. Both targets were inspected statically; neither was launched, so runtime claims are marked unverified.

**Documentation is not a reliable count or platform inventory today.** The root guide describes 114 endpoints and says every endpoint has a UI except the webhook and scheduled close job (`AGENTS.md:89-92,166-168,444-447`). The checked-in controllers contain 137 route decorators across 18 controller files. The endpoint test only imports 16 controllers and asserts 119 routes, omitting Feed and Search (`apps/server/test/endpoints.spec.ts:172-214,259-263`; `apps/server/src/modules/feed/feed.controller.ts:53-276`; `apps/server/src/modules/search/search.controller.ts:18`). The native guide also calls the app SDK 56 / RN 0.85.3 and says there is no web target, while package metadata configures SDK 57 / RN 0.86.3 and React Native Web (`apps/native/AGENTS.md:3-11`; `apps/native/package.json:30,55-69`).

### Highest-risk findings

- Public users can see financial-report rows, but opening them requests a signed URL that requires an authenticated owner or superadmin. Public branding uses the same signed-read mechanism (F1).
- Organization admins/managers are shown upload controls, but the upload service resolves organization ownership using `ownerUserId` only, excluding team members (F2).
- Any user with the `organisation` role can create an announcement draft or edit a published announcement back to draft, even if their team role is Viewer (F4).
- Uploaded document keys are not verified as belonging to the caller or to the expected record/purpose before they are persisted (F3).
- Product checklists claim category CRUD, NGO deletion, user deletion, platform-wide donation/report views and exports, and downloadable donation receipts that are absent or only partially implemented (F8-F12).

## Audit conventions and evidence

Evidence references are repository-relative `path:line` or `path:start-end`. “Wired” means the source contains a reachable screen/action-to-backend path; it does **not** mean the platform was executed. Android/Web columns use **W** (wired in source), **P** (partial or a confirmed issue), **G** (documented flow missing), and **U** (runtime unverified). Backend status describes source connectivity/persistence separately.

The product documents reviewed were `docs/product/features-per-role.md` and the volunteer, organisation, and superadmin flows. Root and app guides were read, as were relevant architecture and audit documents. `docs/architecture/notes.md` is substantially stale: it describes Better Auth, an empty database, a planned Next.js app, and an incomplete backend (`docs/architecture/notes.md:27-42,58-103`), which conflict with current source and root-guide state.

## 2. Coverage matrix

| Capability / flow | Role | Android | Web rendering | Backend | Evidence and result |
|---|---|---:|---:|---|---|
| Sign up, email confirmation, sign in, password recovery/reset, sign out | Public / all | W / U | W / U | Connected to Supabase Auth; API JWT guard JIT-syncs users | Screens include signup confirmation/resend and forgot/reset. `apps/native/src/app/(auth)/signup.tsx:31-80`; `apps/native/src/app/(auth)/forgot-password.tsx:28-46`; `apps/native/src/app/(auth)/reset-password.tsx:27-45`; `apps/native/src/lib/api/auth.ts`; root auth guide `AGENTS.md:140-158`. |
| Role choice and volunteer onboarding/profile | Volunteer | W / U | W / U | Connected to onboarding/profile APIs and DB | Route gate reads server onboarding state (`apps/native/src/app/index.tsx:63-69,114-132`); onboarding controllers `apps/server/src/modules/onboarding/onboarding.controller.ts:30-53`; profile API/client path is present. |
| Volunteer identity documents and liveness selfie | Volunteer | P / U | P / U | Uploads and review status persist; status is derived from both required document types | Screen uploads ID and selfie sequentially and handles an upload error (`apps/native/src/app/verify-identity.tsx:87-117`); server recomputes status from the complete document set (`apps/server/src/modules/admin/admin.service.ts:1080-1141`; `packages/shared/src/volunteer.ts:135-160`). A first upload can succeed and invalidate state before the second fails, after which the screen can display the generic under-review state and hide the retryable error (F5). Camera/file picker behavior was not runtime tested. |
| Browse/search public NGOs, nearby results, details, causes and public team | Volunteer / public | W / U | W / U | Public read routes connected | Organization list, nearby, and detail routes are in `apps/server/src/modules/organizations/organizations.controller.ts:57-136`; search route is `apps/server/src/modules/search/search.controller.ts:18`; NGO directory/detail screens and query services are wired (`apps/native/src/app/ngos/index.tsx:60-95`; `apps/native/src/app/ngos/[id].tsx:123-137`; `apps/native/src/lib/api/services.ts:139-154`). |
| Bookmark and follow NGOs; following feed | Volunteer | W / U | W / U | Connected and persisted separately | Follow/bookmark and list routes are in `apps/server/src/modules/engagement/engagement.controller.ts:44-146`; ranked following feed is used by the volunteer home (`apps/native/src/app/(volunteer)/index.tsx:105-148`) and selected in `apps/native/src/hooks/use-feed.ts:57-72`. |
| For You / Trending / Following / Saved feed, filters, search, likes, saves, shares, impressions, comments | Volunteer / public read | P / U | P / U | Connected to ranked-feed and interaction endpoints | Client binds all four ranked surfaces and interactions (`apps/native/src/app/(volunteer)/index.tsx:105-148`; search handlers `apps/native/src/app/search.tsx:95-99`; service and mutation paths `apps/native/src/lib/api/services.ts:149-193`, `apps/native/src/hooks/use-feed.ts:282-298`); Feed routes `apps/server/src/modules/feed/feed.controller.ts:61-276`. Signed-out search still renders like/save handlers, which fail against authenticated endpoints and roll back without user-facing error feedback (F15). Comment sheet requests only the first 50 comments (F16). |
| View and pledge to public needs; NGO review of pledges | Volunteer / NGO | W / U | W / U | Connected; NGO counter updates are server-owned | Volunteer list/detail/pledge endpoints: `apps/server/src/modules/needs/needs.controller.ts:50-99`; NGO need and pledge endpoints: `apps/server/src/modules/needs/org-needs.controller.ts:50-103`; public detail/pledge path `apps/native/src/app/needs/[id].tsx:58-68`; NGO list/review actions `apps/native/src/app/(ngo)/needs.tsx:89-105`; client API paths `apps/native/src/lib/api/services.ts:239-264`. The standalone public needs list is subsumed by the unified feed in the documented design. |
| Create/update/delete needs and offers | NGO | W / U | W / U | Connected to org-scoped APIs and persistence | Composer dispatches Need to `/api/org/needs`; root product implementation notes document structured fields (`AGENTS.md:290-343`); routes in `apps/server/src/modules/needs/org-needs.controller.ts:50-103`. The checklist incorrectly places this NGO feature under Volunteer (`docs/product/features-per-role.md:61-65`; see product mismatches). |
| Browse events, apply/withdraw, track application status | Volunteer | W / U | W / U | Connected to public event and authenticated application endpoints | `apps/server/src/modules/events/events.controller.ts:51-112`; public detail/apply/withdraw actions are wired in `apps/native/src/app/events/[id].tsx:65-77`, with application history in `apps/native/src/app/(volunteer)/applications.tsx:35-38`. Application state is persisted server-side. |
| Create/manage NGO events, review applicants, attendance, certificates | NGO | W / U | W / U | Connected; transaction/counter and eligibility logic are server-side | NGO event routes `apps/server/src/modules/events/org-events.controller.ts:53-132`; attendance and certificate issue/revoke routes `apps/server/src/modules/certificates/certificates.controller.ts:42-139`; applicants UI checks team permissions (`apps/native/src/components/applicants-sheet.tsx:122-128`). |
| Donate as signed-in or guest, payment confirmation, history, receipt view | Volunteer / public donor | P / U | P / U | Order creation, webhook signature verification, and persisted completion connected | Native Razorpay module and web Checkout.js are separate source branches (`apps/native/src/components/donate-sheet.tsx:54-141`); server checkout/webhook/history/receipt routes `apps/server/src/modules/donations/donations.controller.ts:46-108`. Receipt is a view-only sheet, not a download (F12). The promised guest email receipt could not be established from a delivered email or configured provider; see limitations. |
| Download/view certificates and publicly verify certificate code | Volunteer / public | W / U | W / U | Connected | Certificate list/PDF and public verification routes `apps/server/src/modules/certificates/certificates.controller.ts:42-139`; volunteer certificate list/PDF and public verification use `apps/native/src/app/certificates/index.tsx:35-39` and `apps/native/src/app/certificates/[code].tsx:29-32`. File opening was not runtime tested. |
| Notifications, unread count, mark read, activity timeline, superadmin broadcast | All authenticated roles / superadmin | P / U | P / U | Connected for current notification types; user-document review notice absent; no email/push delivery | Notification endpoints `apps/server/src/modules/notifications/notifications.controller.ts:27-52`; list/read UI is `apps/native/src/app/notifications.tsx:25-30`, volunteer activity is `apps/native/src/app/(volunteer)/activity.tsx:112`, and dashboard mounts the broadcast sheet (`apps/native/src/app/(admin)/index.tsx:77-85,451`; broadcast mutation `apps/native/src/hooks/use-engagement.ts:50-58`). Root guide states in-app only (`AGENTS.md:449-454`). User-document verification notification is missing (F7). |
| NGO verification, profile, events, needs, reviews/replies, announcements, transparency reports, team | NGO owner/team | P / U | P / U | Most mutations connected; upload/read path and announcement authorization have defects | NGO route group and APIs connect (`apps/native/src/app/(ngo)/events.tsx:74-100`; `apps/native/src/app/(ngo)/needs.tsx:76-105`; `apps/native/src/app/(ngo)/announcements.tsx:66-83,450-451`; `apps/native/src/app/(ngo)/reports.tsx:77-93`; `apps/native/src/app/(ngo)/team.tsx:119-129`). Team roles are gated in client and checked in service, but organization uploads reject non-owner teammates (F2) and Viewer can mutate announcement drafts/unpublish (F4). Public reports/branding are not readable by public visitors (F1). |
| Invite, accept/decline, change role, suspend/remove teammate, leave/transfer ownership | NGO owner/team / invitee | P / U | P / U | Connected, with server-side team permission checks | Controller includes invite and membership actions (`apps/server/src/modules/publishing/publishing.controller.ts:155-240`); permission helpers `apps/server/src/modules/publishing/publishing.service.ts:1140-1190`; matrix tests `apps/server/test/team-permissions.spec.ts:278-360`. Admin-role UI offers actions the server denies to an Admin (F8). |
| Superadmin dashboard, analytics and time trends | Superadmin | P / U | P / U | Connected to aggregate endpoints; focused trend tests fail | Admin routes `apps/server/src/modules/admin/admin.controller.ts:69-120`; dashboard calls overview and trend hooks (`apps/native/src/app/(admin)/index.tsx:77-85`). Two focused existing trend tests failed in `apps/server/test/admin.spec.ts:930-941`; this confirms test failures, not production impact (F13). |
| Superadmin NGO/user directories, dossiers, status, verification queue, bulk review, audit log | Superadmin | P / U | P / U | Most routes connected; documented delete actions incomplete | Admin route family `apps/server/src/modules/admin/admin.controller.ts:121-332`; directory/dossier and review UI exist. User status API accepts `DELETED`, but user drawer only exposes suspend/reinstate (`apps/native/src/components/admin/user-detail-sheet.tsx:63-73`; `apps/server/src/modules/admin/admin.controller.ts:226`), and NGO deletion has no route/status. |
| Superadmin category CRUD | Superadmin | G / U | G / U | No mutation backend; only public category read | `CategoriesController` has one GET route (`apps/server/src/modules/categories/categories.controller.ts:15`); product checklist claims add/edit/delete (`docs/product/features-per-role.md:114-118`). |
| Superadmin donation/report ledger and exports | Superadmin | G / U | G / U | Aggregate counts only; no platform-wide donation/report list/export routes | Product requires viewing donations/reports and exporting (`docs/product/features-per-role.md:125-129`; `docs/product/flows/superadmin.md:21-24`), but admin controller exposes aggregate analytics rather than a ledger (`apps/server/src/modules/admin/admin.controller.ts:69-120,330-332`). |
| Public NGO financial report and branding file access | Public / donor | P / U | P / U | Listing connected; file read blocked by signed-download authorization | Public profile calls `useOpenDocument` for reports and images (`apps/native/src/app/ngos/[id].tsx:267-273,978-1017`); signed URL route requires auth and the service only permits owner/superadmin for org-scoped files (`apps/server/src/modules/uploads/uploads.controller.ts:47-57`; `apps/server/src/modules/uploads/uploads.service.ts:143-188`). F1. |
| Liveness, readiness, donation webhook, event-close scheduler, first superadmin grant | Operational | N/A | N/A | Intentionally server-only except first grant via script/DB | Probes `apps/server/src/app/app.controller.ts:35-51`; webhook `apps/server/src/modules/donations/donations.controller.ts:46-108`; scheduled close is documented in root deploy notes and server guide; first superadmin route intentionally absent (`AGENTS.md:523-525`). The controller comment still says close-finished is manually runnable from admin meanwhile (`apps/server/src/modules/publishing/publishing.controller.ts:334-347`), contradicting the scheduler-only guide. |

## 3. Backend endpoint inventory and backend-to-UI gaps

The controller scan found **137 HTTP route decorators across 18 controller files**. The inventory below counts decorator routes, including probes and operational routes. Source spans identify the corresponding route definitions.

| Controller | Routes | Source |
|---|---:|---|
| App / probes | 2 | `apps/server/src/app/app.controller.ts:35-51` |
| Admin | 21 | `apps/server/src/modules/admin/admin.controller.ts:69-332` |
| Categories | 1 | `apps/server/src/modules/categories/categories.controller.ts:15` |
| Certificates | 7 | `apps/server/src/modules/certificates/certificates.controller.ts:42-139` |
| Donations | 5 | `apps/server/src/modules/donations/donations.controller.ts:46-108` |
| Engagement | 10 | `apps/server/src/modules/engagement/engagement.controller.ts:44-146` |
| Events (volunteer) | 5 | `apps/server/src/modules/events/events.controller.ts:51-112` |
| Events (NGO) | 8 | `apps/server/src/modules/events/org-events.controller.ts:53-132` |
| Feed | 17 | `apps/server/src/modules/feed/feed.controller.ts:53-276` |
| Needs (volunteer) | 5 | `apps/server/src/modules/needs/needs.controller.ts:50-99` |
| Needs (NGO) | 6 | `apps/server/src/modules/needs/org-needs.controller.ts:50-103` |
| Notifications | 4 | `apps/server/src/modules/notifications/notifications.controller.ts:27-52` |
| Onboarding | 3 | `apps/server/src/modules/onboarding/onboarding.controller.ts:30-53` |
| Organizations | 8 | `apps/server/src/modules/organizations/organizations.controller.ts:57-136` |
| Publishing / team / impact | 27 | `apps/server/src/modules/publishing/publishing.controller.ts:56-351` |
| Search | 1 | `apps/server/src/modules/search/search.controller.ts:18` |
| Uploads | 2 | `apps/server/src/modules/uploads/uploads.controller.ts:32-57` |
| Users | 5 | `apps/server/src/modules/users/users.controller.ts:31-71` |
| **Total** | **137** | `apps/server/src/app/app.module.ts:10-48` registers the feature controllers. |

### Complete route path inventory

This expands the controller count table into route paths. Braced names are controller parameters; `GET`, `POST`, `PATCH`, `DELETE` are the actual route verbs.

- **App:** `GET /api`; `GET /api/health` (`apps/server/src/app/app.controller.ts:35-51`).
- **Admin:** `GET /api/admin/overview`, `/overview/trends`, `/analytics`, `/organizations`, `/organizations/:id`, `/organizations/:id/activity`, `/organizations/:id/posts`; `PATCH /api/admin/organizations/:id/verification`, `/organizations/:id/status`; `GET /api/admin/users`, `/users/:id`, `/users/:id/activity`; `PATCH /api/admin/users/:id/status`; `GET /api/admin/documents/organizations`; `POST /api/admin/documents/organizations/bulk`; `PATCH /api/admin/documents/organizations/:id`; `GET /api/admin/documents/users`; `POST /api/admin/documents/users/bulk`; `PATCH /api/admin/documents/users/:id`; `DELETE /api/admin/posts/:id`; `GET /api/admin/audit-logs` (`apps/server/src/modules/admin/admin.controller.ts:69-332`).
- **Categories:** `GET /api/categories` (`apps/server/src/modules/categories/categories.controller.ts:15`).
- **Certificates:** `POST /api/org/events/:eventId/applications/bulk-attendance`; `PATCH /api/org/events/:eventId/applications/:applicationId/attendance`; `POST /api/org/events/:eventId/applications/:applicationId/certificate`; `PATCH /api/org/certificates/:id/revoke`; `GET /api/me/certificates`; `GET /api/me/certificates/:id/pdf`; `GET /api/certificates/:code/verify` (`apps/server/src/modules/certificates/certificates.controller.ts:42-139`).
- **Donations:** `POST /api/donations/checkout`, `/donations/webhook`; `GET /api/me/donations`, `/me/donations/:id/receipt`, `/org/donations` (`apps/server/src/modules/donations/donations.controller.ts:46-108`).
- **Engagement:** `POST /api/organizations/:id/bookmark`; `POST` and `DELETE /api/organizations/:id/follow`; `GET /api/me/following`, `/me/bookmarks`; `GET` and `POST /api/organizations/:id/reviews`; `DELETE /api/organizations/:id/reviews/me`; `GET /api/org/reviews`; `PATCH /api/org/reviews/:reviewId/reply` (`apps/server/src/modules/engagement/engagement.controller.ts:44-146`).
- **Events (volunteer):** `GET /api/events`, `/events/me/applications`, `/events/:id`; `POST /api/events/:id/applications`; `DELETE /api/events/:id/applications/me` (`apps/server/src/modules/events/events.controller.ts:51-112`).
- **Events (NGO):** `GET /api/org/events`, `/org/events/:id`; `POST /api/org/events`; `PATCH` and `DELETE /api/org/events/:id`; `GET /api/org/events/:id/applications`; `POST /api/org/events/:id/applications/bulk-review`; `PATCH /api/org/events/:id/applications/:applicationId` (`apps/server/src/modules/events/org-events.controller.ts:53-132`).
- **Feed:** `GET /api/feed`, `/feed/for-you`, `/feed/trending`, `/feed/following`, `/feed/saved`; `POST /api/feed/upload-intents`, `/feed`; `POST` and `DELETE /api/feed/:type/:id/like`; `POST` and `DELETE /api/feed/:type/:id/save`; `POST /api/feed/:type/:id/share`, `/feed/:type/:id/impression`, `/feed/:type/:id/comments`; `GET /api/feed/:type/:id/comments`; `DELETE /api/feed/comments/:commentId`, `/api/feed/:id` (`apps/server/src/modules/feed/feed.controller.ts:53-276`).
- **Needs (volunteer):** `GET /api/needs`, `/needs/me/pledges`, `/needs/:id`; `POST /api/needs/:id/pledges`; `DELETE /api/needs/:id/pledges/me` (`apps/server/src/modules/needs/needs.controller.ts:50-99`).
- **Needs (NGO):** `GET /api/org/needs`; `POST /api/org/needs`; `PATCH` and `DELETE /api/org/needs/:id`; `GET /api/org/needs/:id/pledges`; `PATCH /api/org/needs/:id/pledges/:pledgeId` (`apps/server/src/modules/needs/org-needs.controller.ts:50-103`).
- **Notifications:** `GET /api/notifications`, `/notifications/unread-count`; `POST /api/notifications/read`, `/notifications/broadcast` (`apps/server/src/modules/notifications/notifications.controller.ts:27-52`).
- **Onboarding:** `GET /api/onboarding/status`; `POST /api/onboarding/organization`, `/onboarding/volunteer` (`apps/server/src/modules/onboarding/onboarding.controller.ts:30-53`).
- **Organizations:** `GET /api/organizations`, `/organizations/nearby`, `/organizations/me`, `/organizations/me/overview`, `/organizations/me/documents`, `/organizations/:id`; `PATCH /api/organizations/me`; `POST /api/organizations/me/documents` (`apps/server/src/modules/organizations/organizations.controller.ts:57-136`).
- **Publishing/team/impact:** `GET /api/organizations/:id/announcements`; `GET` and `POST /api/org/announcements`; `PATCH` and `DELETE /api/org/announcements/:id`; `GET /api/organizations/:id/reports`; `POST /api/org/reports`; `DELETE /api/org/reports/:id`; `GET` and `POST /api/org/team`; `POST /api/org/team/invites`; `GET /api/org/team/invites`; `DELETE /api/org/team/invites/:id`; `POST /api/org/team/invites/:id/resend`; `POST /api/team/invites/by-id/:id/accept`, `/decline`, `/api/team/invites/:token/accept`, `/decline`; `POST /api/org/team/leave`, `/org/team/transfer`, `/org/team/transfer/confirm`; `GET /api/organizations/:id/team`; `PATCH` and `DELETE /api/org/team/:id`; `GET /api/me/impact`; `POST /api/admin/events/close-finished`; `GET /api/organizations/:id/impact` (`apps/server/src/modules/publishing/publishing.controller.ts:56-351`).
- **Search:** `GET /api/search` (`apps/server/src/modules/search/search.controller.ts:18`).
- **Uploads:** `POST /api/uploads/intent`, `/uploads/download-url` (`apps/server/src/modules/uploads/uploads.controller.ts:32-57`).
- **Users:** `GET /api/users/me`, `/users/me/documents`; `PATCH /api/users/me`; `POST /api/users/me/role`, `/users/me/documents` (`apps/server/src/modules/users/users.controller.ts:31-71`).

### Endpoints without a direct screen action

- `GET /api/feed` serves the older organization-post feed shape. The current client uses `/for-you`, `/trending`, `/following`, and `/saved`; no screen calls this legacy route (`apps/server/src/modules/feed/feed.controller.ts:53-59`; `apps/native/src/lib/api/services.ts:155-193`; `apps/native/src/hooks/use-feed.ts:57-72`). This is redundant with the documented unified feed, not a missing primary flow.
- `POST /api/org/team` is explicitly described as a legacy add-existing-account route and has no client call (`apps/server/src/modules/publishing/publishing.controller.ts:162-174`). It appears compatibility-oriented, but the root guide’s list of endpoint exceptions does not mention it.
- `GET /api/needs` has a client service wrapper but no dedicated directory screen; needs appear through the unified feed and detail/pledge paths. The unified-feed design is documented in `AGENTS.md:352-380`, so a standalone list is not treated as a missing requirement.
- `POST /api/donations/webhook` is called by Razorpay; `POST /api/admin/events/close-finished` is a scheduler target. Both are intentional server-only endpoints (`apps/server/AGENTS.md:87-90`; root deploy notes and `AGENTS.md:444-447`). `GET /api` and `GET /api/health` are probes, not user screens.
- First-superadmin provisioning is intentionally not an HTTP endpoint; root guide directs setup through a script or database (`AGENTS.md:523-525`).

### Endpoint-surface test coverage

The focused endpoint test passed **10/10 tests**, but its inventory is incomplete: it manually imports 16 controllers, omitting Feed and Search, and expects 119 routes (`apps/server/test/endpoints.spec.ts:172-214,259-263`). The repository-wide controller scan has 137 routes; the difference is exactly Feed’s 17 plus Search’s 1. Its public/optional allowlists are also derived from the incomplete route set (`apps/server/test/endpoints.spec.ts:358-403`). The root guide’s claimed 114 endpoint count is stale. Therefore the passing test does not establish route-surface coverage for every registered controller.

## 4. UI-to-backend gaps and detailed findings

Findings below distinguish a defect established by source from a risk or test-only result. Impact is stated here; suggested next steps are kept in section 7.

### F1 — High — Public report and branding reads use owner-only signed URLs

The public NGO profile displays financial-report rows and invokes `useOpenDocument` with the stored key (`apps/native/src/app/ngos/[id].tsx:978-1017`). NGO image components also obtain signed URLs (`apps/native/src/app/ngos/[id].tsx:267-273`; `apps/native/src/components/org-branding.tsx:41`; `apps/native/src/hooks/use-stored-image.ts:28`). The download route is not public under the server’s deny-by-default guard (`apps/server/AGENTS.md:27-42`) and resolves organization ownership from `ownerUserId`, then rejects mismatched owners (`apps/server/src/modules/uploads/uploads.controller.ts:47-57`; `apps/server/src/modules/uploads/uploads.service.ts:143-188`). Public users and unrelated volunteers therefore cannot open the reports or organization images through this path. The UI copy describes reports as public donor transparency material (`apps/native/src/app/ngos/[id].tsx:993-999`).

### F2 — High — Team members authorized to edit an NGO cannot upload its files

The NGO verification screen allows upload unless `org.edit` is blocked and describes owners, admins, and managers as eligible (`apps/native/src/app/(ngo)/verification.tsx:74-81`). Report upload similarly exposes `FINANCIAL_REPORT` upload (`apps/native/src/app/(ngo)/reports.tsx:289-296`). Upload ticket creation and org-file reads resolve organization owner using only `organizations.ownerUserId === caller.id` (`apps/server/src/modules/uploads/uploads.service.ts:169-188`), while organization-scoped services resolve active team membership (`apps/server/src/modules/organizations/organizations.service.ts:59`). Eligible non-owner team members can reach controls but fail to receive a ticket or signed URL.

### F3 — High — Stored document keys are not bound to the submitting user, organization, or purpose

`UploadsService.assertUploaded` checks only object existence and maximum size (`apps/server/src/modules/uploads/uploads.service.ts:75-87`). Organization documents, user documents, and financial reports persist the submitted key after this check (`apps/server/src/modules/organizations/organizations.service.ts:524-540`; `apps/server/src/modules/users/users.service.ts:207-217`; `apps/server/src/modules/publishing/publishing.service.ts:215-239`). The corresponding shared schemas accept string keys rather than proving ownership/purpose (`packages/shared/src/organization.ts:89-94`; `packages/shared/src/volunteer.ts:127-133`; `packages/shared/src/publishing.ts:67`). A caller who obtains another valid object key can associate that object with a different record; later reads may fail authorization or expose it in an administrative review context. The condition requires a known key, but the missing ownership check is confirmed.

### F4 — High — Announcement authorization does not enforce the documented Viewer/read-only rule

The product promises Viewers are read-only (`docs/product/features-per-role.md:159-165`) and the client hides the editor when `content.publish` is unavailable (`apps/native/src/app/(ngo)/announcements.tsx:85-88`). Server routes require only the broad `organisation` role (`apps/server/src/modules/publishing/publishing.controller.ts:77-101`). The service checks `content.publish` only when the requested status is `PUBLISHED` (`apps/server/src/modules/publishing/publishing.service.ts:65-73,111-125`). A Viewer can therefore create drafts and edit an existing published announcement back to draft, removing it from public view. Client gating does not protect direct API calls.

### F5 — Medium — Partial identity upload can leave a misleading “under review” state

The identity form uploads the ID first and selfie second (`apps/native/src/app/verify-identity.tsx:87-117`). Each upload invalidates the user-document and profile queries (`apps/native/src/hooks/use-documents.ts:85-94`). The identity hook treats either a government ID or selfie record as `review` (`apps/native/src/hooks/use-documents.ts:37-55`); the screen’s review-state early return says “Submitted - under review” and does not render the caught upload error (`apps/native/src/app/verify-identity.tsx:150-181`). If the ID upload succeeds and selfie upload fails, the document set can make the screen report review despite an incomplete submission; retry guidance is hidden until the user changes state. The backend’s verified status correctly requires both document types (`packages/shared/src/volunteer.ts:135-160`).

### F6 — Medium — “Edit your review” submits a fresh default review and can erase prior content

The NGO page labels the action “Edit your review” when a review exists (`apps/native/src/app/ngos/[id].tsx:784-786,843-845`). `ReviewSheet` receives no existing review and initializes rating to 5 and body to empty (`apps/native/src/components/review-sheet.tsx:19-35`). It sends `body: undefined` when blank (`apps/native/src/components/review-sheet.tsx:37-49`), while the server writes `input.body ?? null` (`apps/server/src/modules/engagement/engagement.service.ts:183-193`). Editing without re-entering the review can replace the previous rating/text with a five-star, empty-body record. The checklist explicitly requires editing one’s own review (`docs/product/features-per-role.md:71-75`).

### F7 — Medium — Volunteer document review does not generate the promised notification

The identity screen promises an Activity notification with the review result (`apps/native/src/app/verify-identity.tsx:165-170`), and the checklist says users are told when documents are verified or rejected (`docs/product/features-per-role.md:77-81`). `AdminService.reviewUserDocument` updates document and account verification status, writes an audit record, then returns without creating a notification (`apps/server/src/modules/admin/admin.service.ts:1088-1141`). The notification destination map has no user-document review case (`apps/native/src/lib/notification-destination.ts:17-54`). The stale/current issue is also recorded in `docs/audits/app-audit.md:44`.

### F8 — Medium — Admin team role copy/UI promises role changes the server intentionally rejects

Product copy says Admin can do everything except ownership transfer (`docs/product/features-per-role.md:159-165`; `apps/native/src/lib/team-roles.ts:19-24`), and the team UI offers role actions (`apps/native/src/app/(ngo)/team.tsx:932,1113`). The service rejects an Admin inviting another Admin and rejects Admins changing a teammate to/from Admin (`apps/server/src/modules/publishing/publishing.service.ts:1140-1179`). Those visible actions can return 403 despite the documented permission. Existing permission tests do not cover those exact UI-visible cases (`apps/server/test/team-permissions.spec.ts:278-297`).

### F9 — Medium — User deletion exists as an API state but has no admin UI; NGO deletion has neither

The product checklist and flow claim user deletion and NGO deletion (`docs/product/features-per-role.md:94-107`; `docs/product/flows/superadmin.md:9-17`). User status validation and API support `DELETED` (`packages/shared/src/admin.ts:129`; `apps/server/src/modules/admin/admin.controller.ts:226`; service status handler `apps/server/src/modules/admin/admin.service.ts:883`), but the user drawer exposes suspend/reinstate only (`apps/native/src/components/admin/user-detail-sheet.tsx:63-73`). NGO status schema contains only ACTIVE/SUSPENDED and admin routes provide verification/status, not delete (`packages/shared/src/admin.ts:8-16`; `apps/server/src/modules/admin/admin.controller.ts:162-184`).

### F10 — Medium — Category management is documented as complete but has no mutation API or UI

The checklist claims add/edit/delete categories (`docs/product/features-per-role.md:114-118`) and the superadmin flow includes category management (`docs/product/flows/superadmin.md:21-26`). The categories controller has only `GET /api/categories` (`apps/server/src/modules/categories/categories.controller.ts:15`); there is no category-admin screen or create/update/delete route in the route inventory.

### F11 — Medium — Superadmin donation/report list and export requirements have no corresponding console/API path

The superadmin checklist and flow claim platform-wide donations, financial reports, and exports (`docs/product/features-per-role.md:125-129`; `docs/product/flows/superadmin.md:21-24`). Admin routes expose overview and analytics but no donation/report ledger/export (`apps/server/src/modules/admin/admin.controller.ts:69-120,330-332`). Organization donation history is a separate NGO route and is not a platform-wide superadmin view (`apps/server/src/modules/donations/donations.controller.ts:88-110`).

### F12 — Medium — Donation receipt is view-only although the checklist says download

The volunteer checklist says “Download Receipt” (`docs/product/features-per-role.md:44-48`). The donation card action is “View receipt” and opens a sheet with a Done button, with no download/share action (`apps/native/src/app/(volunteer)/donations.tsx:301-339`). The receipt endpoint returns JSON receipt data rather than a PDF/file (`apps/server/src/modules/donations/donations.controller.ts:98-106`; `apps/server/src/modules/donations/donations.service.ts:330-361`).

### F13 — Medium — Focused admin trend tests fail; production behavior is not established

The focused existing tests for zero-filled trends and volunteer counts fail: expected organization total 1 but received 0 and expected volunteer total 2 but received 0 (`apps/server/test/admin.spec.ts:930-941`). The service contains trend aggregation and zero-fill logic (`apps/server/src/modules/admin/admin.service.ts:292-386`). This is a confirmed test-suite defect or regression in the test environment; no conclusion about production data is supported without isolating the cause.

### F14 — Medium — No runtime response-schema validation at the client boundary

The architecture document says every endpoint should have a shared Zod response schema and the client should parse it (`docs/architecture/notes.md:35-41`). Client response types are handwritten TypeScript interfaces (`apps/native/src/lib/types/domain.ts:1-20,740-879`), and `http.unwrap<T>` only unwraps the response envelope with a generic cast (`apps/native/src/lib/api/http.ts:4-28`). A response shape drift can therefore reach the UI without boundary validation. This is a contract-drift risk, not evidence of a currently malformed response.

### F15 — Low — Signed-out public search exposes authenticated reaction controls without actionable errors

Search screen creates like/save handlers and passes them to public feed cards (`apps/native/src/app/search.tsx:85-99,390-400`). Server reaction endpoints require auth (`apps/server/src/modules/feed/feed.controller.ts:134-195`). Optimistic mutations roll back on failure (`apps/native/src/hooks/use-feed.ts:282-298`), but the search handler does not surface an error to the signed-out user. The action appears available but has no successful effect until sign-in.

### F16 — Low — Feed comment sheet never loads beyond its first 50 comments

The backend comment list is paginated (`apps/server/src/modules/feed/feed.controller.ts:230-239`), but the sheet hardcodes page 1 with limit 50 and has no load-more control (`apps/native/src/components/feed/feed-comments-sheet.tsx:31-35,93-111`). Threads with more than 50 comments are truncated in the UI.

### F17 — Low — Legacy endpoint exceptions and scheduler documentation disagree

Root guide says only webhook and scheduled close-finished are server-only (`AGENTS.md:444-447`), omitting the legacy `POST /api/org/team` and unused legacy `GET /api/feed` (see section 3). Separately, `publishing.controller.ts` says close-finished is “manually runnable from the admin console meanwhile” (`:334-347`), while root/server deployment guidance describes it as a scheduled job (`AGENTS.md:87-90`; `apps/server/AGENTS.md:87-90`). This is documentation drift; it does not by itself show a product failure.

## 5. Product-document mismatches

1. **Platform inventory is stale.** `apps/web/AGENTS.md:1-6` correctly says there is no separate web app, but the Expo app does have a web target. `apps/native/AGENTS.md:9-11` incorrectly says “no web target yet”; package metadata and app config show Expo Web (`apps/native/app.json:24-27`; `apps/native/package.json:30,55-69,84-92`). The same guide and root guide also have stale SDK/RN versions and endpoint counts (`apps/native/AGENTS.md:3-11`; `AGENTS.md:89-92,166-168`).
2. **Architecture notes are obsolete in product and implementation claims.** Notes describe Better Auth, no real backend, an empty DB, and a Next.js/RN-split web plan (`docs/architecture/notes.md:27-42,58-103`). Current product uses Supabase Auth, Drizzle/Postgres, Nest, and Expo Web; root guide identifies the notes as partly stale (`AGENTS.md:546`).
3. **Volunteer checklist assigns NGO actions to volunteers.** “Post a need or an offer” and “Review pledges” appear under Volunteer (`docs/product/features-per-role.md:61-65`), while root roles and implementation place those actions under organisation/NGO (`AGENTS.md:30-44`; NGO need controllers `apps/server/src/modules/needs/org-needs.controller.ts:50-103`).
4. **Donation reporting conflicts across documents.** Organisation flow promises “Download Reports” (`docs/product/flows/organisation.md:25-27`), while checklist says download reports are planned and there is no export endpoint (`docs/product/features-per-role.md:183-188`). The latter matches current server capability.
5. **Donation receipt verb overstates the implementation.** Checklist says “Download Receipt” (`docs/product/features-per-role.md:44-48`), implementation only views JSON receipt details (F12).
6. **Volunteer flow suggests identity approval gates NGO browsing.** The flow orders browsing after identity approval (`docs/product/flows/volunteer.md:8-18`), but onboarding status routes onboarded volunteers to the volunteer app regardless of verification (`apps/native/src/app/index.tsx:114-132`), and event application is role/ownership guarded rather than identity-verification gated (`apps/server/src/modules/events/events.controller.ts:96-109`; `apps/server/src/modules/events/events.service.ts:425-460`). This is a product-policy ambiguity: source permits browsing/applying before verification; docs may mean only that verified applicants get accepted.
7. **Superadmin checklist has completed ticks for absent functions.** Delete NGO and category CRUD have no endpoint/UI; delete user API has no UI; donation/report lists and exports have no superadmin flow (F9-F11). These should not be treated as implemented solely because boxes are checked.
8. **Prior audits contain both current and resolved observations.** `docs/audits/app-audit.md:24,44,53-54,83-88` still describes current upload, notification, announcement, key-ownership, and admin gaps. Other historical findings about signup confirmation, password reset, follow, application route collisions, and attendance gating are now represented in source and should be rechecked before being carried forward. `docs/audits/ui-audit.md` also contains older observations; this audit did not treat it as current without source confirmation.

## 6. Authorization and platform findings

### Authorization

- Server-side checks are the security boundary; client permission gates are mainly UX. The NGO client consults `useOrgAccess` to hide or disable controls, and team services enforce scoped permissions. Team permission tests cover a role/action matrix (`apps/native/src/hooks/use-org-access.ts`; `apps/server/src/modules/organizations/organizations.service.ts:59`; `apps/server/test/team-permissions.spec.ts:329-360`).
- The announcement service is an exception: it checks permission only for a published status, so direct API calls bypass Viewer read-only policy (F4).
- Upload authorization diverges from organization membership resolution: eligible teammates can see controls but are treated as non-owners by the upload service (F2).
- Download URL authorization makes NGO files owner-only/superadmin, conflicting with public report and image presentation (F1).
- Document record writes accept any extant storage key, not a key bound to the caller or record purpose (F3).
- Team Admin role copy is broader than the service’s special restrictions on granting/changing Admin (F8).

### Android and web-rendered UI

- Most screens and routes are shared React Native components. Responsive role shells have phone navigation and desktop navigation (`apps/native/src/app/(ngo)/_layout.tsx:59`; `apps/native/src/app/(admin)/_layout.tsx:52`; `apps/native/src/components/nav-items.ts:88`). This supports a web rendering path in source; no web runtime was launched.
- Donation checkout explicitly branches: web loads Razorpay Checkout.js, Android loads `react-native-razorpay` (`apps/native/src/components/donate-sheet.tsx:54-141`). The repo requires a custom development client/store build for the native module; Expo Go is not a supported Android payment runtime (`AGENTS.md` donation notes; `apps/native/AGENTS.md:13-17`). Actual payment completion was not exercised.
- Identity verification includes camera/selfie capture and image/document upload. The relevant code exists (`apps/native/src/components/verification/selfie-capture.tsx:113-217`), but camera permissions, capture behavior, and browser file handling were not tested on Android or web.
- Stored-document opening uses React Native `Linking` (`apps/native/src/hooks/use-documents.ts:97-112`). Download, browser behavior, and native file association were not exercised; authorization defects are source-confirmed.
- No platform-only alternative repairs the public signed-file or team upload authorization issues; both target the same server endpoints.

### Data contracts and cross-cutting state

- Request schemas are shared from `@nabhya/shared` and server controllers validate with `ZodValidationPipe`; the server guide requires the same shared schema in client forms (`apps/server/AGENTS.md:43-45`; root conventions `AGENTS.md:478-483`). Examples in this audit include identity document types, organization document records, and donation receipt output. The notable integrity exception is storage-key ownership/purpose validation (F3).
- The response envelope is unwrapped, but per-endpoint payloads are returned as generic TypeScript types without runtime schema parsing (`apps/native/src/lib/api/http.ts:4-28`; F14). This means the type contract does not verify the server’s actual response at runtime.
- `PagedList` centralizes first-load/loading, error/retry, empty, load-more, and pull-to-refresh states (`apps/native/src/components/paged-list.tsx:43-84,154-220`). The volunteer activity page intentionally merges the first page of five endpoints (`apps/native/src/app/(volunteer)/activity.tsx:108-127`; `AGENTS.md:450-454`).
- Like/save mutations patch cached feed pages optimistically and roll back on failure, avoiding a feed refetch/re-rank on each tap (`apps/native/src/hooks/use-feed.ts:274-298`). Comment deletion refreshes relevant comment/feed caches (`apps/native/src/hooks/use-feed.ts:348-357`). A comment read still has the fixed first-page limit in F16.
- The most consequential confirmed fields not reaching a useful persisted/display outcome are: the review form’s omitted body becoming `null` on edit (F6), identity partial state being interpreted as review (F5), and public reports being listed but their object keys not readable by the intended audience (F1). No additional accepted-but-ignored fields were confirmed from the reviewed paths.

## 7. Prioritized recommendations

These are proposed next steps, separate from the confirmed findings above.

| Finding | Suggested next step |
|---|---|
| F1 | Provide a public-safe asset/report delivery path for files explicitly intended to be public; retain private signed URLs for private documents. Add public and authenticated access coverage. |
| F2 | Resolve org-scoped upload ownership through active team membership and the permission required for each upload purpose; ensure eligible team members can also read files needed by their screen. |
| F3 | Validate storage-key owner and purpose against the authenticated principal and the target record before persisting; reject cross-owner and cross-purpose keys. |
| F4 | Enforce `content.publish` for all announcement writes, including draft creation, status changes, and edits; add direct-service/API tests for Viewer and Member roles. |
| F5 | Treat identity submission as an all-or-retry workflow: preserve per-document progress, render partial-upload errors before the generic review state, and permit safe retry without duplicate/confusing records. |
| F6 | Pass the existing review into the editor and prefill rating/body; preserve omitted fields or explicitly require the user to resubmit them. |
| F7 | Create an in-app notification for user-document decisions and map it to a useful destination; align the screen promise with actual notification behavior. |
| F8 | Align team-role copy and controls with server policy, or change the policy if Admins are intended to manage Admins. Test the exact grant/change/remove combinations the UI exposes. |
| F9-F11 | Decide whether the documented destructive and reporting operations remain in scope. If yes, add authorized UI and server actions; if no, correct the checklists and flows. Do not add NGO deletion without defining retention/audit behavior. |
| F12 | Either implement a real downloadable/shareable receipt artifact or change the checklist and UI wording to “View receipt.” |
| F13 | Isolate the failing admin test fixtures/query behavior and restore focused test coverage; determine separately whether the same conditions occur against PostgreSQL. |
| F14 | Add shared response schemas and parse responses at the client boundary, or revise the architecture rule and document the accepted type-safety boundary. |
| F15-F16 | Hide or gate signed-out reaction controls with a sign-in path and visible error feedback; add comment pagination/load-more or indicate the 50-comment cap. |
| F17 | Reconcile root and server guides with actual route inventory, mark compatibility endpoints explicitly, and remove the stale manual-run comment or expose/document the admin action. |
| Docs | Update Expo/RN versions and describe the actual Expo Web target. Reconcile the stale architecture notes and correct feature ownership/report/receipt claims. |

## 8. Verification and limitations

- The focused endpoint-surface test passed 10/10, but omits Feed and Search as described above (`apps/server/test/endpoints.spec.ts`).
- Focused admin trend tests failed for the two assertions cited in F13. Production impact is unverified.
- A broader server test invocation was started unintentionally and interrupted after output showed two failures in `admin.spec.ts`; it did not complete and is not a valid full-suite result. The focused trend test reproduced two specific failures. No conclusion is drawn from the incomplete broad run.
- No typecheck/build was run. The audit task asked for focused existing checks; static inspection and the two focused server test selections were considered sufficient for the cited conclusions.
- Neither Android nor the Expo web renderer was launched. Layout, navigation, camera, file-picker, external-link, download/share, checkout, and device permission behavior remain runtime-unverified.
- No external services were contacted. Razorpay webhook delivery, Supabase Storage behavior in a configured environment, and any guest receipt email delivery were not verified. The guest checkout success copy says a receipt goes to the submitted address (`apps/native/src/components/donate-sheet.tsx:255-260`), while the root guide says no email provider is wired (`AGENTS.md:161-162`); delivery is therefore unverified, not a confirmed failure.
- Static source tracing cannot prove deployment configuration, live database state, scheduled-job registration, or real-user navigation behavior.
- The working tree already contained unrelated changes to `packages/db/package.json`, `packages/db/src/seed-org-content.ts`, and `packages/db/src/seed-reviews.ts`; those files were left untouched. This audit adds only `final-audit.md`.
