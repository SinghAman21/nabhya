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

*Data problem this exposes:* `needs.city` is free text, so "Mumbai",
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

*Still open on the feed:* a `For you` that is empty for a volunteer with
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

| Route | File | State |
|---|---|---|
| `/(onboarding)` | `src/app/(onboarding)/index.tsx` | ✅ rebuilt (see below) |
| `/(onboarding)/volunteer` | `src/app/(onboarding)/volunteer.tsx` | ✅ rebuilt |
| `/role-select` | `src/app/role-select.tsx` | ✅ pass |
| `/verify-identity` | `src/app/verify-identity.tsx` | on the shared shapes |
| `/(ngo)/edit` | `src/app/(ngo)/edit.tsx` | |
| `/edit-profile` | `src/app/edit-profile.tsx` | |
| `/(auth)/login`, `/(auth)/signup` | `src/app/(auth)/` | |

---

## Onboarding, both verticals ✅ done

The two wizards were **two different products** built from the same brief: the
NGO one kept its draft in `auth-store` (persisted and never cleared, so a
finished NGO carried its own registration number in secure storage forever),
the volunteer one in `useState` (backgrounding the app to look up a phone number
lost the form). One had a tappable review list, the other a read-only table.
One had a dead step. Neither was pinned, so on a 360dp phone the Continue
button was below the fold on the longest step in the product.

They are now one flow with two audiences, sharing `components/onboarding/*`,
`store/onboarding-store.ts` and `lib/cities.ts`. The design rules are in
`apps/native/AGENTS.md` → Onboarding. What is worth knowing here is what was
*missing* rather than what was ugly:

**Three fields the schema had and the product never asked for.** Each one is a
feature that silently did nothing:

- **`organization_categories`** is what the feed's `For you` lens joins through.
  Nothing asked an NGO for a single cause until they found `(ngo)/edit`, so an
  NGO that signed up and stopped could not be matched to any volunteer's
  interests. It is now step 3 of 5, and it replaced the step that was a
  read-only list of documents you could not yet upload.
- **`organizations.logo` / `users.profile_image`.** This is why every feed card,
  applicant row and NGO header in the app draws an initial: the only screens
  that could set an image were the two edit forms, reached from a profile nobody
  visits on day one.
- **`latitude` / `longitude`** on both tables. `GET /organizations/nearby`
  exists, ranks on them, and had almost nothing to rank — the only way to record
  coordinates was a map picker on an edit screen. Location is now offered once,
  with the reason on screen, and the coordinates are kept even when reverse
  geocoding fails (it is not available on every platform).

**The wizards no longer end in `router.replace`.** Both now end on a completion
screen, because that is the only moment either account reliably reads what is
left to do — documents for an NGO, identity verification for a volunteer —
and both of those are things the product cannot ask for later with any
authority. Each screen offers the action and a way past it.

**Feed cards can draw a logo now.** `FeedCard` passed `organization.logo`
straight to `<Image>`, and that field is a private storage **key** — so the card
drew an initial even for an NGO that had uploaded one. It resolves the key
through `useStoredImageUrl` like every other image in the app. Worth doing here
rather than later: onboarding is what makes the field non-empty in the first
place.

**"Use my current location" never worked on the web, and the reason was not
the code around it.** Both callers gated on
`Location.requestForegroundPermissionsAsync()`, and on the web that is answered
from `navigator.permissions.query` — a browser that has not been asked reports
`"prompt"`, which maps to `UNDETERMINED`, so `granted` is `false` and the button
failed instantly having never shown the browser's own dialog. On the web,
`getCurrentPosition` *is* the request. `lib/location.ts` now owns that
distinction for the wizards and the feed's city picker.

On top of that, reverse geocoding is not something to rely on: it does not exist
on the web at all and returns nothing on an Android without a working Play
Services geocoder. So `nearestCity()` resolves the coordinates against our own
city table (haversine, 120km cutoff) and the control produces a city anyway;
where the platform *does* name a place, its street line and pincode are dropped
into the NGO's address fields — empty ones only, never over something typed.

