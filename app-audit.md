# Nabhya app audit - 2026-10-10

Scope: `apps/native` and `apps/server` (plus `packages/db`, `packages/shared`). `apps/web` excluded.
Branch `feat/ngo-teams` @ `ccc00c9`, clean tree.

## Health checks

- `pnpm check-types` - clean (native + server).
- Server tests - 23 files, 376 / 376 passing.
- Every client endpoint in `apps/native/src/lib/api/endpoints.ts` / `services*.ts` has a matching server route.
- Every `router.push` / `href` target exists as a route file.
- No TODO / "coming soon" / mock-data screens in the native app.

Severity: **Broken** = user hits an error or dead end. **Security** = permission or ownership hole. **Incomplete** = planned or half-built. **Polish** = minor.

---

## 1. Broken

### Server / data

| # | Issue | Where |
|---|---|---|
| B1 | Non-owner teammates can't upload or download org files (logo, cover, event cover, org documents, financial reports) - 403. `resolveOwnerId` looks the org up by `ownerUserId` only; every other `org/*` route resolves through team membership. | `apps/server/src/modules/uploads/uploads.service.ts:170-188` |
| B2 | Refunds never apply. The handler returns early unless the donation is `PENDING`, but refunds arrive for `COMPLETED` donations. The provider also reads `payload.payment.entity`; `refund.processed` carries `payload.refund.entity`, so `referenceId` is null. Open `TODO(payments)`: event names never checked against a live webhook. | `apps/server/src/modules/donations/donations.service.ts:140`, `razorpay-payment.provider.ts:87-129` (TODO at 115) |
| B3 | Migration `0010_post_interaction_type_rename.sql` has no journal entry, so `db:migrate` never runs it. The DB keeps enum `feed_interaction_type` while `schema/feed.ts:102` declares `post_interaction_type`. Dev hides it because the server runs `drizzle-kit push` when it starts. Also: two `0007_*` files, no `0008`, snapshots stop at `0010_snapshot.json`. | `packages/db/src/migrations/meta/_journal.json` |
| B4 | Events never auto-close. There's no scheduler (no `@Cron` / ScheduleModule). `POST admin/events/close-finished` needs a superadmin JWT and nothing calls it, so events stay `PUBLISHED` forever. | `apps/server/src/modules/publishing/publishing.controller.ts:337` |

### NGO side

| # | Issue | Where |
|---|---|---|
| B5 | Attendance and certificate controls have no role check. The server enforces `people.attendance`, `certs.issue` and `certs.revoke`, so a Viewer sees "Mark attended", a Member sees "Issue certificate" and a Manager sees "Revoke" - all get 403. Accept/Reject are gated correctly (`people.review`, line 83). | `apps/native/src/components/applicants-sheet.tsx:342-590`; server `certificates.service.ts:62,144,223` |
| B6 | "Include people who left" on the Team screen does nothing. `teamListQuerySchema` defaults `status` to `ACTIVE` and `listTeam` always filters `ACTIVE`. Also `includeLeft: z.coerce.boolean()` reads the string `"false"` as `true`. | `apps/native/src/app/(ngo)/team.tsx:60,75,149`; `packages/shared/src/publishing.ts:195-198`; `publishing.service.ts:303-307` |
| B7 | The bottom "Save changes" button on org edit is only `disabled={busy}`, unlike the role-gated header Save (line 311). Members and Viewers submit and get 403. | `apps/native/src/app/(ngo)/edit.tsx:598` |

### Volunteer side

