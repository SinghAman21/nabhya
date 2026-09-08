# apps/native — Expo client agent guide

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before
writing any code. Do not work from memory — SDK 56 APIs differ from what you think
you know.

Repo-wide rules and context live in the root `AGENTS.md`. Expo SDK 56 + Expo Router
(file-based, typed routes, React Compiler on), React 19.2.3 / RN 0.85.3. **No
Playwright or browser automation** — there is no web target yet.

**Expo Go no longer works for this app.** `react-native-razorpay` (donation
checkout) is a real native module and does not run in Expo Go. Every
contributor needs a custom dev client: `npx expo prebuild` then
`npx expo run:android` / `run:ios` once, then `expo start --dev-client` for the
regular dev loop.

Web is the one exception: `donate-sheet.tsx` loads Razorpay's own
Checkout.js from their CDN on `Platform.OS === "web"` instead of the native
module, wrapped behind the same Promise-based `.open()` interface — so
donations work in the Expo web preview even though nothing else there needs
a dev client.

## Routing

- Gate is `src/app/index.tsx`: no email → `/(auth)/login`, no role → `/role-select`,
  NGO not onboarded → `/(onboarding)`, volunteer not onboarded →
  `/(onboarding)/volunteer`, else the role tab group. It reconciles the persisted
  store against `GET /api/onboarding/status` before routing, never after.
- Route groups: `(auth)`, `(onboarding)` (`index` = NGO wizard, `volunteer` =
  volunteer wizard), `(ngo)`, `(volunteer)`, `(admin)`, plus public `events/`,
  `ngos/`, `certificates/` stacks and shared screens (notifications, bookmarks,
  impact, edit-profile).
- **A screen outside a role group needs `withAppShell`.** The three role groups
  draw their desktop chrome in their layout, so the rail or top bar is free
  inside them. Everything on the root stack — the shared screens above, plus the
  three public stacks — has none, and without the wrapper those pages open on
  the web as bare content: no rail, no top bar, so following a sidebar link
  leaves the app. `components/app-shell.tsx` picks the chrome from the persisted
  role (rail for `organisation`/`superadmin`, top bar for `volunteer`, capped
  column for a signed-out visitor) and passes straight through on mobile, where
  a pushed page correctly has no tab bar. Apply it at the default export, not in
  the JSX: these screens return early for loading and error, and a wrapper in
  the markup has to be repeated in every branch. The rail's contents live in
  `components/nav-items.ts` so the layout and the shell cannot disagree.
- Guards in `(ngo)/_layout.tsx` and `(volunteer)/_layout.tsx` are **client-side
  only** — they read the role from persisted Zustand, not the server. They are UX,
  not security; never rely on them for authorisation.

### Onboarding

Both wizards — `(onboarding)/index.tsx` (NGO, 5 steps) and
`(onboarding)/volunteer.tsx` (4 steps) — are one flow with two audiences and are
built from the same parts. Change the shape in one and change it in both, or
they drift, which is what happened before: the NGO wizard kept its draft in
`auth-store`, the volunteer one in `useState`; one had a review screen you could
tap to edit and the other had a read-only table; one had a dead step.

| Piece | File |
|---|---|
| Shell: progress bar, scroll body, **pinned** footer, desktop aside | `components/onboarding/wizard.tsx` |
| Aside, review list, completion screen | `components/onboarding/wizard-parts.tsx` |
| City/state + "use my location" | `components/onboarding/location-fields.tsx` |
| Position + reverse geocoding, and their platform traps | `lib/location.ts` |
| Logo / banner / avatar upload | `components/onboarding/photo-field.tsx` |
| Persisted drafts, cleared on success | `store/onboarding-store.ts` |
| Canonical city list, aliases, state lookup | `lib/cities.ts` |

- **The primary action is pinned in the footer**, not the last thing in the
  scroll body. Continue used to sit below the fold on the NGO address step.
- **Progress is `WizardProgress`, not `StepIndicator`.** Five labelled dots
  truncate to "Orga…" on a 360dp screen. `StepIndicator` is still right for
  `(ngo)/verification`, which has three stages and room for their names.
- **Post the raw form values, never the client-parsed ones.** The mutation
  types are `Complete*OnboardingPayload` — the schemas' `z.input` side — because
  the parse is not idempotent: an `optionalText` field parses `""` into `null`,
  and `null` is not valid *input* for it. Sending `validateStep`'s output
  therefore 400s with "expected string, received null" (`bio`, `profileImage`,
  `description`). The client validates; the **server** normalises, once, at the
  boundary. Guarded by "wizard payloads, as the client sends them" in
  `apps/server/test/onboarding.spec.ts` — the service specs bypass the
  validation pipe and cannot catch this.
- **Steps validate with `validateStep(schema, payload)` from `@nabhya/shared`,
  not `zodResolver`.** Draft fields are strings — an untouched "Founded in" is
  `""` — and every optional numeric field would otherwise need the form typed to
  the schema's *input* while `handleSubmit` hands back its *output*. `validateStep`
  returns the coerced data or a field-error map; `stepOwning()` in the NGO wizard
  routes a failed final submit back to the step that owns the bad field, because
  a review screen has no field to show an error under.