**Desktop stopped scrolling.** The form column went 560 → 720, fields pair with
`FieldPair`, and the review runs two columns (`ReviewGrid`), so a step fits a
laptop window. The body is still a `ScrollView`, because a short window or a
browser zoom must not become an unreachable Continue button — the trap this
whole redesign started from.

**The NGO also gets a banner**, alongside the logo, both optional and both
uploaded after creation for the org-scoping reason above. And the review step
lost "Not now — browse events first": an NGO that has filled in five steps is
not looking for the exit, and the row was one more thing between them and the
button they came for.

**Cities stopped multiplying.** `city` is free text on `needs`, `events`,
`organizations` and `users`, and every filter matches it exactly, so the two
wizards were the largest single source of "mumbai", "Bombay" and "  Pune".
`lib/cities.ts` now holds the list, the aliases and city → state, and the feed's
`city-picker.tsx` reads the same file and normalises what the OS geocoder hands
back. Still a stopgap: the fix is a canonical city table or a normalising write
path on the server.

**Server side** (`onboarding.service.ts`, `packages/shared/src/onboarding.ts`,
`volunteer.ts`): the org insert writes causes, logo and coordinates inside the
same transaction as the org and its owner-admin row; the volunteer update writes
the avatar and coordinates, and only overwrites an avatar when one was actually
sent. Two schema traps went with them — `phoneSchema` strips separators before
measuring length (the wizards' own placeholder, `+91 98765 43210`, is 16
characters and was rejected by the field that showed it), and `optionalCount`
treats a blank numeric input as absent rather than coercing it to `0`, which is
what made an *optional* "Founded in" fail with "Enter a valid year". Covered by
new cases in `apps/server/test/onboarding.spec.ts`.

One trap worth naming, since it cost a 400 in testing: the wizards post **raw
form values** and the server is the only normaliser. `optionalText` parses `""`
into `null`, and `null` is not valid *input* for it — so a client that posts its
own parsed payload is rejected with "expected string, received null". The
mutations are typed to the schemas' `z.input` side (`Complete*OnboardingPayload`)
to make that the only thing you can do, and the case is covered in
`onboarding.spec.ts`, because the service specs bypass the validation pipe.

**Sign-in and sign-up got the same treatment.** Errors were `Alert.alert` —
a blocking OS dialog you dismiss before you can see the field you got wrong, and
`window.alert` on the web. They are now inline above the button
(`components/auth-error.tsx`), and the copy for the failure that actually
happens does the thing an alert never could: Supabase cannot tell a wrong
password from a missing account (that distinction is an enumeration oracle), so
the message covers both and offers **Create an account**, because being on the
wrong form is the usual cause. Passwords gained a show/hide toggle in
`FormField` — a masked field with no reveal is the biggest cause of a sign-in
failure nobody can explain. `verify-identity` lost its two alerts the same way:
the failure stays on screen while the photo is retaken, and the success turns
the page into its own confirmation.

## The sweep after onboarding

**`Alert.alert` is gone from the app.** Thirty-odd call sites reported a failed
mutation with a blocking OS dialog — and on the web that meant `window.alert`
and `window.confirm`, the browser's own chrome, origin in the title bar, on the
two consoles (NGO and admin) that are web-first. `components/ui/overlay.tsx`
replaces both halves: a toast for "here is what happened", a confirm dialog the
app draws itself for "this cannot be undone". `lib/alert.ts` is deleted.

The interesting part is where the host lives. A sheet is a real `Modal` on both
platforms, so an overlay mounted in the root layout is drawn *underneath* any
open sheet — and half the callers act from inside one. So every host registers
itself and only the topmost renders: the sheet mounts its own while it is up,
the root resumes when it closes.

Three rules came out of doing it, and they are in `apps/native/AGENTS.md`
rather than re-decided per screen: a **form** error stays on the form, a
**result** is a toast, an **irreversible consequence** gets a confirmation
first. Two consequences worth naming: every `onSuccess: close` in the app was
a silent success — the sheet shut and nothing said the thing had saved, so each
one now says it. And unsaving an NGO gets an **Undo** toast rather than an "are
you sure", because a dialog in front of one reversible tap costs more than the
mistake does.

