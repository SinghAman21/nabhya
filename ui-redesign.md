# UI redesign plan

Where the redesign is, what is next, and which files each step touches.

**Rule:** work by screen *shape*, not by user role. There are 38 screens and 19 of
them are the same screen (header, filters, list, empty state). Redesigning the
shape once moves all three roles at once; redesigning "the volunteer app" builds
that shape three times and it drifts three ways.

Design rules (colour, type ramp, accessibility, focus rings) live in
`apps/native/AGENTS.md` → Styling. Read that before picking a colour.

---

## Step 0 — Foundation and shell ✅ done

| What | File |
|---|---|
| Colour tokens, inks, elevation | `src/constants/design-system.ts` |
| Dark-aware Tailwind layer | `src/global.css`, `tailwind.config.js` |
| Type ramp | `src/components/ui/typography.tsx` |
| Primitives: `Screen` `Surface` `ListGroup` `ListRow` `MetricRow` `SectionTitle` `Banner` `FilterChips` | `src/components/screen-shell.tsx` |
| Collapsible sidebar, grouped nav | `src/components/sidebar.tsx` |
| Shared bottom bar | `src/components/tab-bar.tsx` |
| Keyboard focus ring | `src/lib/focus.ts` + `src/global.css` |
| Reference screens | `src/app/(ngo)/index.tsx`, `src/app/(volunteer)/index.tsx` |

27 screens were swept onto `Screen`. Two were skipped and still hardcode their
own container: `src/app/events/[id].tsx`, `src/app/ngos/[id].tsx` (step 3).

---

## Volunteer information architecture ✅ feed merged

Four tabs became three. Two of the old tabs were *kinds of record* — the NGO's
taxonomy leaking into the volunteer's navigation. A volunteer should not have to
know whether the thing they want is a "need" or an "event" before they can find it.

| Tab | Route | Holds | State |
|---|---|---|---|
| Home | `(volunteer)/index.tsx` | one feed: needs, offers, events, NGO updates via `GET /api/feed` | ✅ built |
| Activity | `(volunteer)/activity.tsx` | pledges, donations, applications, certificates, alerts — one timeline | ✅ built |
| Profile | `(volunteer)/profile.tsx` | identity, verification, saved, impact, sign out | needs a Settings group |

Still routable, no longer tabs (`href: null`), linked from Activity:
`(volunteer)/donations.tsx`, `(volunteer)/events.tsx`.

**Desktop chrome follows the depth of the role.** Volunteer gets a top bar, not a
sidebar: three destinations do not need a 260px rail, and the rail takes width from
the feed grid — the only thing on the screen that scales with it. `(ngo)` (nine
grouped items) and `(admin)` (five plus tables) keep the sidebar. This is not an
inconsistency anyone experiences; no one person sees both. It is also the layout
the SEO web app will need, since public pages cannot sit inside an app sidebar.

| Piece | File |
|---|---|
| Top bar, activity button, account menu, search | `src/components/top-bar.tsx` |
| Desktop right rail | `src/components/discover-rail.tsx` |
| Search term, owned outside the screen | `src/store/feed-store.ts` |

**No nav links in the bar.** The three destinations are not peers: Discover *is*
the app, Activity is your record of it, Profile is you. So the wordmark is home,
search takes the middle, and the two personal surfaces sit right, where account
controls are looked for. The Activity control is **labelled**, not a bare bell — a
bell promises notifications and this holds pledges, donations, applications and
certificates too — and it is the only notifications entry on desktop, since a bell
popover beside it would be a second door into a page that already exists.

**Two columns, not three.** Feed left, rail right at 320. A third column is not
built because there is no third thing: a column looking for content fills up with
filler widgets. If depth ever arrives — NGOs you follow, saved searches, cities —
the third column is a **left** nav rail for it, not another widget stack.

Rail sections are **server-filtered**, not a slice of the page already on screen:
`publicNeedQuerySchema` takes `urgency`, `publicEventQuerySchema` takes `when`.