- **A failed submit is a `Banner` above the form**, never a dialog or a toast —
  see the note at the top of `components/ui/overlay.tsx` for why an OS dialog is
  the wrong shape here, and why a form error in particular belongs on the form
  rather than in something that disappears.
- **Both wizards end on a completion screen, not a `router.replace`.** It is the
  only moment either account will reliably read what is left to do: documents for
  an NGO (`(ngo)/verification`), identity for a volunteer (`/verify-identity`).
  Each offers that action and a way past it.
- **Guards.** Each wizard redirects on a role mismatch and on `isOnboarded`, both
  after the completion screen's own check — finishing sets `isOnboarded`, so
  testing that first would replace the completion screen with a redirect. Like
  the role-group layouts these are UX, not security: the server's `@Roles` and its
  one-org-per-account 409 are the real gates.
- **Never widen the drafts much.** `lib/storage` is `expo-secure-store` on
  native, capped at 2048 bytes per value — the same budget `lib/post-drafts.ts`
  works against. Local `file://` previews are deliberately not persisted.
- **`lib/cities.ts` is the only place that knows a city name.** `city` is free
  text on every table that has one and every feed filter matches it exactly, so
  a wizard that writes "mumbai" writes a city with nothing in it. The picker
  (`city-picker.tsx`) reads the same list and normalises what the OS geocoder
  returns. The real fix is still server-side.
- **Never gate a location action on a permission *query*.** `requestPosition()`
  in `lib/location.ts` is the only correct way to ask. On the web,
  `Location.requestForegroundPermissionsAsync()` answers from
  `navigator.permissions.query`, which reports `"prompt"` for a browser that has
  not been asked — mapped to `UNDETERMINED`, so `granted` is `false` and both
  callers used to fail instantly with "location is off" having never raised the
  browser's dialog. On the web, `getCurrentPosition` **is** the request.
- **Reverse geocoding is optional, always.** `Location.reverseGeocodeAsync`
  does not exist on the web and returns an empty array on an Android without a
  working Play Services geocoder, so "no name for this place" is a normal path,
  not an error. `nearestCity()` in `lib/cities.ts` resolves the coordinates
  against our own city table (haversine, 120km cutoff) so the control still
  produces a city; the coordinates are saved either way. When the platform *does*
  name a place, `placeParts()` also yields a de-duplicated street line and
  pincode, which the NGO wizard drops into the address fields it asks for —
  into empty ones only, never over something typed.
- **Two columns on desktop.** `FieldPair` and `ReviewGrid` (in `wizard.tsx`)
  pair fields and run the review two-across, and the form column is 720 rather
  than 560, so a step fits a laptop window without scrolling. The body stays a
  `ScrollView`: "fits" is a default, not a guarantee — a short window, a browser
  zoom, or every suggestion row being open all need somewhere to go.
- **The NGO logo and banner are `deferred`.** Both purposes are org-scoped, so
  neither key can be minted before the organisation exists. The wizard holds
  local URIs and `storeBranding()` uploads both and PATCHes the keys after
  creation — the one part of the flow that can fail *after* success, which the
  completion screen says out loud when it does.

- **Identity verification asks for one ID, not a choice of five.**
  `verification/id-capture.tsx` is fixed to the Aadhaar card. The chip row of
  every accepted type used to be the first thing on the screen and read as a
  checklist of documents to produce rather than a pick-one; `documentType` is
  still on the submitted value because the server takes the whole enum and a
  reviewer needs to know what they are looking at. The ID and selfie cards sit
  **side by side on desktop** — stacked, the camera pushed step 1 a screen away.

### Telling the person what happened

- **`Alert.alert` is gone from the app, and `lib/alert.ts` with it.** Every
  mutation result now goes through `components/ui/overlay.tsx`:
  `toast.success` / `toast.error` / `toast.info` for a transient report, and
  `await confirm({...})` for "are you sure". Both are plain function calls, not
  hooks, because nearly every caller is a TanStack Query callback. The full
  reasoning is in that file's header; the short version is that a blocking
  dialog is the wrong shape for a report you want to read *while* retrying, and
  on the web it was the browser's own dialog wearing none of the app's design.
- **`OverlayHost` is mounted in the root layout and inside every `Sheet` and
  `Drawer`, and only the topmost one renders.** A sheet is a real `Modal` on
  both platforms, so an overlay in the root layout is drawn *underneath* it —
  and half the callers (`applicants-sheet`, `pledges-sheet`, the admin detail
  sheets) act from inside one. Each host registers on mount and the top of the
  stack wins. Adding a new modal-hosted container means mounting a host in it.
- **Three shapes, and they are not interchangeable.** A **form** error stays on
  the form (`FieldError`, `AuthError`, a `Banner`) — it points at a field and
  has to survive being read and fixed. A **result** of an action taken on a row
  is a toast. A **consequence that cannot be undone** gets `confirm` first.
  Where a sheet stays open on failure, the error is inline and *not* a toast:
  `team.tsx`'s member sheet is the worked example.