**The volunteer profile could not be scrolled on desktop.** Its desktop branch
was a plain `View` while the mobile branch had the `ScrollView` — the exact trap
the client guide already described, and which `(ngo)/profile.tsx` had already
been fixed for. On any window shorter than the page, the bottom third — sign
out, appearance, certificates — was drawn into `overflow: hidden` and could not
be reached at all. It is now one scroller for both platforms, varying only the
layout inside it. The volunteer home's discover rail had the sibling half of the
same bug: `position: sticky` with no scrolling ancestor, so it sized to its
content and clipped. It now stretches and scrolls itself, like the NGO feed's.

**Six pills and tiles on the feed card were hardcoded light-mode hexes.** Right
on white, wrong on a dark card, where they drew as bright blocks; and each
`textColor` was a `main`-grade colour on its own tint, the one combination the
colour rules single out as unreadable. All six now come from the token scales,
which meant adding a fifth tone — `accent`, violet — for "Story", a category
that is neither a status nor an action. Light mode is pixel-identical; dark mode
stopped being broken.

**Identity verification asks for one ID.** The chip row of five accepted types
was the first thing on the screen and read as a checklist of documents to
produce rather than a pick-one. It is the Aadhaar card, and the ID and selfie
cards sit side by side on desktop — stacked, the camera pushed step 1 a screen
away.

**Search remembers.** Recent terms sit above the examples, device-local, and a
term is only recorded when it is *committed* — the keyboard's Search key, or
opening a result — so the list holds words rather than the prefixes typed on the
way to them. On a phone the commonest search is one already made.

**Nine unused list hooks are gone**, each a single-page `useQuery` beside a
screen that already paged the same endpoint properly through `usePagedQuery`.
Keeping both meant the next screen could pick the half that only ever renders
page 1. The three long-red `uploads.spec.ts` assertions are green: the storage
keys grew a bucket prefix and a readable folder, the tests still asserted the
old two-segment layout, and the "forged key" case was failing on *malformed*
rather than on ownership — so it was testing nothing.

*Still open:* there is no server-side draft, so a wizard resumed on another
device starts empty; and `Alert.alert` is gone from onboarding but still lives
in ~30 other call sites waiting on a toast.

---

## The NGO surface — composer, feed, dashboard ✅ done

The NGO group had been swept onto the shared shapes in step 1, so what was left
was not a restyle. It was three things the sweep could not see:

**1. `POST /api/feed` had no client.** `PostComposerSheet` existed and *nothing
mounted it* — an NGO could read the feed forever and never write to it, which
makes the product somebody else's. Rebuilt as
`components/post-composer.tsx`:

- `PostComposer` — the form, on the shared `Sheet` (`wide` on desktop, 560
  rather than 480, because four attachment tiles do not fit a column dialog).
  Same `Field` / `ChoiceChips` / `useFieldInputStyle` recipe as the need and
  event sheets. The primary action is in the sheet's pinned `footer`, per the
  styling rule, and the sheet stays mounted so it does not vanish mid-close
  animation — the `PledgeSheet` bug noted in step 2, not repeated.
- `PostComposerBar` — the prompt row at the top of the feed list: avatar, an
  invitation, and shortcuts for photo/video, need update and event update. The
  shortcuts pre-set the tag, or open the picker in the same gesture.
- Three entry points, each for a reason: the bar (the invitation), a header
  button on desktop (a scrolled-away bar has no thumb corner to fall back on),
  a labelled floating button on mobile (the inverse).
- The tag row now carries all five `postTagSchema` values — `ANNOUNCEMENT` was
  simply missing — and each option's hint says what the tag *does to ranking*,
  because `URGENT` enters the Urgent lens of every volunteer in range.
- **A draft survives dismissal.** State clears on a successful publish and
  nowhere else, so a stray backdrop tap cannot destroy three paragraphs, and
  no "discard?" dialog is needed.

**2. Media was quietly broken.** `lib/feed-media.ts` is new and carries the
reasoning; the short version:

