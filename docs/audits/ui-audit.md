# Nabhya UI/UX audit - 2026-10-10

Mode: `oiloil-ui-ux-guide` **review**. Scope: `apps/native` - auth & onboarding, volunteer, NGO, superadmin console.
Method: code-based review against the project's **own** design language (`apps/native/AGENTS.md`, root `AGENTS.md`), not an imposed style. No screenshots were taken because browser automation isn't allowed here. Paths are relative to `apps/native/src/`.

Companion to `app-audit.md`, which covers functional bugs. Where an item is in both, it's marked **[also in app-audit]**.

## Status - fixes applied 2026-10-10 (uncommitted)

All P0 and P1 items are fixed, and nearly all P2. Native and server type checks are clean, Biome shows no errors, server tests pass (393/393), and DI resolves.

**Not done, or done differently:**
- **N4:** Reviews stays as cards: a review is prose you read, not a record you compare. Announcements filter but don't sort, because the publishing endpoint takes no sort.
- **N5:** deep-links to `?review=<id>` only when exactly one event or need is pending. Otherwise it opens the full list, because those screens take no status filter param.
- **AD9:** "Approve & next" works in the NGO drawer only, not the volunteer drawer.
- **Admin P2:** the phone tab bar has no badge, and the phone cards have no tick column.
- **Composer badges:** use the 12pt `Micro` ramp step, pinned with `maxFontSizeMultiplier={1}`. There is no 9–10pt step.
- **Follow on the NGO feed:** removed rather than given a toast. Follow is volunteer-only on the server, so for an NGO account it always failed with a 403.

**Server changes this required:**
- `GET /organizations/:id` is now optional-auth and returns `viewer { following, bookmarked }`.
- New `POST /org/events/:id/applications/bulk-review` and `POST /org/events/:eventId/applications/bulk-attendance` (endpoint count 117 → 119).
- `sort` + `dir` on the NGO events, needs and donations lists.
- An admin "Awaiting" verification filter.
- New shared schemas: `passwordResetRequestSchema`, `newPasswordSchema`, `bulkReviewApplicationsSchema`, `bulkAttendanceSchema`, and the `BulkResult` type.

**Setup needed:** add `<web origin>/reset-password`, `<web origin>/login` and `nabhya://reset-password` / `nabhya://login` to the Supabase Auth redirect URL allow-list.

## Context

| | Auth / onboarding | Volunteer | NGO | Admin |
|---|---|---|---|---|
| Surface | Native + web, forms/wizard | Feed, detail, lists | Dashboard, lists, composer, sheets | Desktop-first data console |
| Primary task | Get in, pick role, finish setup | Find and commit (apply / pledge / donate / follow) | Publish, review people, certify | Clear the verification queue |
| Primary CTA | Sign in / Continue | Apply · I'd like this · Donate · Follow | Post · Accept · Issue certificate | Approve / Reject |

Diagnosis labels: **exec** = execution gulf (can't find *how*), **eval** = evaluation gulf (can't tell *what happened*); **slip** = right goal, wrong execution; **mistake** = wrong mental model.

## Scorecard

| Area | P0 | P1 | P2 |
|---|---|---|---|
| Auth & onboarding | 1 | 6 | 8 |
| Volunteer | 2 | 6 | 6 |
| NGO | 2 | 5 | 5 |
| Admin console | 2 | 10 | 6 |
| **Total** | **7** | **27** | **25** |

---

## P0 - blockers

### A-P0-1. Sign-up dead-ends with a developer error when email confirmation is on [also in app-audit B10]
- **Evidence:** `lib/api/auth.ts:70-77` calls `getAuthenticatedUser(session?.access_token)`, which throws "Supabase Auth did not return an access token" (`:191`). `authErrorCopy` (`components/auth-error.tsx:136-142`) doesn't map it, so `signup.tsx:49` shows it raw. The account was created, so a retry says "already registered". `auth-error.tsx:107` already handles "email not confirmed", so confirmation is probably on.
- **Diagnosis:** eval; mistake (caused by the system).
- **Fix:** When `!session && user`, return `{ pendingConfirmation, email }`. Show a "Check your inbox at {email}" state with "Open sign in" and "Resend" (`supabase.auth.resend`).
- **Accept:** With confirmation on, sign-up ends on the confirm-email state, and no "access token" text is ever shown.