- **A mutation that closes its own sheet needs a toast.** Otherwise the screen
  just blinks: nothing on it says the thing saved. Every `onSuccess: close` in
  the app was that bug.
- **An easily-reversed removal takes an Undo toast, not a confirmation.**
  `bookmarks.tsx` is the example — a dialog in front of one tap costs more than
  the mistake does.

### Auth screens

- **Failures are inline, above the submit button** (`components/auth-error.tsx`),
  never `Alert.alert`: a blocking dialog has to be dismissed before you can see
  the field you got wrong, and on the web it is `window.alert` — browser chrome
  carrying app copy. The block stays on screen while the problem is fixed and is
  announced by a screen reader.
- **`authErrorCopy()` maps the two failures that actually happen.** Supabase
  cannot distinguish a wrong password from an account that does not exist (that
  distinction is an account-enumeration oracle), so the sign-in copy covers both
  and offers **Create an account** as the way out — being on the wrong form is
  the commonest cause. Sign-up's "already registered" offers Sign in. Everything
  else falls through to the real message, which is deliberate: "email not
  confirmed", a 401 and a dead network each need a different response.
- **Password fields pass `revealable`, not `secureTextEntry`.** `FormField` owns
  the toggle (`components/ui/form.tsx`). A masked field with no reveal is the
  biggest cause of a sign-in failure the user cannot explain — autocorrect, caps
  lock and a mistyped character are all invisible.

## Data access

Layering is `lib/api/services.ts` (thin, typed axios calls) → `hooks/use-*.ts`
(TanStack Query) → screens. Query keys are centralised in `lib/api/query-keys.ts` —
add new keys there, never inline. Forms use react-hook-form + `zodResolver` with
schemas imported from `@nabhya/shared`; never hand-write a shape the server already
defines.

- Auth: `@supabase/supabase-js` signs in, the session's access token is stored as
  `accessToken` in expo-secure-store (localStorage on web) via a thin storage
  adapter; the axios interceptor attaches the Bearer token and force-logs-out on any
  401. See `lib/api/auth.ts` and `lib/api/client.ts`.
- **Sign out through `useSignOut()`, never `useAuthStore().signOut` directly.** The
  store action only drops the token and the Zustand slice — it does not revoke the
  Supabase Auth session or clear the TanStack Query cache, so on a shared device the
  next person to sign in briefly sees the previous user's cached data. The hook
  does both, and also drops the onboarding drafts — the one piece of persisted
  state that is neither auth nor cache, and the one that would otherwise hand the
  next person a form pre-filled with someone else's registration number.
- Feed rows arrive as one generic server shape; `lib/feed-adapter.ts` is the only
  place that knows its `content` keys. Screens read `FeedItem` (`kind` union) and
  call `useFeed` / `useFeedReaction` / `useToggleFollow` — never the raw endpoints.
- Uploads: ask `POST /api/uploads/intent` for a pre-signed ticket, PUT the bytes
  with **plain `fetch`, not the axios instance** — an Authorization header would
  break the signature — then submit the returned object key. Reads go through
  `POST /api/uploads/download-url`.

## Styling

Two systems coexist deliberately:

1. NativeWind v4 + Tailwind 3.4 with shadcn-style `@rn-primitives` components in
   `src/components/ui/`.
2. A token system in `src/constants/design-system.ts` consumed via `useTheme()`.

`design-system.ts` is the **source of truth**. `src/global.css` mirrors it as HSL
CSS variables and `tailwind.config.js` reads those variables, so both systems now
theme together — change a colour in the token file and update the matching
variable in the same pass, or the two layers drift.

Most screens use inline `style={{}}` from the tokens rather than Tailwind classes.
**Match whatever the file you're editing already does.**

`darkMode` is `"class"`, which means the `dark:` variant is driven manually:
`ThemeProvider` (`hooks/useAppTheme.tsx`) calls NativeWind's `colorScheme.set()`
and, on web, toggles `.dark` on `<html>`. Both are required — without the first,
`dark:` never fires on native; without the second, the CSS variables never swap.

Screens compose `components/screen-shell.tsx` (`ScreenHeader`, `Surface`,
`EmptyState`, `LoadingState`, `ErrorState`, `FilterChips`) + `status-pill.tsx` —
reuse these rather than rebuilding layouts.

- **Pushed pages** render `<ScreenHeader back title=… />`: a 40pt chevron on the
  left and the title on the same row. Never place `<BackButton />` on its own
  line above a heading. The two hero pages (`events/[id]`, `ngos/[id]`) draw their
  own row and must use `useSafeAreaInsets().top`, not a guessed `paddingTop`.
  `BackButton` renders on desktop too — it used to return `null` there, which
  left every pushed page that is not also a sidebar destination with no visible
  way back. The browser's own control is the *browser's* history, sits outside
  the viewport, and is never reached by tabbing the page.