- `FeedService.create` derives `IMAGE` vs `VIDEO` **from the object key's file
  extension**. The old composer sent `media-${Date.now()}` when the picker
  reported no file name — which it does for a video on Android — so videos were
  stored as images and rendered as broken tiles in every feed. Extensions are
  now derived from the content type and appended.
- The old code coerced any unrecognised MIME type to `image/jpeg`. That signs a
  ticket for one type and PUTs another, so the upload 403s with nothing on
  screen. Unsupported files are now refused **by name, with the reason**.
- The 25 MB cap is checked before the bytes go out, not by
  `assertFeedMediaKeys` after a minute of phone upload.
- Uploads are sequential with real per-file progress over `XMLHttpRequest`
  (`fetch` reports none on either platform). Tiles show position, kind,
  duration, a fill bar, a tick or a failure marker.
- Retry re-uploads the whole set, and says so by resetting the tiles: intents
  mint a fresh folder per call and every key must share one, so a partial
  retry is not possible.

**3. Rows that lied, and columns with no measure.**

- `NgoRail`'s "New event" / "New need" rows navigated to the *list*. They now
  open the same form sheets their screens use.
- The dashboard's eleven-row "Manage" list repeated the desktop sidebar
  verbatim — the same menu twice on one screen, able to disagree. The list now
  holds **what the surrounding chrome does not**: two rows on desktop (nine are
  in the sidebar), seven on mobile (five are in the tab bar). Same principle,
  different output; not an inconsistency.
- The dashboard gained a `Create` row — post / need / event — because a
  dashboard that only reports is a wall the coordinator walks around.
- `(ngo)/_layout.tsx` caps desktop content at 1320 and the feed column at 660.
  Every `(ngo)` screen is `flex: 1`, so at 2560px the needs grid drew three
  cards a metre wide and reviews ran one line of prose across the desk. Capped
  once in the layout rather than twelve times in twelve screens.
- Own-post deletion (`DELETE /api/feed/:id`, also previously clientless) is an
  overflow control the card draws **only** when the caller passes `onDelete`,
  which the volunteer feed never does — so nothing changed for volunteers.

`useOrgNeeds` / `useOrgEvents` grew an `enabled` flag, matching
`useMyOrganization`: the composer is mounted for the life of two screens and
its reference picker must not cost two requests per page load.

### Second pass — web scrolling, and the composer as a canvas

**Nothing on `(ngo)` scrolled on web, and there were no scrollbars.** Two
independent causes, both now fixed and both written up in
`apps/native/AGENTS.md` → Scrolling on web:

- `showsVerticalScrollIndicator={false}`, which every screen passed, compiles
  to `scrollbar-width: none` on react-native-web. Chrome honours it as of 121.
  Replaced by `verticalScrollbar` from `lib/scroll.ts` — hidden on native,
  shown on web.
- `(ngo)/profile.tsx` had **no scroll container on desktop at all**: the mobile
  branch of its `isDesktop` ternary got a `ScrollView` and the desktop branch
  got a plain `View`, so five sections plus four document tiles were drawn into
  `overflow: hidden` and were unreachable. The `NgoRail` column had the same
  shape and now scrolls too. The desktop shell is pinned to `100dvh` with
  `minHeight: 0` on the content column, so no flex chain can starve a scroller
  again.

**The feed is one page, not a pinned header over a list.** Title, lenses and
the composer prompt moved into `ListHeaderComponent`, so the column scrolls as
one thing under one scrollbar. `Screen` runs edge to edge on that route, which
puts the scrollbar where a page's scrollbar belongs. Cards and header now share
one `GUTTER` constant — `FeedCard` carries its own `marginHorizontal`, so the
list adds none; that mismatch was the 12pt misalignment between the title and
the cards under it.

**The composer became a writing surface.** It was six stacked labelled `Field`s
with the text area below the fold — a form *about* a post. Now:

- Decisions sit in a pinned top action bar: close · Drafts · `#type ⌄` · Post.
- Tools sit in a pinned bottom bar: photos, video, reference, and the count.
- The middle is two borderless inputs and nothing else.
- The type and drafts pickers open **inline** above the writing area. A sheet
  over a sheet is a stack no phone back gesture unwinds predictably.