### V-P0-1. You can't follow or unfollow an NGO from its own page [also in app-audit §3]
- **Evidence:** `app/ngos/[id].tsx` doesn't import `useToggleFollow`. It shows a Followers count (`:260`), and its only actions are Donate and Save (`:166-201`, `:290-301`). Two pieces of copy point to that page anyway:
  - `components/feed/card/card-header.tsx:158-167` says "Unfollowing lives on the NGO page".
  - `following.tsx:77` says follow "from any of its posts".
- **Diagnosis:** exec; mistake.
- **Fix:** Add a Follow / Following `Button` next to Donate, in both the mobile header and the desktop `actionCard`. Unfollow uses the Undo toast pattern from `following.tsx:43-51`.
- **Accept:** A signed-in volunteer can follow, unfollow and undo on `/ngos/:id`, and the control exposes `accessibilityState`.

### V-P0-2. The full applications list can't be reached
- **Evidence:**
  - `(volunteer)/_layout.tsx:61` hides the `events` tab.
  - `(volunteer)/events.tsx:35` claims it is "reached from Activity and Profile", but nothing links there.
  - **Route collision:** `app/events/index.tsx` and `app/(volunteer)/events.tsx` both resolve to `/events`. So `router.push("/events")` from `certificates/index.tsx:70` and `search.tsx:242` is ambiguous.
  - Activity merges only the first 20 applications (`activity.tsx:91`).
- **Diagnosis:** eval; IA mistake.
- **Fix:** Rename the volunteer screen's route (e.g. `(volunteer)/applications.tsx`). Add an "Applications" `ListRow` under Profile → Your activity, and a "See all" link in Activity's Events filter.
- **Accept:** A volunteer with 25 applications reaches all 25 within 2 taps of a tab, and `/events` has exactly one route.

### N-P0-1. Applicant review and attendance are one-at-a-time card work
- **Evidence:**
  - `components/applicants-sheet.tsx:282-417` renders each applicant as a `Surface` card with its own Accept/Reject.
  - Attendance is per row: Mark attended → Issue certificate → hours → Confirm (`:433-697`).
  - There's no selection and no bulk action. `busy={review.isPending}` (`:213`) freezes every row while one decision is in flight.
  - Result: about 50 taps for 50 applicants, and about 90 to certify 30 people.
- **Diagnosis:** exec; mistake (the screen's shape doesn't match the job).
- **Fix:** On desktop, make it a table: checkbox, name, city, applied, status, message. Add a status `Select`, a sticky bulk bar (Accept / Reject / Mark attended / Issue certificates), and busy state per row. Keep cards on phones.
- **Accept:** 20 attendees can be marked and certified in 3 actions or fewer.

### N-P0-2. Reject is one tap and irreversible, and the shared note can go to the wrong person
- **Evidence:**
  - Reject calls `decide(..., "REJECTED")` directly (`applicants-sheet.tsx:398-406`), with no confirm and no Undo.
  - The "Note to the volunteer" field sits once in the header and is "sent with your next decision" (`:131-144`). That is a mode error: a note written for A goes to whoever is clicked next.
  - This breaks AGENTS.md: "A consequence that cannot be undone gets `confirm` first."
- **Diagnosis:** slip.
- **Fix:** Put a note expander on each row. Reject gets a named confirm or a 5s Undo toast.
- **Accept:** A note is tied to one applicant, and Reject can be undone or confirmed by name.

### AD-P0-1. "Mark under review" shows the toast "Organization rejected."
- **Evidence:** `components/admin/org-detail-sheet.tsx:120-123`: `VERIFIED ? "Organization verified." : "Organization rejected."`. `UNDER_REVIEW` falls into the reject message. (Checked.)
- **Diagnosis:** eval; mistake (caused by the system): the reviewer thinks they rejected an NGO.
- **Fix:** Give each of the three outcomes its own message ("Marked under review.").
- **Accept:** Each status change shows its own message.