- *Urgent now* — `urgency: HIGH`.
- *Happening soon* — upcoming events. This is also how events reach Discover at
  all without a merged cursor, which is the interim answer the feed merge needed.
- *Not built: impact articles.* Announcements are the closest thing the schema has
  to a story, but they are exposed per organisation only
  (`GET /organizations/:id/announcements`). A cross-org "Latest updates" rail needs
  a public `GET /api/announcements` joined to verified orgs — small, and worth it.
- *Not built: trending.* There is no metric for it anywhere in the schema — no view
  counts, no pledge velocity, no follower counts. It has to be defined server-side
  first (pledges in the last 7 days, say). Inventing it client-side would be a
  ranked list of nothing.

Search exists once per platform — top bar on desktop, in-page on mobile — both
reading `feed-store`, so a filtered feed can never disagree with the visible input.
The account menu (profile / theme / sign out) is where settings live on desktop and
retires the floating theme button for this role; mobile still has the button until
Profile gets a Settings group.

**Location scope.** Item donation and volunteering are physically local — nobody
hands 20 blankets to an NGO 900km away — so the feed is city-scoped by default and
nationwide on request. Never scoped silently: the city is always on screen and
"All India" is always one tap away. The default comes from the **profile city**
(set at onboarding), not GPS: no permission prompt, no `expo-location`, and a
better answer, since people know where they can actually turn up. `city` is a real
filter on both the needs and events queries. `feed-store` keeps a `cityTouched`
flag so the default applies until the user chooses and their choice then stands.

*Data problem this exposes:* `organization_needs.city` is free text, so "Mumbai",
"mumbai" and "Bombay" are three cities to the query. The metro list in
`city-picker.tsx` is a stopgap; the fix is a canonical city table or a normalising
write path.

**Exploration is by intent, not taxonomy.** `Everything / Urgent / Needed / Free to
take` plus the city control, replacing `All / Needed / Free to take`. Urgency and
location are what a volunteer decides on; WANT-vs-OFFER is the NGO's vocabulary.
The desktop page title and result count are gone — the top bar already carries the
wordmark and search, so a heading would be chrome restating it. *Wanted next:* a
"For you" intent matching the volunteer's own interest categories — `user_categories`
already exists, but `publicNeedQuerySchema` has no `categoryId`, so it needs a join
through `organization_categories` server-side.

**Density: minimal structure, dense content.** One surface language, hairlines, one
accent — a cluttered NGO platform reads as a scam, and trust is the core problem.
But pack the card: the need card carries nine facts on one surface. Never
icon-only; always label. Status in words ("Waiting for the NGO to review"), not a
grey dot — the biggest India-specific win available, and free. Card padding is 16
and section gaps 24, tightened from 20/32, because vertical space is the scarce
resource on a 360dp screen. Rejected from the dense playbook: gradient banners,
badge spam, promo carousels, icon shortcut grids.

Not addressed and bigger than any of this: **there is no i18n.** If tier-2 NGO
admins are a real audience, Hindi/Marathi copy matters more than any layout choice
here. Needs its own scope.

**Feed (built).** `GET /api/feed` is the one-cursor merged list the notes below
asked for: a SQL `UNION ALL` over needs, upcoming events and announcements, ranked
server-side. Lenses are `For you` (interest categories → city → urgency),
`Following` (bookmarks), `Trending` (7-day pledges/applications), `Urgent`; the
cause row is the platform's verticals; the city control is unchanged. Cards share
one anatomy — org · eyebrow (kind, in words) · title · facts · one action — in
`components/feed/feed-card.tsx`; infinite scroll via `hooks/use-feed.ts`. The tab
is now *Home*.

*Still open on the feed:* logos (cards show an initial; `organization.logo` is a
storage key needing a signed URL), a `For you` that is empty for a volunteer with
no categories (falls back to city + urgency, fine), and moving `Trending` off a
7-day pledge count once there is a better signal.

**Open decisions**
- **Impact does not belong in the feed.** Requests, offers and events share an
  action grammar — commit to a thing, with a quantity or a slot and a deadline.
  Impact is read-only, which breaks both ranking (a story against a need closing in
  six hours) and the feed's predictability. Impact belongs on the NGO profile (for
  trust) and in Activity (as reward).