- `Sheet` gained `header`, which swaps the title row while keeping the grabber,
  the scroll hairline, the safe-area handling and the platform switch;
  `SheetChrome` is that shared shell and `SheetHeader` is now built on it.
- Types read as `#update` / `#event` / `#need` / `#announcement` / `#urgent`,
  and the tool bar's right-hand line says what the chosen one does.

**Drafts (`lib/post-drafts.ts`), local to the device.** Closing with something
written saves it; reopening lists them; publishing retires the slot. Media is
deliberately not part of a draft — a picked `file://` URI can be revoked the
moment the picker session ends, so a restored draft claiming four photos would
be four broken tiles. The size budget is the interesting bit: on native
`lib/storage` is `expo-secure-store`, capped at 2048 bytes per value against a
5000-character post, so writes evict oldest-first and `saveDrafts` reports what
actually survived instead of losing work quietly.

*Still not built: scheduling.* `posts` has no `scheduled_at` and nothing
publishes on a timer, so a schedule control could only pretend. It wants the
same schema change as server-side drafts, plus a cron target alongside
`POST /api/admin/events/close-finished`.

### Third pass — the regression, and the composer in our own language

**A `ScrollView` in a flex row ate the feed.** Converting the desktop rail from
a `View` to a `ScrollView` (so it could scroll independently) inherited
react-native-web's `flexGrow: 1`, which beats `width: 320` whenever the row has
spare space: the rail grew to ~700pt and the feed column collapsed to ~330pt
with truncated cards. Fixed-width flex columns now spell out
`flexGrow: 0, flexShrink: 0`, and the rail is `alignSelf: "stretch"` rather than
`position: sticky` — it is a sibling of the feed's scroll container, so there
was never anything for sticky to stick to. Written up in
`apps/native/AGENTS.md` → Scrolling on web.

**Scrollbars, app-wide.** `global.css` now zeroes
`::-webkit-scrollbar-button`: styling `::-webkit-scrollbar` at all opts Chrome
out of its overlay scrollbar and into the legacy one, complete with stepper
arrows at both ends, which is what was actually on screen. 8px, trackless, a
`--foreground`-alpha thumb that inverts with the theme, `min-height` on the
thumb so a long pane still has something grabbable. `verticalScrollbar` was
swept across all 21 remaining screens, not just `(ngo)`.

**The composer stopped imitating and started belonging.** Three bands, which
was the good idea worth keeping, but expressed as ours:

- Top band leads with the **org identity** — a post is the NGO speaking, not
  the person signed in, and that is the fact this product most needs visible —
  then the type and the close.
- The type is a **plain word in a dropdown**, not a hashtag chip. `#update`
  implied a topic system the product does not have. The dropdown is a list of
  rows with the *consequence* under each name, because the difference between
  Update and Urgent is not a label, it is who the post reaches, and a chip has
  nowhere to say that.
- **Post moved to the footer**, where this design system puts a primary action,
  instead of floating in the top bar. The bottom band is four tools, one
  reason-or-consequence line, the count, then Post.
- The feed's composer prompt dropped from three labelled shortcuts to one. At
  the ~330pt a feed column gets they had truncated to "Photo o…", "Need u…" —
  three controls nobody could read.

**Media constraints are stated where the files are.** `MEDIA_RULES` is built
from `MAX_FEED_MEDIA` and `MAX_FEED_MEDIA_BYTES` so the sentence on screen
cannot drift from what the API enforces; the header counts `n of 4` and turns
warning-toned at the cap; the tools go dead at the cap with the reason in both
the label and the note line; `selectionLimit` is the exact remaining room (it
was `Math.max(1, …)`, and `0` means *unlimited* to the OS picker, so the guard
is now an early return too).

### Fourth pass — the layout, properly

**Scrollbars: moved out of CSS entirely.** Two attempts in `global.css` (inside
`@layer base`, then outside it) both had no effect — raw `::-webkit-scrollbar`
selectors do not survive NativeWind's compilation of that stylesheet, so the app
kept Chrome's own arrowed Windows scrollbar throughout. Now injected at runtime
by `lib/web-styles.ts` from `ThemeProvider`, coloured from
`design-system.ts`. The sidebar and the desktop rail are explicitly bare —
they are chrome, and a thumb on each reads as three pages competing.