### AD-P0-2. Reject or Suspend without a reason fails silently
- **Evidence:** `org-detail-sheet.tsx:105-109,136-138` sets `reasonError` on a `ReasonField` placed at the very end of the body (`:435-442`), below Timeline, Posts and Documents. The buttons are pinned in the footer, so the error is off-screen. The same happens in `user-detail-sheet.tsx:79-81,332-339`.
- **Diagnosis:** exec. The press looks dead, so the reviewer presses again.
- **Fix:** Ask for the reason in the confirm step, as `RejectDocumentsSheet` does. Failing that, scroll to the field and focus it on error.
- **Accept:** Pressing Reject with an empty reason brings the field into view with the caret in it.

---

## P1 - important

### Auth & onboarding
| # | Problem | Evidence | Diag | Fix |
|---|---|---|---|---|
| A1 | No forgot / reset password [also in app-audit B9] | No reset code anywhere in `src`; the wrong-password copy (`auth-error.tsx:~100`) offers no way out | exec | "Forgot password?" `TextAction` under the password field in `login.tsx:108-119`, opening a sheet that calls `resetPasswordForEmail`. Add a reset action to the wrong-credentials error. |
| A2 | Choosing a role is permanent but takes one tap | `role-select.tsx:114-117`: the card's `onPress` commits; "Contact support" (`:95`) has no link | slip | Tap selects, then a pinned "Continue as …" button, or `confirm()` before `mutate`. Make support a mailto link. |
| A3 | Wizard "Sign out" deletes the draft without asking | `(onboarding)/index.tsx:399-406`, `volunteer.tsx:324-330` → `use-auth.ts:36-37` clears both drafts | slip | If any field is filled, `confirm({destructive})` first. |
| A4 | After editing from review, you tap Continue through every step | `onEdit={setStep}` (`index.tsx:476`, `volunteer.tsx:419`); `advance()` is `step+1` (`:207`) | exec | Add a `returnToReview` flag: `advance()` validates the step, jumps back to review, and the button reads "Back to review". |
| A5 | A failed status check silently sends a signed-in user to login | `app/index.tsx:97-99` handles any `isError` (offline, 500) as logged out; the screen is blank while the session check runs (`:141`) | eval | Go to login only on 401/403. Otherwise show `ErrorState` "Couldn't reach Nabhya" with Retry. Spinner until a route is chosen. |
| A6 | The password rule is only a placeholder | `signup.tsx:116` | exec | Pass it as `hint` on the `FormField`. |

### Volunteer
| # | Problem | Evidence | Diag | Fix |
|---|---|---|---|---|
| V1 | Failure copy points to "My Donations", which doesn't exist and has no retry [also in app-audit B12] | `donate-sheet.tsx:224,236`; the screen is "Your giving" (`donations.tsx:53`), Profile says "Donations", Activity says "Giving" | mistake | One name everywhere. Failure: "Nothing was charged. Tap Donate to try again." |
| V2 | The guest donation fields can't be reached; the sheet hand-rolls controls | `ngos/[id].tsx:168` sends guests to login, yet `donate-sheet.tsx:321-345` has guest fields. Hand-rolled checkbox (`:358-392`), raw `borderRadius: 12` (`:156,287`), `primary.main` as a border, `error.main` as text (`:396`), ₹0 allowed, stale amount after clearing (`:312-316`) | exec | Allow guest checkout or delete the guest fields. Use `ui/checkbox`, `ChoiceChips`, `FieldError`. Disable Donate until the amount is valid. |
| V3 | The same status gets different words | Profile says "Under review" even when rejected (`profile.tsx:263-267`) while its banner says "needs another look" (`:191`). A pledge is "Received" (`needs/[id].tsx:228`) vs "Completed" (`activity.tsx:116`, `donations.tsx:139`). Pledge / Offer / Claim for one act; "I'd like this" (`needs/[id].tsx:161`) vs "Claim this" (`card-cta.tsx:45`) | eval | One status-label map in `status-pill.tsx`, a rejected branch on the Profile row, one verb per action. |
| V4 | The withdraw rule and spinner disagree between screens | `donations.tsx:164` allows withdraw for PENDING only, `needs/[id].tsx:137` also for ACCEPTED; shared `loading` (`donations.tsx:169`) spins every row | slip | Same rule on both. Spinner only when `withdraw.variables?.needId === id`. Button sized to its label. |
| V5 | Activity breaks on one failure; rows aren't actionable | `activity.tsx:99`: any one source failing replaces everything. Pledge and alert rows have no `href` (`:104-125,189-198`). Notifications are duplicated as a Profile row (`profile.tsx:272-276`). "Mark read" is caption-sized (`:234-243`) | eval | Show what loaded, plus a `Banner` naming the failed source. Route rows (`notificationDestination`). Drop the Profile Notifications row. 44pt target. |
| V6 | Unverified volunteers aren't warned before applying or pledging | `events/[id].tsx:79-91`, `needs/[id].tsx:74-86` check only sign-in and role | mistake | A one-line `Banner` with "Verify now" in the apply and pledge sheets when not VERIFIED. |

