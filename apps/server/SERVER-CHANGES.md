# Server changes for review - NGO pass (2026-09-26)

For Aman. Everything below is uncommitted on `feat/ngo-teams`, made while
reworking the NGO side of the app. Each change is small and follows the patterns
already in the codebase (`requireOrgPermission`, `paginate`/`toOffset`,
fire-and-forget notify/audit, `@Inject` on every constructor param). Every item
has an integration test; the suite is **372 passing**, `verify:di` is green,
and the endpoint count is now **117** (+4: see "New endpoints").

Please look hardest at the items marked **Decision** - those change behaviour
someone might have relied on, and I would rather you overrule them now.

---

## New endpoints (2)

| Route | Why | Pattern copied |
|---|---|---|
| `GET /api/organizations/me/overview` | Dashboard counts (published events, open needs, pending applicants/pledges) over the **whole** org. The client used to sum page 1 of two lists, so anything past 20 rows was missing and "All caught up" could be false. | Four small `count()` queries, no correlated subqueries (trap 2). |
| `GET /api/me/following` | Issue #7: the Following page - NGOs the volunteer follows. | Exact copy of `me/bookmarks` (`listBookmarks`), on the `follows` table. |
| `POST /api/team/invites/by-id/:id/accept` and `.../decline` | The in-app `TEAM_INVITE` notification carries the invite **id**; the token only travels in the email, so an invitee who never opened it could not join. Same checks as the token path (email must match, role grant, one team) - `acceptInvite` / `declineInvite` are now shared by both entry points. | Beside the token routes, same decorators. |

## Schema (1 migration)

- `event_applications.hours_served numeric(5,1)`, nullable -
  `packages/db/src/migrations/0016_hours_served.sql`.
- **Hand-written, like 0011-0015.** `drizzle-kit generate` no longer works
  here: the last snapshot is `0010`, so it diffs against a stale schema and
  stops on an interactive enum prompt. Worth regenerating snapshots at some
  point; I didn't, to keep this small.

## Notifications that were defined but never sent

`NEW_APPLICATION`, `NEW_PLEDGE`, `TEAM_ROLE_CHANGED`, `TEAM_REMOVED` and
`OWNERSHIP_TRANSFERRED` were in the enum with no caller - an NGO learned about
applicants and pledges only by opening the event or need.

- New helper `NotificationsService.notifyOrganizationTeam(orgId, payload,
  { permission })` - moved out of `AdminService` so every module can use it.
  With `permission` it reaches only teammates whose role has it
  (`canTeamRole`), so a viewer is not told about applicants they cannot review.
- `EventsService.apply` -> `NEW_APPLICATION` to `people.review` holders
  (also on re-apply after withdrawing). `NeedsService.pledge` -> `NEW_PLEDGE`.
- `updateAdmin` (role change) -> `TEAM_ROLE_CHANGED`; `removeAdmin` ->
  `TEAM_REMOVED`; `confirmOwnershipTransfer` -> `OWNERSHIP_TRANSFERRED` to the
  previous owner.
- Client side, `lib/notification-destination.ts` now routes every entity type
  per role (it handled three).

## Issue #8 - volunteer hours

- `markAttendanceSchema` gains optional `hours` (0.5-500, half-hour steps;
  `null` clears, omitted keeps). Un-marking attendance clears it.
- Certificate PDF prints `hours_served` when set, else the event duration (what
  it always did). `certificates.service.ts` joins `event_applications` for it.
- `ImpactService` volunteer + org totals use
  `coalesce(hours_served, event duration)`.
- Existing rows need no backfill: null = "whole event", same as before.

## Issue #7 - following

- `getById` (used by the public NGO page and `/organizations/me`) now returns
  `followerCount` - one extra `count()` on `follows`.
- `GET /api/me/following` above.
- Not done: an `isFollowing` flag on the public NGO page (it needs
  `@OptionalAuth` on that route). The app still follows from feed cards and
  unfollows from the Following page.

## Team invites and onboarding

- **`acceptTeamInvite` grants the `organisation` role** to an account with no
  role. Without it, an invitee landed on role-select, picked "organisation" and
  was sent to register a *second* NGO. Legacy `inviteAdmin` does the same.
- **Decision - volunteer accounts can't accept.** A `volunteer` account gets a
  403 with a clear message. Roles are one-shot (`selectRole`) and the client
  routes on `roles[0]`, so a volunteer on a team could never reach the NGO app.
- **Decision - one team per account.** Accepting 409s if the account already
  owns or belongs to an NGO. `getActiveMembership` resolves every `org/*` call
  with `limit(1)`, so a second membership meant acting on an arbitrary NGO.
  **This contradicts epic #10** ("a user can be on multiple org teams"). Doing
  that properly needs an org switcher and the org id on each request - happy to
  build it if we want it for v1.
- The inviter gets a `TEAM_INVITE_ACCEPTED` notification.
- `OnboardingService.getStatus` treats an **active membership** as onboarded
  (it only checked `owner_user_id`), and still reports a suspended org so the
  app can explain the suspension. `completeOrganizationOnboarding` refuses an
  account already on a team.