**The feed reads as a page, not three panels.**

- The lens row is **pinned**, with **New post in the same row**, over a
  hairline the cards pass under. Splitting them across a title row and a chip
  row spent 110pt of permanent chrome saying "Feed" beside a sidebar item that
  already says Feed, so the desktop title is gone; mobile keeps it (no sidebar
  to name the screen) and gets New post from the floating button.
- Only the middle column scrolls. The sidebar and the rail hold position, and
  the rail scrolls inside itself only when its own content overflows.
- Feed column 720, **rail 384** (320 looked starved next to the empty space),
  content cap raised 1320 → 1440.
- Padding pass: the composer prompt gets real top spacing, the list a
  `spacing[16]` tail so the last card clears the viewport edge.

**The rail has something in it.** It was three blocks and a lot of nothing for
an NGO with no pending decisions. It now ends with `UrgentNow` and
`HappeningSoon`, **exported from `discover-rail.tsx` and shared with the
volunteer rail** rather than reimplemented — an NGO wants that list for the same
reason a volunteer does, and it is how they find out somebody two districts over
needs what they have a surplus of. Both are server-filtered and render nothing
when empty, so the column never shows a bare heading.

**The type picker is the app's real `DropdownMenu`.** Hand-rolling it as an
inline panel was wrong twice over: `components/ui/dropdown-menu.tsx` already has
focus management, outside-press handling, keyboard navigation and
collision-aware placement, and a panel that shoves the writing area down is not
what "dropdown" means. Two details worth keeping:

- `Sheet` gained `portalHost`. Menus portal to the root `PortalHost`, which on
  native sits *below* the RN `Modal` the sheet is hosted in — so a menu opened
  from a sheet renders behind it. The sheet now hosts a named portal target of
  its own. On web the primitives are Radix and portal to `body`, already above
  the modal, so the host goes unused.
- The trigger is the primitive's own `Trigger` styled with tokens, not a chip
  passed through `asChild` (which clones the child and injects a ref our plain
  function component had none to forward), and it takes a **plain style
  object** — NativeWind's interop flattens `style` with an object spread, so a
  style *function* resolves to `{}` on native.

**The composer is a right-hand drawer now, and the type picker is inline.**

The dropdown was invisible rather than broken, and it resisted two fixes.
RNW hosts a `Modal` at `zIndex: 9999` and the menu portals to `document.body`.
A `style` z-index on `DropdownMenuContent` does nothing: the props spread lands
on an inner `Pressable` (a *child* of `DropdownMenu.Content`), RNW compiles it
to a class that loses to the `z-50` already on that node, and then
`@radix-ui/react-popper` reads the content's **computed** z-index and copies it
onto its own positioned wrapper as an inline style — pinning the menu at 50. A
`!important` rule on `[data-radix-popper-content-wrapper]` should outrank that
and did not, and which of the primitive's two builds Metro even resolves is not
determinable without running the bundler: the package's `exports` map has no
`browser` or `react-native` condition.

So: stop portalling. Two changes, both of which are better designs anyway.

- **The composer moved to `Drawer`.** Writing a post is a side task, not a
  page — on desktop the feed stays visible on the left while the panel docks
  right at 520 (`wide`, new). On a phone `Drawer` *is* a `Sheet`, so nothing
  changed there. The drawer owns its own header, so the custom action bar is
  gone and `Sheet`'s `header` and `portalHost` props went with it — the
  composer was their only caller.
- **The type is `ChoiceChips`, inline.** Five short words never needed a menu,
  it is the component the need and event forms already use for exactly this,
  it costs no layer, and it shows the chosen type's consequence underneath
  instead of hiding it behind a tap. The footer note stopped repeating that
  consequence and now only says why Post is off or why a tool is dead.

`sheet.tsx` carries the rule as a comment: do not put a portalling primitive
inside a sheet or a drawer.