### NGO
| # | Problem | Evidence | Diag | Fix |
|---|---|---|---|---|
| N1 | Attendance and certificate controls ignore team role [also in app-audit B5] | `AttendanceControls` (`applicants-sheet.tsx:425-697`) never checks `people.attendance` / `certs.issue` / `certs.revoke`; it uses `useMyTeamRole`, not `useOrgAccess`, so suspension is missed too | eval | `access.blocked(...)`: a disabled control plus the reason sentence (`use-org-access.ts:22-26`). |
| N2 | Publishing from the composer gives no success feedback | `post-composer.tsx:470-486,550,587,606,628`: `onSuccess` → `finish()` → `onClose()`, no toast. This is the exact case named in AGENTS.md's "Telling the person what happened" | eval | A typed success toast ("Need published - it's on the feed.") with a View action. |
| N3 | Ownership transfer starts on a single tap of a card | `(ngo)/team.tsx:1041-1049` → `select()` calls `request.mutate` straight away (`:965-980`) | slip | A `SheetOption` pick-one list plus a footer "Send transfer request to {name}" behind `confirm`. |
| N4 | Tabular records are drawn as cards with chip filters | `(ngo)/events.tsx:167-182,255`; `donations.tsx:133-167` (no sort or export); `needs.tsx:133,213`; `announcements.tsx:119,181`; `reviews.tsx:151,200`; Team has a chip row plus a separate switch (`team.tsx:143-154,180-187`) | exec | A shared `DataTable` on desktop (sortable, one status `Select`, row actions); cards on phones. |
| N5 | The dashboard's "applicants to review" link lands on the unfiltered list | `(ngo)/index.tsx:212` → `/(ngo)/events`; the same for pledges (`:221`); "Waiting on you" repeats the count (`:240-244`) | exec | Go to events with a `pending` filter, or straight to `?review=<id>` when only one event is pending. Drop the duplicate metric. |

### Admin console
| # | Problem | Evidence | Diag | Fix |
|---|---|---|---|---|
| AD1 | A selection survives a sort change and single actions, so bulk acts on rows you can't see | `queue.tsx:142,149` (`onSortChange={setSort}`) vs `clearSelection()` on the filter selects (`:416,426`); a single approve (`:236-245`) leaves the id selected | slip | Clear the selection on sort; remove the id after a single review. |
| AD2 | A partial bulk failure is a count, not a list | `queue.tsx:505-516` drops `failed[].reason`; `:284` clears the selection, including the failures | eval | Keep the failed rows ticked and show each one's reason. |
| AD3 | A failed reject wipes the remarks | `reject-documents-sheet.tsx:53-54` clears before the mutation resolves | slip | Clear only on success. |
| AD4 | Approve can fire twice | Row buttons (`queue.tsx:360-374`) aren't disabled while pending | slip | Track the pending id and disable that row. |
| AD5 | Every sort or filter change replaces the table with a spinner | No `keepPreviousData` in the list hooks (only `use-admin.ts:32,47`); `console-list.tsx:81-83` returns `LoadingState` | eval | `placeholderData: keepPreviousData`, dimming the old rows. |
| AD6 | The bulk bar scrolls away | `BulkBar` sits in the page flow (`queue.tsx:437-450`) | exec | Show it in the sticky command bar while `count > 0`. |
| AD7 | The dashboard tile count ≠ the list it opens | The tile counts pending + under review (`index.tsx:118-122`); NGOs defaults to PENDING and reads no params (`organizations.tsx:63`) | eval | Add an "Awaiting" filter as the default and pass it through the URL. |
| AD8 | Filters, sort and search are lost on reload | All in `useState` (`queue.tsx:104,142`, `organizations.tsx:63-71`, `volunteers.tsx:71-77`, `audit.tsx:51-56`) | - | Move them to `router.setParams` / `useLocalSearchParams`. |
| AD9 | No workflow for working down a list | No "next" after a decision; no keyboard shortcuts (only Escape in `select-menu.tsx:67`); the queue defaults to newest first (`queue.tsx:142`) | exec | "Approve and next", J/K/A/R keys, oldest first by default (as `organizations.tsx:67-70` already does). |
| AD10 | Documents come last in the org dossier | `org-detail-sheet.tsx:396-433`: after Timeline and Posts, against its own header comment | exec | Move Documents to right after the facts. |

