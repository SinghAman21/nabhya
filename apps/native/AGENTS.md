# apps/native — Expo client agent guide

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before
writing any code. Do not work from memory — SDK 56 APIs differ from what you think
you know.

Repo-wide rules and context live in the root `AGENTS.md`. Expo SDK 56 + Expo Router
(file-based, typed routes, React Compiler on), React 19.2.3 / RN 0.85.3. **No
Playwright or browser automation** — there is no web target yet.

## Routing

- Gate is `src/app/index.tsx`: no email → `/(auth)/login`, no role → `/role-select`,
  NGO not onboarded → `/(onboarding)`, else the role tab group.
- Route groups: `(auth)`, `(onboarding)` (`index` = NGO wizard, `volunteer` =
  volunteer wizard), `(ngo)`, `(volunteer)`, `(admin)`, plus public `events/`,
  `ngos/`, `certificates/` stacks and shared screens (notifications, bookmarks,
  impact, edit-profile).
- Guards in `(ngo)/_layout.tsx` and `(volunteer)/_layout.tsx` are **client-side
  only** — they read the role from persisted Zustand, not the server. They are UX,
  not security; never rely on them for authorisation.

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
  does both.
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

### Colour rules

`#FF7E40` is **a fill, not an ink** — it measures 2.53:1 on white, so it fails AA
for any text, icon or 1px border. Use the tokens instead of reaching for `main`:

- `primary.contrast` — label colour *on* a `primary.main` fill (7.44:1).
- `primary.ink` — brand as text/icon on a light surface (7.31:1).
- `<tone>.ink` — text grade on that tone's `bg` (6.8:1–10.4:1). `StatusPill` uses
  these; a pill drawn in `<tone>.main` on its own tint is unreadable.
- `text.quaternary` is the muted floor (4.61:1). Nothing lighter for real content.

The type ramp lives in `components/ui/typography.tsx` and owns its own sizes,
optical tracking and Dynamic Type ceilings. Don't override `fontSize` at call
sites; add a ramp entry if a size is genuinely missing.

Every interactive element needs `accessibilityRole`, a label if it has no visible
text, and `accessibilityState` if it can be selected/checked/disabled. Icon-only
controls (`BackButton`, `NotificationBell`, `ThemeToggle`, sidebar rows) are the
worked examples. Focus rings matter on web: RNW renders none for `Pressable`, so
read `focused` from the style callback and draw an `outline*` — `Button` and
`Surface` show the pattern.

## Traps

- `expo-env.d.ts` is gitignored and generated — a fresh clone fails `tsc` on the
  `global.css` import until `expo start` (or equivalent) creates it.
- Env: `EXPO_PUBLIC_API_URL` falls back to `10.0.2.2:3000` on Android in dev;
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` both throw at
  import if unset (`src/lib/env.ts`).
- Every list endpoint returns a `Paginated<T>` envelope but screens currently render
  only page 1 — if you touch a list screen, prefer wiring real pagination over
  hardcoding page 1 again.
- Role vocabulary is `volunteer` / `organisation` / `superadmin` from
  `@nabhya/shared` `roles.ts` — do not reintroduce the old `ngo` alias, and do not
  reintroduce `setGuestMode()` in `auth-store.ts`.