- ~~Feed merge needs a server change.~~ Done: `GET /api/feed`, see above.
- Activity currently merges the first page of five endpoints client-side. Fine for
  one volunteer's volumes, wrong in general — same `Paginated<T>` gap as step 1.
- "Redeems" is read as claiming an `OFFER` need (already in the schema). If it means
  points or rewards, that is a new domain with no tables and needs its own scope.

---

## Step 1 — The list pattern (19 screens) ✅ done (Sept 2026 polish pass)

Every list screen now pages for real (`usePagedQuery`/`PagedList` in `components/paged-list.tsx`, `LoadMoreFooter`, admin `use-admin-lists.ts`), has EmptyState/LoadingState/ErrorState with retry and pull-to-refresh, uses ListGroup/Surface rows with StatusPill, and pushed pages use `ScreenHeader back`. New shared pieces: `form-field.tsx` (Field/FieldError), `choice-chips.tsx`, `initial-avatar.tsx`, `text-action.tsx`, `appearance-row.tsx` (theme setting; the floating ThemeToggle is gone), admin `list-chrome.tsx` / `sheet-parts.tsx` / `audit-row.tsx`. Detail pages (event, NGO) pin the primary action in a bottom bar; the NGO page wires DonateSheet (Razorpay via dev client).

Biggest multiplier in the codebase. Build one composition, prove it on one
screen, then sweep the rest.

**Build:** a `ListScreen` shape in `screen-shell.tsx` (Screen + ScreenHeader +
FilterChips + rows + empty/error/loading) and **pagination**. Every list endpoint
returns `Paginated<T>` and every screen below renders page 1 only — at real data
volume the UI is lying. Add a `useInfinite*` wrapper next to the existing hooks in
`src/hooks/`.

**Reference screen first:** `(volunteer)/events` or `(ngo)/needs`. Sign off, then sweep.

| Route | File |
|---|---|
| `/(volunteer)` | `src/app/(volunteer)/index.tsx` ✅ done |
| `/(volunteer)/donations` | `src/app/(volunteer)/donations.tsx` |
| `/(volunteer)/events` | `src/app/(volunteer)/events.tsx` |
| `/(ngo)/needs` | `src/app/(ngo)/needs.tsx` |
| `/(ngo)/events` | `src/app/(ngo)/events.tsx` |
| `/(ngo)/announcements` | `src/app/(ngo)/announcements.tsx` |
| `/(ngo)/reviews` | `src/app/(ngo)/reviews.tsx` |
| `/(ngo)/reports` | `src/app/(ngo)/reports.tsx` |
| `/(ngo)/donations` | `src/app/(ngo)/donations.tsx` |
| `/(ngo)/team` | `src/app/(ngo)/team.tsx` |
| `/(admin)/organizations` | `src/app/(admin)/organizations.tsx` |
| `/(admin)/volunteers` | `src/app/(admin)/volunteers.tsx` |
| `/(admin)/queue` | `src/app/(admin)/queue.tsx` |
| `/(admin)/audit` | `src/app/(admin)/audit.tsx` |
| `/ngos` | `src/app/ngos/index.tsx` |
| `/events` | `src/app/events/index.tsx` |
| `/certificates` | `src/app/certificates/index.tsx` |
| `/bookmarks` | `src/app/bookmarks.tsx` |
| `/notifications` | `src/app/notifications.tsx` |

---

## Step 2 — Sheets ✅ done (14 of 14 on one component)

Every decision in the product happens in a sheet, and every sheet is now
`src/components/ui/sheet.tsx`. On native it is `@gorhom/bottom-sheet`: pan to
dismiss, detents (`detents={["60%", "92%"]}` for list bodies), a body that drags
the sheet until it is fully open and then scrolls, keyboard pushes the sheet up,
and the title row is drawn as the sheet *handle* so it stays pinned while the body
scrolls under it (a hairline appears once it does). The footer is pinned too, above
the keyboard and the home indicator. On web the same props render a `Modal`:
slide-up on a phone-width window, centred dialog on desktop. `Input` swaps to
gorhom's text input inside a sheet on its own; `SheetFlatList` is the list body;
`SheetOption` is the pick-one row (city, cause).