---

## P2 - polish

**Auth & onboarding**
- Two Back controls on every wizard step: the header chevron (`wizard.tsx:269-293`) and the footer "Back" (`:365-374`). Keep one.
- Help text repeated:
  - The causes step's caption duplicates its footer note (`volunteer.tsx:563-564` / `:365-368`; `index.tsx:729-730` / `:442-445`).
  - Volunteer review stacks a lede, a caption and an aside.
- The spinner uses `primary.main` as ink (`index.tsx:142`); use `primary.ink`.
- Raw hex in `auth-split-layout.tsx:15,73,80,91`, plus a `letterSpacing` override on `H1`. The dark-mode brand bar blends into `background.warm`.
- The "Coordinates" review row (`index.tsx:914`, `volunteer.tsx:634`) is developer wording; say "Location pin".
- `success.tsx` is never reached and contradicts the wizard completion screens. Delete it and its `Stack.Screen` (`_layout.tsx:71`).
- "Team size / Founded in" is a hand-built row (`index.tsx:811`); use `FieldPair tight`.
- Logo and banner previews aren't persisted. After the app is killed, review says "Not added" without saying why.

**Volunteer**
- The search back button is narrowed to 24pt (`search.tsx:347`), against the 40pt rule; the recent-search remove buttons are 32pt.
- Raw hex/`rgba` in `feed-media.tsx:315-863` (acceptable over media, but tokenise it). `profile.tsx:461` should use `success.contrast`. `status-pill.tsx:54` overrides `fontSize`.
- `saved.tsx:94-100` passes inline arrows to the memoised `FeedCard`, against the root AGENTS.md rule. "Back to feed" uses `router.back()`, which does nothing on a deep link.
- The feed card's Follow vanishes with no toast (`card-header.tsx:168`); add "Following X" with Undo.
- "Saved NGOs" vs "Saved posts" both use "save" with bookmark icons (`profile.tsx:234-244`); rename the NGO one "Shortlist" or merge them.
- `FeedEmpty`'s `link()` (`(volunteer)/index.tsx:423-429`) is a bare `Label` with no `focusable`; use `Button variant="quiet"`.

**NGO**
- Hand-rolled duplicates:
  - `team.tsx:1110` `SwitchRow` repeats `composer/switch-row.tsx`.
  - `team.tsx:268` `SectionHeading` repeats `sidebar.tsx:252` and differs from `SectionTitle`.
  - `index.tsx:541` draws its chevron with rotated borders.
- Raw hex in `composer/media-tiles.tsx:120,143,197,216`, `composer/switch-row.tsx:85`, `(ngo)/feed.tsx:568`. `fontSize` 10/9/17 in `media-tiles.tsx:120`, `composer/tools.tsx:184`, `post-composer.tsx:759`.
- The Team page is too heavy with help: an always-on role guide, a "Confirm transfer" token card for every admin (`team.tsx:253,1060+`) and an invites explainer. Collapse the guide, and show the confirm card only while a transfer is pending.
- The comment at `(ngo)/index.tsx:157-160` says only Post is gated, but `needBlocked = postBlocked` (`:132`).
- "Attended ✓" is a button that relabels itself (`applicants-sheet.tsx:592`), with no feedback when undone; use a checkbox (it also fits the bulk table).