- **Every sheet is `components/ui/sheet.tsx`.** Native is `@gorhom/bottom-sheet`
  (pan to dismiss, detents, keyboard-aware, pinned title and footer); web is a
  `Modal` behind the same props. Never import `Modal` in a screen. Body content
  goes in `children`, the primary action in `footer`; a list body sets
  `scrollable={false}` + `detents` and renders `SheetFlatList`; a pick-one list
  uses `SheetOption`. A sheet that opens a portalling primitive
  **Do not put a portalling primitive inside a sheet or drawer.**
  `DropdownMenu`, `Select` and anything else on `@rn-primitives` renders
  through a portal, and a portal cannot be made to clear the host modal
  reliably on either platform. Native: the root `PortalHost` sits *below* the
  RN `Modal` the sheet is hosted in. Web: RNW hosts that `Modal` at
  `zIndex: 9999`, a `style` z-index on the menu content lands on a *child* of
  the positioned element (and RNW compiles it to a class that loses to the
  `z-50` already there), and `@radix-ui/react-popper` then copies the
  content's **computed** z-index onto its own wrapper as an inline style —
  pinning the menu behind the modal. Use an inline control instead;
  `post-composer.tsx` picks `ChoiceChips`, which is what the need and event
  forms already use. `lib/web-styles.ts` carries an
  `[data-radix-popper-content-wrapper]` `!important` rule as a backstop for
  poppers *outside* a modal, but nothing should rely on it to escape one.
- **The post composer is a `Drawer`, not a `Sheet`.** Writing a post is a side
  task, not a page: on desktop the feed stays visible on the left while the
  panel docks right (`wide`, 520). On a phone `Drawer` *is* a `Sheet`, so the
  mobile experience is unchanged.
- **The feed's "what to see" filter is one choice, not two.** `FeedContent` in
  `components/feed/feed-filters.tsx` covers Everything / Needs / Offers /
  Events / Updates, and `feedContentQuery()` turns it back into the server's
  separate `kind` and `needType`. They are not independent from the reader's
  side — "Offers" already implies needs, and setting both is redundant or
  empty. The section previously held only All / Needs / Offers, so "events I
  can turn up to" had no control at all even though the server had taken `kind`
  all along. Both feeds (volunteer home and `(ngo)/feed`) use the same value.
- The volunteer home header is two rows ("Home" with the city chip and search on
  the right, then the lens chips with a filter button). Search is its own route,
  `app/search.tsx`, with example searches before typing and All / NGOs / Needs /
  Events / Updates result tabs (the feed API takes `kind`). The cause filter is a
  sheet. Notifications live in Activity — no bell on Home. Appearance is a row in
  the volunteer Profile (`useAppTheme().preference`), not a floating toggle.

### Scrolling on web

`showsVerticalScrollIndicator={false}` is **not** a cosmetic choice on the web:
react-native-web compiles it to `scrollbar-width: none` (`ScrollViewBase`), and
Chrome has honoured that since 121 — so a pane with it set has no scrollbar, no
thumb position and no clue there is anything below the fold. Spread
`verticalScrollbar` from `src/lib/scroll.ts` instead, which hides it on native
and shows it on web. Horizontal chip rows keep
`showsHorizontalScrollIndicator={false}` explicitly.

The scrollbar itself is **not CSS**. Two attempts lived in `src/global.css` —
one inside `@layer base`, one outside it — and neither reached the browser: raw
`::-webkit-scrollbar` selectors do not survive NativeWind's compilation of that
stylesheet on the way to the web bundle, so every pane kept Chrome's own
Windows scrollbar, stepper arrows and all. It is injected at runtime from
`src/lib/web-styles.ts`, called by `ThemeProvider`, which is also the only
place that knows the resolved scheme — so the thumb comes from
`design-system.ts` rather than from a CSS variable that may not have been
emitted. Note two things before editing it: **styling `::-webkit-scrollbar` at
all opts Chrome out of its overlay scrollbar into the legacy one**, so
`-button` must be zeroed on every axis; and `scrollbar-width: none` (what
`showsVerticalScrollIndicator={false}` compiles to) still beats all of it, by
design — that is how the sidebar and the desktop rail stay bare while content
panes get a thumb.

Two more things that make a page silently unscrollable, both of which have
already happened here:

- **A desktop branch with no scroll container.** A `Platform`/`isDesktop`
  ternary that wraps the mobile body in a `ScrollView` and the desktop body in
  a plain `View` renders the desktop content into `overflow: hidden` — it is
  drawn past the fold and cannot be reached at all. If a branch can overflow,
  it needs its own scroller. The `(ngo)/feed.tsx` rail column is the worked
  example. `(ngo)/profile.tsx` used to be the other one and is now the opposite
  lesson: it has a single `ScrollView` for both platforms and varies only
  `refreshControl`, so the branch that could forget a scroller no longer
  exists.
- **A `ScrollView` where a `View` used to be, in a flex row.**
  react-native-web gives every `ScrollView` `flexGrow: 1; flexShrink: 1` in its
  base style, and `flex-grow` beats `width` when the row has spare space. A
  320pt rail converted from a `View` to a `ScrollView` grew to ~700pt and
  squeezed the feed column to its minimum. Fixed-width columns need
  `flexGrow: 0, flexShrink: 0` spelled out; `alignSelf: "stretch"` rather than
  `position: sticky` if they scroll internally, since a sibling of the scroll
  container has nothing to stick to.