Ported: pledge, applicants, pledges, donate, review, event form, need form, admin
broadcast / user detail / org detail, plus the inline modals in `(ngo)/announcements`,
`(ngo)/reports`, `(ngo)/team` and the receipt in `(volunteer)/donations`. No screen
imports `Modal` any more.

Also landed (Sept 2026 polish passes): a hand-drawn `AppTabBar` (labels no longer
clip; `tabBar={renderTabBar}` in all three layouts), explicit line heights across
the type ramp, `BackButton` as a 40pt chevron laid out inline by `ScreenHeader back`
(every pushed page uses it; the two hero pages use the real safe-area inset instead
of a guessed 32pt), `Button` on `Label` with fixed min heights, and edge-to-edge chip
rows. Home's header is two rows — city title + search button, then lens chips with a
filter button that opens the cause sheet — and search is its own route
(`app/search.tsx`: example searches and browse links before typing; All / NGOs / Needs /
Events / Updates tabs once a term is in — `GET /api/feed` gained a `kind` filter for it).
The volunteer Profile was rebuilt on `ListGroup`/`MetricRow`/`Banner` with an Appearance
row (sheet: System / Light / Dark) replacing the floating `ThemeToggle` for volunteers;
NGO and admin layouts still float it. The bell is gone
from Home; Activity is the inbox. Demo content: `pnpm --filter @nabhya/db db:seed:demo`.

Still here: replace the ~30 `Alert.alert` calls with a toast. `Alert.alert` is a
blocking OS modal on native and degrades badly on web. And `PledgeSheet` returns
`null` when it has no need, so it unmounts before the close animation; keep it
mounted and drive `visible` instead.
---

## Step 3 — Detail pages and forms

Public, shareable, trust-carrying. An NGO profile is what convinces a stranger
the org is real, so this is where the verification block and the progress
primitive earn their keep.

| Route | File | Note |
|---|---|---|
| `/ngos/[id]` | `src/app/ngos/[id].tsx` | still on the old container |
| `/events/[id]` | `src/app/events/[id].tsx` | still on the old container |
| `/certificates/[code]` | `src/app/certificates/[code].tsx` | public verification page |

Forms, highest stakes first — the NGO wizard is where an NGO is won or lost:

| Route | File |
|---|---|
| `/(onboarding)` | `src/app/(onboarding)/index.tsx` (819 lines, 5 steps) |
| `/(onboarding)/volunteer` | `src/app/(onboarding)/volunteer.tsx` |
| `/verify-identity` | `src/app/verify-identity.tsx` |
| `/(ngo)/edit` | `src/app/(ngo)/edit.tsx` |
| `/edit-profile` | `src/app/edit-profile.tsx` |
| `/(auth)/login`, `/(auth)/signup` | `src/app/(auth)/` |

---

## Step 4 — Per role, in this order

Only after the shared shapes are done. Each is now polish, not reconstruction.

1. **Volunteer** — public-facing, the growth surface, what a stranger judges you
   on. `(volunteer)/profile.tsx`, `impact.tsx`.
2. **NGO** — the workhorse. Dashboard is done; `(ngo)/profile.tsx` and
   `(ngo)/verification.tsx` are not.
3. **Superadmin** — last, and deliberately: it is internal, and it needs a
   different structural answer rather than a restyle. `(admin)/*` wants a real
   data table with sorting and bulk actions on desktop web, which is a bigger job
   than the list pattern and should not block the other two.

---

## Not in any step yet

- Skeletons instead of spinners; shared-element card → detail transition.
- `apps/web` (Next.js) for SEO-critical public pages — see `apps/web/AGENTS.md`.
- `useMedia` keys desktop off `Platform.OS === "web"`, so a native tablet gets
  the phone layout. Real breakpoints belong in step 4.