**Admin console**
- Status words differ: the queue says "Awaiting review / Approved" (`queue.tsx:63-64`), the pills say "Pending / Verified", NGOs says "Pending / In review".
- Nav order differs between the rail (`nav-items.ts:83-113`) and the phone tabs (`_layout.tsx:87-131`). Queue has no pending badge, though the mechanism exists (`nav-items.ts:41`).
- Empty states:
  - None of them pass `action` to clear filters.
  - `volunteers.tsx:230-236` shows "No volunteers yet" above "No volunteers match these filters".
  - `audit.tsx:194-198` says "Nothing recorded" when only a filter is set.
- Charts:
  - `TrendChart` has one focusable `Pressable` per day, so 90 tab stops (`charts.tsx:401-413`), and focus doesn't move the crosshair.
  - An all-zero window draws a flat line with no "No signups" note.
  - Platform activity has an error state with no retry (`index.tsx:205`).
- Tables:
  - Openable rows have no `accessibilityLabel` or resting click cue (`data-table.tsx:414-418`).
  - Unsorted sortable headers look non-sortable (`:337`).
  - "Status" header sits over the action buttons (`queue.tsx:353`).
  - Audit "On" is a truncated UUID and not a link (`audit.tsx:123-126`).
- On a phone the cards have no tick, so there's no bulk action. `SelectMenu` has no arrow-key navigation and doesn't return focus after Escape.
- Stale comment: `_layout.tsx:44-47` describes a 1040 cap that `list-chrome.tsx` removed.

---

## Cross-cutting patterns

These show up in every area. Fixing each once removes many of the findings above.

1. **Irreversible actions without `confirm` or Undo:** role select, wizard sign-out, applicant reject, ownership transfer. AGENTS.md already has the rule; enforce it.
2. **Mutations that finish silently or with the wrong message:** composer publish, the feed-card follow, the admin under-review toast. Every mutation that closes something needs a typed toast.
3. **Status vocabulary drift:** volunteer pledges and verification, admin queue vs pills. Put one label map in `status-pill.tsx` and use it everywhere.
4. **Card lists where the job is tabular:** NGO events, donations, applicants, team. Admin already has `data-table.tsx`; reuse it for the NGO side on desktop.
5. **Off-token styling:** raw hex, `fontSize` overrides, `primary.main`/`error.main` used as ink, hand-rolled checkbox / switch-row / section heading. A Biome or grep check for `#[0-9a-f]{3,6}` and `fontSize:` outside `theme/` would catch new ones.
6. **Pending state shared across rows:** donations withdraw, applicants `busy`, admin approve. Key the pending state by row id.

## Quick wins (under an hour each)

1. Fix the admin under-review toast (AD-P0-1).
2. Add success toasts to the four composer `onSuccess` paths (N2).
3. Add a Follow button to `ngos/[id].tsx` (V-P0-1).
4. Rename `(volunteer)/events.tsx` to remove the `/events` collision, and add a Profile → Applications row (V-P0-2).
5. Wrap applicant Reject, ownership transfer, role select and wizard sign-out in `confirm()`.
6. Move the password rule to `hint`; clear remarks only on success; clear the selection on sort change.
7. Add `keepPreviousData` to the four paged admin hooks.
8. Replace "My Donations" with one consistent name.

## Verification checklist

- [ ] Task clarity: each screen has one obvious primary CTA (NGO page: Follow + Donate)
- [ ] IA: applications, certificates and donations are each reachable from Profile; no duplicate routes
- [ ] Feedback: every mutation shows typed success or error; no raw developer errors
- [ ] States: loading keeps the layout (no spinner swaps on refilter); empty states offer a next step; errors offer retry; role-blocked controls say why
- [ ] Consistency: one status vocabulary; one verb per action; no hand-rolled duplicates of `components/ui`
- [ ] Affordance: 44pt targets; icon-only controls labelled; openable rows look openable
- [ ] Errors: irreversible actions confirmed or undoable; input kept on failure
- [ ] Cognitive load: one help layer per step; Team page guide collapsed
- [ ] Tokens: no raw hex / `fontSize` outside the theme; `.ink` for text, `.main` for fills