- **A sticky column that is a sibling of the scroller, not a child of it.**
  `position: sticky` needs a scrolling ancestor. A rail beside a scrolling feed
  has none, so sticky does nothing useful and only makes the column size to its
  content and clip. Give it `alignSelf: "stretch"` and its own `ScrollView`.
- **A flex chain that never reaches the viewport.** Every scroll region's
  height comes from a run of `flex: 1` ancestors; if one resolves to content
  height, the `ScrollView` grows to fit and the `View` above clips. `(ngo)`
  pins its desktop shell to `100dvh` and sets `minHeight: 0` on the content
  column so the chain cannot be the question.

### Focus, and icon-only controls

**Text fields get no focus ring.** Not on `:focus`, not on `:focus-visible`.
The rule in `global.css` used to keep one on `:focus-visible` on the theory
that plain `:focus` is the mouse and `:focus-visible` is the keyboard — true of
buttons, false of text inputs, which match `:focus-visible` even when clicked
because the UA assumes typing follows. So the "keyboard only" ring fired on
every click. A focused field already shows a caret, which is a stronger
indicator than a border. Buttons, links and rows keep theirs
(`[data-focus="ring"]`, driven by `lib/focus.ts`), where `:focus-visible`
behaves as advertised.

**`components/ui/tooltip.tsx` is a hover aid, never the label.** Web only —
there is no hover on a phone — so it cannot be the sole explanation of a
control, and the `accessibilityLabel` underneath stays the real answer. It also
does not portal, on purpose: see the note at the top of `ui/sheet.tsx`. Use it
for a fixed toolbar of icons (the composer's is the worked example) and nowhere
else; everything outside such a toolbar still ships with a visible word.

### Colour rules

`#FF7E40` is **a fill, not an ink** — it measures 2.53:1 on white, so it fails AA
for any text, icon or 1px border. Use the tokens instead of reaching for `main`:

- `primary.contrast` — label colour *on* a `primary.main` fill (7.44:1).
- `primary.ink` — brand as text/icon on a light surface (7.31:1).
- `<tone>.ink` — text grade on that tone's `bg` (6.8:1–10.4:1). `StatusPill` uses
  these; a pill drawn in `<tone>.main` on its own tint is unreadable.
- `text.quaternary` is the muted floor (4.61:1). Nothing lighter for real content.
- `accent` is the fifth tone (violet), for a *category* that is neither a status
  nor an action. It has **no caller today** — the feed card's "Story" pill was
  the last one, and the card is now near-monochrome (see `components/feed/card/`
  in the root guide). It stays defined because the tone it replaced was six
  hardcoded light-mode hexes: correct on white, bright white-tinted blocks on a
  near-black card. **A hardcoded hex in a component is a dark-mode bug that
  light mode cannot show you.**
- **A tinted block is an expensive way to say one word.** Every `<tone>.bg`
  panel is a full-width coloured rectangle competing with the content inside it,
  and a screen that draws three of them has no hierarchy left. Reach for type
  weight and colour first, a rule second, and a filled surface only when the
  thing genuinely is a distinct surface.

The type ramp lives in `components/ui/typography.tsx` and owns its own sizes,
optical tracking and Dynamic Type ceilings. Don't override `fontSize` at call
sites; add a ramp entry if a size is genuinely missing.

Every interactive element needs `accessibilityRole`, a label if it has no visible
text, and `accessibilityState` if it can be selected/checked/disabled. Icon-only
controls (`BackButton`, `NotificationBell`, `ThemeToggle`, sidebar rows) are the
worked examples. Focus rings matter on web: RNW renders none for `Pressable`, so
read `focused` from the style callback and draw an `outline*` — `Button` and
`Surface` show the pattern.

## The superadmin console

`(admin)/*` is a **data console**, and it is the one part of the app that is not
built out of the feed's shapes. The five screens share four components in
`components/admin/`, and the reasons live in those files at length — read them
before changing a screen. In short:

- **`list-chrome.tsx` — the page is the scroller, and it is full width.**
  `AdminScreen` owns one `ScrollView` at full window width with **no content
  cap**: a cap is right for reading and wrong for a table, whose columns are
  fixed except one, so the width a monitor offers goes to the identity column
  that wants it. It used to be the other way round (a capped `Screen` holding a
  fixed header over a list that owned a `FlatList`), which produced a scrollbar
  at x=1040 down the middle of the window, a second one inside the audit log's
  card, and a table header with nothing to stick to. **Consequence: nothing
  inside a console page may own a vertical scroller** — no `FlatList`, no nested
  `ScrollView`. `DataTable`'s horizontal scroller is fine; a different axis
  cannot compete. Infinite paging is `onNearEnd` on the page, since a list with
  no scroller has no `onEndReached` to give.
- **Chrome is two tiers, and the toolbar is the tier that pins.** `AdminScreen`
  takes `title` / `subtitle` / `action` / `toolbar` as props rather than letting
  screens render a `ScreenHeader`, because it has to own the stickiness. The
  title scrolls away; the command bar stays and picks the title up *inside*
  itself once the big one is gone. Pinning the whole header instead would spend
  96pt of every screen restating a title the reader picked from the rail two
  seconds ago, while the controls they actually reach for scroll off.
  **`DataTable`'s sticky header must therefore offset its `top`** by the bar's
  measured height, published through `useStickyOffset()` — at `top: 0` the
  column labels pin *underneath* the toolbar and vanish. A hard-coded number
  drifts the moment the toolbar wraps to two lines. **`Toolbar` carries no
  margin of its own** for the same reason the bar sets `minHeight: 40`: a
  `marginBottom` on the toolbar tipped the row and left the controls visibly
  low against the collapsed title beside them.
- **`data-table.tsx` — the console's default shape.** A card is right when a row
  is a thing you *look at*; a table is right when it is a record you *compare*,
  which is the whole job here. Sticky header, sortable headers, an optional tick
  column with a tri-state header, fixed columns plus one that flexes,
  `wideOnly` columns dropped under 1240. No zebra striping and no tinted header:
  hairlines and type, so the `StatusPill`s stay the only colour. **Rows are 64pt,
  not 52** — a row carries two lines in its identity column plus a pill, and at
  52 the pill touched the hairlines above and below it: fitting, but cramped, and
  tiring over forty rows.
- **Two populations, two screens, and no role filter spanning them.** `NGOs` is
  the `organizations` table; `Volunteers` is `users` **hard-filtered to
  `role: "volunteer"`**, with no Role select at all. It used to be "People" with
  a Role select covering volunteers, NGO accounts and superadmins, so an NGO
  showed up twice — as an account here and as an organisation next door — with
  nothing on either screen saying which to use. An NGO's own account is now
  reached through its organisation: the dossier's Owner section has
  "Manage this account", which the *screen* handles by closing the org drawer
  and opening the user one. **Sequentially, never nested** — a drawer inside a
  drawer is a `Modal` inside a `Modal`, and the inner `OverlayHost` fights the
  outer one for every toast. That handoff is also the better route: nobody
  should suspend an NGO's login without having just read its record.
- **The table is a card, and the rows sit inside it.** `background.card`,
  `borderRadius.xl`, the light-mode shadow, and a 16pt `CELL_INSET` shared by
  the header and every row. It was naked rows on the page background separated
  from the toolbar by a margin, which read as loose text with rules through it
  and ran the first column against the page gutter. **Never put
  `overflow: hidden` on that card** — it would become a scroll container and
  kill the sticky header; the top corners are rounded on the header row itself
  and the last row drops its hairline so nothing paints across the bottom two.
  The whole row is the pressable (tick gutter included) so the hover tint spans
  it edge to edge; the tick is a nested `Pressable` and still wins its own
  presses.
- **The card grid sizes the *card*, not the column count.** `useGridColumns()`
  caps at three, which was right while pages were capped at 1180; full width, 3
  cards on a 2560 monitor are 760pt each. `ConsoleList`'s `Cards` measures its
  container and fits as many ~380pt cards as it holds. The table wants the
  opposite — one column absorbing the slack — which is why this is not shared.
- **The title handover is animated.** As a bare boolean the pinned title and its
  divider popped in mid-scroll and shoved the toolbar sideways in one frame. One
  `Animated.Value` drives the title's opacity, a 6pt rise and the divider's
  colour, 180ms in / 140ms out; the heading stays mounted and is faded rather
  than mounted on the threshold, so the bar never re-measures under the reader.
  `useNativeDriver: false`, because `borderBottomColor` is neither a transform
  nor an opacity.
- **The table must never own a scroller — not even a horizontal one.** It had a
  `ScrollView horizontal` wrapper, to push sideways when the columns needed more
  room than the window had, and that wrapper caused both of the bugs it was
  meant to prevent:
  1. **The table stopped being full width.** A horizontal scroller sizes its
     content to the content, so the flexing column collapsed to its `minWidth`
     and the table ended at the sum of the minimums with empty page beside it.
  2. **The sticky header pinned across the middle of the rows.** `position:
     sticky` resolves against the *nearest* scrolling ancestor — that wrapper,
     not the page — so `top: <toolbar height>` was measured from the top of the
     table's own box and the header floated over row four.

  The table is a plain `View` at `width: "100%"` with `minWidth` as a floor.
  Narrow windows drop columns (`wideOnly`), and below the mobile breakpoint
  `ConsoleList` renders cards instead. There is no width at which a nested
  scroller was the right answer.
- **Sorting is a server round trip, never a client re-sort.** Every list is
  paged at 20, so sorting in the browser sorts twenty of three hundred rows.
  `sort` + `dir` are on all four admin query schemas in `@nabhya/shared`, each
  key maps to a column or a correlated subquery in `AdminService.orderFor`, and
  every list adds its default column as a **tiebreaker** — without one, paging a
  list sorted by a low-cardinality column (verification status) repeats and
  skips rows. Guarded by "pages deterministically when every row shares the sort
  key" in `apps/server/test/admin.spec.ts`.
- **`toolbar.tsx` + `select-menu.tsx` — filters are selects, not chips.** Chips
  are right for three or four peers you flick between and wrong as a filter bar:
  two stacked rows of eleven of them pushed the first row of data 200pt down
  every page, and they cannot express two independent axes (an NGO can be
  verified *and* suspended). `SelectMenu` does not portal — same reasoning as
  `ui/tooltip.tsx`, see the note at the top of `ui/sheet.tsx` — so it works on a
  page, in a sheet and in the drawer. `useTableView(screen)` remembers table vs
  cards per screen in `lib/storage`.
- **`console-list.tsx` — three shapes, one component.** Desktop + table →
  `DataTable`; desktop + grid → cards two or three across; mobile → always
  cards. It renders rows inline rather than using `PagedList`, and pays the
  virtualisation cost knowingly: a console page is 20 rows of type with no
  media, while the volunteer feed has images, video and no end and keeps
  `PagedList`.
- **The audit log is a table and only a table** (no view switch, no selection,
  no row press). Nobody *recognises* an audit entry, there is nothing to do to
  one, and the reason to open the page is to compare a column. Its "When" column
  is an absolute timestamp, not "23 hours ago" — a ledger is read to answer
  "before or after", which forty rows of "23 hours ago" cannot.
- **A record opens in a `Drawer` with `xl`, never a centred dialog.** Opening an
  NGO or an account is not leaving the list: the reviewer is working *down* a
  filtered directory, and the row they came from plus the ten after it stay
  visible on the left while they decide — which a modal covers exactly. 720
  rather than the drawer's usual 520 because a dossier is fact tables and
  document cards, not a column of short fields. `FactGroup` pairs its facts
  two-across above 560 (nine org facts stacked is a screen of scrolling before
  the documents, which are what the panel was opened for) and stays
  single-column below it. On a phone `Drawer` *is* a `Sheet`, so nothing
  changes there.
- **The decision is pinned in the drawer's footer, sized to its labels.** It was
  four full-width buttons at the bottom of the scroll — reachable only after
  scrolling past every fact, and a stack of four 100%-wide buttons reads as a
  menu rather than a decision. Suspension sits at the far end of the row, apart
  from the verification buttons: it is the one action that is not part of that
  decision, and a destructive button beside "Approve" invites the wrong tap. The
  **reason field stays in the body**, directly above them — it is a field, and a
  field has to survive being read and corrected, which is what a pinned footer
  does not do.
- **The queue is the only screen with bulk actions, deliberately.** Approving a
  routine document is repetitive and reversible; suspending an NGO is neither
  and belongs in a dossier with the whole record on screen. **Approve is one
  press, Reject asks** — the server requires remarks, so a single row and a
  selection both open `RejectDocumentsSheet`. The server reports per-document
  outcomes rather than a count (`BulkReviewResult`), because one id in forty can
  fail on its own and "39 approved" leaves the fortieth unexplained.
- **`stat-list.tsx`, not `MetricRow`, in the console aside.** Four `H2`
  numerals at 320pt wrap 3 + 1, so "Suspended" lands alone under a 28px zero;
  and the numeral gets top billing whether or not the number means anything.
  Label left, number right, hairlines between, and a tone only on a figure that
  needs acting on.

### The dashboard, and its charts

`charts.tsx` + `viz-tokens.ts`. **Read `viz-tokens.ts` before touching a
colour** — every value in it was validated, not chosen, and its header records
the numbers.

- **Form follows the data's job, and most of this data's job is not a chart.**
  A single current count is a `StatTile`; drawing "12 documents pending" as a
  bar is a picture of a number. The platform counters stay as tiles and
  `StatList` rows for the same reason — they have no dimension to plot against.
  The dashboard was a stack of `MetricRow`s precisely because nobody asked what
  form the numbers wanted.
- **The two real charts exist because the API gained a time series.**
  `GET /api/admin/overview/trends?days=7|30|90` returns per-day signups, events
  and applications, plus the window's totals *and the previous window's*, so a
  delta needs no second request. The server **zero-fills every day**: a
  `GROUP BY date` returns only days that had a row, and a line drawn straight
  across the gaps claims steady activity where there was none. Guarded by
  "zero-fills every day in the window" in `apps/server/test/admin.spec.ts`.
- **The day bucket is `to_char(column, 'YYYY-MM-DD')` with no timezone
  conversion.** Every `created_at` here is `timestamp` *without* time zone
  already holding UTC; `date_trunc('day', column at time zone 'UTC')` on such a
  column casts naive to `timestamptz` and then truncates in the **session** zone,
  which silently produced an all-zero series. Don't reintroduce it.
- **The chart palette is not the brand palette.** `#FF7E40` is a fill (2.53:1 on
  white) and fails the 3:1 a 2px line mark needs, and `success` / `error` /
  `warning` are **status** colours with reserved meaning — spending `error.main`
  on "new volunteers" makes a growth line read as a problem. Series slots come
  from a palette validated in both modes against these exact surfaces: worst
  all-pairs CVD ΔE 9.2 light / 9.4 dark, normal-vision 24.0 / 20.9. **Never add
  a fourth series hue** — a generated one is indistinguishable from an existing
  slot under simulated CVD; the answer is fewer series, a facet, or a table.
- **The pipeline bar is *ordinal*, not categorical.** Pending → In review →
  Verified is a funnel, so it takes one hue stepping light to dark and the order
  carries the meaning; Rejected is terminal rather than further along, so it
  takes the neutral. Not a pie: comparing two close slices by angle is what pies
  are worst at, and a 2-slice pie is a stat tile with extra steps.
- **One window switch above both charts**, never a picker per card, so the page
  cannot show a 7-day line beside a 30-day one. `keepPreviousData` holds the old
  chart up while the next window loads — a skeleton flash on a chart about to
  look nearly identical jumps the layout for nothing.
- **Every value is readable without hovering.** The crosshair is an enhancement;
  the legend carries each series' window total and a marker sits on the last
  point. Hit zones are one full-height column per point, so a 4px dot is never
  the target.
- Mark specs, all fixed: 2px lines, 8px+ markers with a **2px surface ring**,
  area wash at ~10% opacity (never a saturated block), bars 24pt or thinner, a
  **2px surface gap** between stacked segments (a gap, not a border — a stroke
  is ink that is not data), and **solid** hairline gridlines. Dashed reads as
  "projection" when it is just a grid.
- **Text never wears the series colour.** Values, labels and legends use text
  tokens; a coloured swatch beside the text carries identity. A light hue is
  illegible as type on the surface.
- **One hero figure per view, at most.** And no display or serif face on it —
  that reads as off-brand decoration rather than data.

---

## Traps

- **Import `Pressable` from `@/components/ui/pressable`, never from `react-native`.**
  NativeWind's native interop flattens `style` with an object spread, so a style
  *function* (`style={({ pressed }) => …}`) becomes `{}` on iOS and Android while
  web renders it fine. The wrapper passes `cssInterop={false}`. `Button`, `Surface`,
  the chips and the tab bar are all built on it; `className` is not processed on it,
  which nothing in the app needs.
- `expo-env.d.ts` is gitignored and generated — a fresh clone fails `tsc` on the
  `global.css` import until `expo start` (or equivalent) creates it.
- **The dev API host follows the packager; do not hardcode it again.**
  `resolveApiUrl()` in `src/lib/env.ts` reads `Constants.expoConfig?.hostUri`
  (`host:port`, null in a production build) and points the API at that host on
  port 3000, mapping `localhost` to `10.0.2.2` on Android. The LAN IP therefore
  lives in exactly one file, `REACT_NATIVE_PACKAGER_HOSTNAME` in `.env.local`.
  It used to live there *and* in `EXPO_PUBLIC_API_URL`, and the pair drifted
  every time the network changed — which fails in the least diagnosable way
  available: Metro still serves the bundle, so the app boots and signs in, and
  only data requests hang until the 30s client timeout. Nobody traces "the feed
  says Building the feed forever" back to an env file. Tunnelled hosts are
  excluded (`TUNNEL_HOST`) because the API is not tunnelled with the packager.
  `EXPO_PUBLIC_API_URL` still wins when set and is required in production.
- Env: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` both throw
  at import if unset (`src/lib/env.ts`).
- **Paged lists go through `components/paged-list.tsx`.** `usePagedQuery` +
  `PagedList` turn a `Paginated<T>` endpoint into an infinite list (flattened
  pages, `loadMore`, refresh, and the loading/error/empty states in one place),
  ending in the app's one `LoadMoreFooter` and scrolling with
  `verticalScrollbar` — never a hard-coded `showsVerticalScrollIndicator={false}`,
  which on the web is a pane with no thumb. Two deliberate exceptions, both of
  which say so in the file: `(ngo)/team.tsx` (the endpoint returns the whole
  team) and `(volunteer)/activity.tsx` (five endpoints merged client-side — a
  true merged cursor is server work). Never hand-roll a `useQuery` list hook
  that only ever reads page 1; nine of those existed unused beside the paged
  screens and were deleted for exactly that reason. **`(admin)` is not exempt.**
  It had a parallel stack — its own `useInfiniteQuery` in `use-admin-lists.ts`,
  its own `PAGE_SIZE`, its own search field, its own paging footer, and the same
  50-line `FlatList` written out five times (twice in `queue.tsx` alone) — which
  is precisely how a console drifts into being a second design system. The admin
  hooks now return `{ query, items, total, loadMore }` from `usePagedQuery` and
  the screens render `PagedList`; `components/admin/list-chrome.tsx` is down to
  the one thing that is genuinely admin-only, the 1040 desktop cap.
- **One search control: `components/search-field.tsx`.** It was three — the
  feed's search route, the desktop top bar, and the admin lists — all the same
  44pt inset well with the same icon at the same weight, and all three drifted:
  two clear-button treatments, two heights, one `accessibilityRole="search"`
  between them. `compact` and `maxWidth` cover the top bar's 40pt/440 variant;
  `pending` dims the clear button while a keystroke waits on the debounce.
- Role vocabulary is `volunteer` / `organisation` / `superadmin` from
  `@nabhya/shared` `roles.ts` — do not reintroduce the old `ngo` alias, and do not
  reintroduce `setGuestMode()` in `auth-store.ts`.