- `requireOwnedOrganization`: an active member of a *suspended* org now gets
  "This organization is suspended" instead of "Your team membership is not
  active".

## Notifications from admin review

`AdminService` never sent a notification. Now (fire-and-forget, to every active
team member plus the owner column):

- `reviewOrganization` VERIFIED / REJECTED -> `ORG_VERIFIED` / `ORG_REJECTED`
  (the reason is the body, verbatim).
- `reviewOrganizationDocument` -> `DOCUMENT_VERIFIED` / `DOCUMENT_REJECTED`
  (the reviewer's remarks are the body).

`AdminService` now injects `NotificationsService` (global module, `@Inject`ed).

## Permission holes closed

| Where | Before | Now |
|---|---|---|
| `FeedService.create` / `createMediaIntents` | verification only - a VIEWER could post as the NGO | + `content.publish` |
| `FeedService.remove` | author or superadmin only | + any teammate with `content.delete` in the post's org (a departed member's posts were undeletable) |
| `EngagementService.replyToReview` | no check - any member could reply publicly | `content.publish` |
| `EventsService.update` | only draft->published was checked; anyone could edit a live event | editing a non-draft needs `content.publish` |
| `EventsService.create/update` of drafts | anyone, including VIEWER | everyone except VIEWER (`requireCanDraft`; there is no `content.draft` action, so it checks the role by name) |

## Server-side filters (were client-side over loaded pages)

- `GET /org/announcements?status=DRAFT|PUBLISHED` (`myAnnouncementQuerySchema`)
- `GET /org/reviews?awaitingReply=true`, plus `awaitingReplyCount` in the
  response (`orgReviewQuerySchema`, `z.stringbool()` - `coerce.boolean` reads
  `"false"` as true).
- `GET /org/needs/:id/pledges?status=...` (`pledgeQuerySchema`)
- `listMyOrganizationReviews` no longer goes through `listReviews`, which calls
  `assertPubliclyVisible` - an unverified NGO got a 404 on its own Reviews tab.

## Smaller

- `updateOrganizationSchema`: `teamSize` / `foundingYear` accept `null` to
  clear (`z.null().or(...)`, null first - `coerce.number` turns null into 0).

## Not touched, noticed

- `test/endpoints.spec.ts` counts **117**, but the real route table is **135**:
  its controller list omits `FeedController` (17 routes) and
  `SearchController` (1), so those are not in the auth/role sweep either.
  Worth adding both - I left the list alone to keep this diff small.

- `admin.service.ts` has ~20 `noExplicitAny` lint hits (lines ~1511, ~1903)
  and `impact.service.ts:107` one `useOptionalChain` - pre-existing, left alone.
- `apps/server/src` had 99 stale compiled `.js` files (gitignored) that
  shadowed the `.ts` sources and crashed `pnpm dev`. Deleted locally; if a
  `tsc` without `--noEmit` runs again they'll come back.

## Files

Server: `admin.service`, `certificates.service`, `engagement.controller/service`,
`events.service`, `feed.service`, `needs.service`, `org-needs.controller`,
`onboarding.service`, `organizations.controller/service`, `impact.service`,
`publishing.controller/service`.
Shared: `certificates`, `engagement`, `needs`, `organization`, `publishing`.
DB: `schema/events.ts`, `migrations/0016_hours_served.sql`, `meta/_journal.json`.
Tests: new `feed-permissions.spec.ts` and `team-permissions.spec.ts` (epic
#10's role x action matrix: every guarded call x ADMIN/MANAGER/MEMBER/VIEWER,
derived from `canTeamRole`, plus suspended/left/removed teammates shut out of
all of them); additions in admin, certificates,
endpoints, engagement, events, impact, needs, onboarding, organizations,
publishing specs.

---

## NGO review drawers and dashboard counts (2026-10-24)

No new routes, no schema change. Three response additions, each read by one
NGO screen:

- `GET /api/org/events/:id/applications` now returns `counts` beside
  `items`/`meta`: `{ PENDING, ACCEPTED, REJECTED, WITHDRAWN, all }` across the
  whole event, ignoring the `status` filter and the page - so the applicants
  drawer's chips read "Pending 3 / Accepted 2" before either is pressed. One
  `GROUP BY status` (`EventsService.applicationCounts`). Type
  `ApplicationStatusCounts` in `@nabhya/shared` `events.ts`.
- `GET /api/org/needs/:id/pledges` the same, `{ PENDING, ACCEPTED, REJECTED,
  COMPLETED, CANCELLED, all }` (`NeedsService.pledgeCounts`,
  `PledgeStatusCounts` in `needs.ts`).
- `GET /api/organizations/me/overview` (`OrgOverview`) gains `draftEvents`
  and `followers`, two more `count()`s in the existing `Promise.all`, so the
  dashboard can show a number on every row.

Tests: "counts applicants by state across the event, whatever the filter"
(`events.spec.ts`), "counts every state across the need, whatever the
filter" (`needs.spec.ts`), and the overview `toEqual` in
`organizations.spec.ts` extended with a draft event and a follower (plus
another org's follower that must not leak in).