| # | Issue | Where |
|---|---|---|
| B8 | The "Nearby" NGOs tab never works for volunteers. `hasFix = !!me?.organization` is always false for a volunteer, and the request hardcodes Mumbai (`19.076, 72.8777`). `MyProfile` has no lat/lng. | `apps/native/src/app/ngos/index.tsx:66-78`; `lib/types/domain.ts` |
| B9 | No forgot / reset password (no screen, link or `resetPasswordForEmail` call), though `PerRoleFeatures.txt` marks it done. | `apps/native/src/app/(auth)/*` |
| B10 | If Supabase email confirmation is on, sign-up gets no session and throws "Supabase Auth did not return an access token". `authErrorCopy` doesn't map it. The account is created, but the user sees a raw error and no "check your email" step. | `apps/native/src/app/(auth)/signup.tsx:38-46`; `lib/api/auth.ts:191` |
| B11 | Volunteers are never told when their ID or selfie is reviewed. `reviewUserDocument` sends no notification (org documents do, line 1014). `verify-identity.tsx:201` promises one, and `notification-destination.ts` has no `USER_DOCUMENT` case. | `apps/server/src/modules/admin/admin.service.ts:1082` |
| B12 | The failed-donation path dead-ends. The donate sheet says "try again from My Donations", but only completed donations get an action there. | `apps/native/src/components/donate-sheet.tsx:238`; `(volunteer)/donations.tsx:267-277` |

---

## 2. Security

| # | Issue | Where |
|---|---|---|
| S1 | Announcements: `createAnnouncement` / `updateAnnouncement` check `content.publish` only when the status is `PUBLISHED`. Any active member, Viewers included, can create drafts, PATCH a published announcement back to `DRAFT` (taking it down), and edit its title and body. Events use `requireCanDraft` for this; announcements have nothing. Publishing a draft also skips `requireVerifiedOrganization`. | `apps/server/src/modules/publishing/publishing.service.ts:65-71,111-125` |
| S2 | Document storage keys aren't checked for ownership. `assertUploaded` only checks that the object exists, and the Zod schemas accept any string, so a user can attach someone else's uploaded file. Feed media is checked properly (`uploads.service.ts:123`). | `users.service.ts:196`, `organizations.service.ts:494`, `publishing.service.ts:227`; `shared/volunteer.ts:129`, `organization.ts:91`, `publishing.ts:75` |
| S3 | Dev only: the stub payment provider's `parseWebhook` has no signature check (anyone can complete a donation), and invalid JSON causes a 500. The real Razorpay check is correct (HMAC over raw body, timing-safe). | `apps/server/src/modules/donations/stub-payment.provider.ts` |

---

## 3. Incomplete / planned but missing

### Volunteer
- **Edit profile** (`apps/native/src/app/edit-profile.tsx`)
  - Fields are sent as `x.trim() || undefined`, so a cleared bio, phone or city is never cleared; clearing needs `null` (root AGENTS.md trap 5) (lines 50-57).
  - City is free text instead of `CityPicker` / `lib/cities.ts` (line 115).
  - Photo, causes (`categoryIds`) and coordinates can't be edited after onboarding, and causes drive feed ranking.
- **Activity tab** merges only page 1 (`limit: 20`) of 5 endpoints. Counts and unread are computed from those partial pages, and older items can't be reached - `(volunteer)/activity.tsx:89-93,216,229`.
- **NGO page** (`ngos/[id].tsx`)
  - No follow button (line 260); following only works from feed cards and search.
  - The NGO's own events and needs aren't listed.
- **NGO directory** has no city filter, though the server's `publicOrgQuerySchema` accepts `city`.
- **Donations:** no receipt download or share - `(volunteer)/donations.tsx:284+`.
- **Email verification:** no resend and no pending screen.

### NGO
- A revoked certificate can never be reissued. Issuing returns "already issued", and attendance can't be un-marked while a certificate row exists (`certificates.service.ts` ~89, ~176).
- Attendance and certificates can be done before the event happens; there's no `startAt`/`endAt` check (`certificates.service.ts:56-100`).
- Ownership transfer sends no notification. The owner copies a token by hand and the admin pastes it (`publishing.service.ts:853-890`; `team.tsx` ~998, ~1087).
- Invite emails
  - Skipped (only a log warning) without `RESEND_API_KEY` (`mail.service.ts:13`).
  - The invite URL is built from `CORS_ORIGIN`, a web origin with no app deep link (`publishing.service.ts` ~1303).