**Closing pass.**

- **No focus ring on text fields.** The rule kept one on `:focus-visible`
  believing that meant keyboard-only. It does for buttons; for a text input the
  UA matches `:focus-visible` on a plain click too, so the ring fired every
  time. The caret is the indicator. Buttons and rows keep theirs.
- **`components/ui/tooltip.tsx`**, new: hover labels for the composer's tool
  bar, web-only, non-portalling (for the reason above), and explicitly *not* a
  substitute for a visible label anywhere outside a fixed toolbar. Every tool
  states its reason when disabled, in both the bubble and the a11y label.
- **The schedule control is present and inert**, by decision — the clock has a
  settled home in the bar and its tooltip answers "can I schedule?" better than
  its absence did, but nothing behind it works yet. It sits **beside Post**,
  grouped with its own tight gap: schedule and post are one decision in two
  halves, and loose in the row they read as the fifth and sixth of six equal
  things.
- **The feed's composer prompt stopped looking crude.** Four things were wrong
  with it and each had the same cause — treating a 700pt card like a 330pt one.
  The prompt was a 12px `Caption` adrift in a 40pt pill (now `Body` in 46pt,
  the size a real input would be); the three shortcuts were `flex: 1` and so
  stretched into what read as a segmented control (now compact and
  left-aligned, with the space to their right deliberate); the icons were bare
  tertiary glyphs (now in `primary.tint` wells with `primary.ink` glyphs, the
  same recipe as the dashboard's Create tiles, so the two surfaces that offer
  creation look related); and the divider stopped short of the card edges (now
  full-bleed, so the card reads as two bands rather than as a rule dropped in
  the middle).

### Next: real scheduling (and server-side drafts)

Both want the same schema change, and the client half is already shaped for it.

1. `packages/db/src/schema/feed.ts` — `scheduled_at` and `published_at`,
   nullable, on `posts`. Then `pnpm db:generate`; the committed migration is
   what the server test suite builds from, so drift fails tests.
2. `feed-ranking.service.ts` — the candidate pool must filter to published
   posts. **Without this a scheduled post appears in the feed the instant it is
   written**, which is the whole feature failing silently.
3. `packages/shared/src/feed.ts` — `createFeedPostSchema` gains an optional
   future-dated `scheduledAt`; `feed.service.ts` sets `published_at` to now or
   leaves it null.
4. `POST /api/admin/posts/publish-scheduled`, beside
   `POST /api/admin/events/close-finished`, and listed with it under
   **Deploying** in the root `AGENTS.md` — an unscheduled cron means posts that
   never publish.
5. Client: the clock's `onPress` opens `components/date-time-field.tsx` and
   passes `scheduledAt`. Nothing else in the composer moves.
6. Server integration tests for the endpoint and for the pool filter.

**The rail lost its Create group.** It was a fourth door onto acts already
reachable from the composer prompt, the header button, the floating button and
the dashboard's own Create row — two of which are on screen at the same time.
The rail is now: what is waiting on you, the numbers, then discovery.

**The composer prompt grew its quick-action bar back**, now that the feed column
is 720 rather than 330: photo/video, about-a-need, drafts, each opening the
composer already in that state. Labels shorten on a phone instead of
truncating.

**The composer got its padding back.** Borderless is not padding-less: zeroing
it outright sat the headline on the body's first line with the caret flush
against the gutter, which is what made it read as unstyled. Both inputs now have
vertical breathing room, one hairline between them carries the structure a label
would otherwise have to, and the desktop dialog went 560 → 620 because a writing
canvas is not a column of fields.

---

## Step 4 — Per role, in this order

Only after the shared shapes are done. Each is now polish, not reconstruction.

1. **Volunteer** — public-facing, the growth surface, what a stranger judges you
   on. `(volunteer)/profile.tsx`, `impact.tsx`.
2. **NGO** — the workhorse. Dashboard, feed and composer are done (see the
   section above); `(ngo)/profile.tsx` and `(ngo)/verification.tsx` are the
   remainder, and both are already on the shared shapes — what they want is a
   pass for content, not structure.
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