- The certificate revoke reason is hardcoded to "Revoked by the organization" (`applicants-sheet.tsx:402`).
- A member whose own membership is suspended sees "Your team role doesn't allow this" instead of a suspended message (`use-org-access.ts:44-55`).
- No donation report export (`PerRoleFeatures.txt:211`, `org.md` P→Q).
- `DONATION_RECEIVED` goes only to the owner, not the whole team (`donations.service.ts:178`).

### Admin
- **Delete user:** the server accepts `status: DELETED`, but the UI only toggles SUSPENDED/ACTIVE (`user-detail-sheet.tsx:76-98`).
- **Delete NGO:** `orgStatusSchema` is only ACTIVE/SUSPENDED; there's no route and no UI.
- **Manage categories:** only the public `GET` exists (`categories.controller.ts:15`).
- **Donations / financial reports:** there's no platform-wide list, only analytics aggregates.
- **Review and comment moderation:** no admin UI. The server lets a superadmin delete comments (`feed-engagement.service.ts:119`), but there's no path for reviews.
- **Reports / flagging:** neither the server nor the UI has it.
- **Suspension notifications:** suspending an org or a user notifies nobody (`admin.service.ts:625,877`).
- **Close finished events:** nothing in the UI triggers it (see B4).

### Production config (stubs refuse to boot in production)
- **Storage:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, plus the `ngo_verification` and `feed_media` buckets.
- **Payments:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, with the webhook registered.
- **Mail:** `RESEND_API_KEY`.

---

## 4. Polish

**Native**
- The home feed silently falls back to a hardcoded "Mumbai" when the detected city has no results - `(volunteer)/index.tsx:118-125,239`.
- On the NGO page, bookmarked state comes from only the first 100 bookmarks. `useBookmarks` has no `enabled` guard, so a signed-out visitor sends a guaranteed-401 request to `/me/bookmarks` - `ngos/[id].tsx:138-141`; `hooks/use-engagement.ts:61`.
- `verify-identity.tsx` doesn't load existing documents, so a verified or under-review volunteer can submit again; it's linked unconditionally from `(volunteer)/profile.tsx:270`.
- Edit profile closes with no success toast (`edit-profile.tsx:59`).
- Event detail has no share, add-to-calendar or directions.
- `(ngo)/announcements.tsx:72` blocks drafting until the org is verified, while events and needs allow drafts - inconsistent.
- The `?review=` fallback fills made-up `pendingApplications: 0` / `createdAt: startAt` (`(ngo)/events.tsx:93-95`); harmless today.

**Server**
- No UI calls the legacy `POST /org/team` (`inviteAdmin`).
- `common/email/verification-email.ts` is never imported.
- `parseStorageKey` has a legacy-layout fallback for org documents but not for user documents (`storage.keys.ts:150-153`).
- About 20 `noExplicitAny` lint warnings in `admin.service.ts`.
- Root `AGENTS.md` says 114 endpoints; the actual count is about 136.

**Tests**
- `endpoints.spec.ts` leaves `FeedController` and `SearchController` out of the auth/role sweep (18 routes skipped), and its hard-coded count of 117 is wrong (lines 174-213, 262).
- `uploads.spec.ts` builds keys in the old `user-documents/<label>-<date>/<userId>/` layout (lines 57-62, 205, 219). The "forged key" test passes for the wrong reason.

**Open items carried over from `apps/server/SERVER-CHANGES.md`**
- One team per account (contradicts epic #10).
- No `isFollowing` flag on the public NGO page.
- Snapshots need regenerating.

---

## Suggested order

1. Server first, since every user is affected: B1, B2, B3, S1, S2, B4.
2. Native permission fixes: B5, B6, B7.
3. Volunteer flows: B8-B12.
4. Then section 3 by priority, polish last.
