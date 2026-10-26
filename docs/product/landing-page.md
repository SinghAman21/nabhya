# Public landing page

The signed-out web entry at `/` renders `apps/native/src/components/landing/`.
Native sign-in, OAuth recovery, team invites, role selection, onboarding and
signed-in routing retain the existing entry gate. There is no separate web app.

## Narrative and components

- `page.web.tsx` composes the hero/story, event discovery with cause chips, India
  discovery map, trust disclosures, final invitation and footer.
- `workflow-story.web.tsx` is the signature illustrated journey: Post → Discover
  → Apply → Accepted → Show up → Contribute. `story-illustration.web.tsx` draws
  original SVG people in one community setting; the adjacent example product
  panel changes state. This is a labelled walkthrough, not live application UI.
- `story-content.ts` owns the six concise descriptions and the six-second scene
  duration. Identity verification before applying and NGO-controlled acceptance
  are stated rather than promising immediate or guaranteed acceptance.
- `use-story-playback.web.ts` owns one cancellable timer. CSS paints progress
  without frame-by-frame React updates. Pause/play, previous/next and all six
  stage buttons are available. Manual selection pauses until Play. Hover,
  keyboard focus, offscreen visibility and hidden tabs temporarily hold playback;
  remaining time is retained. Reduced motion disables autoplay and transitions.
  Focus never moves automatically; only manual changes announce a status.
- `landing.css` and `workflow-story.css` are scoped to this surface. The existing
  orange brand (`#FF7E40`), dark contrast text, warm ivory, MonaSans, self-hosted
  Newsreader and application wordmark remain. No animation dependency was added.
- `index.web.tsx` supplies the real wordmark and existing signed-storage-image
  renderer. The native counterpart renders nothing.

## Data and destinations

`use-landing-data.ts` calls the existing public category, ranked event feed and
NGO directory clients with TanStack Query caches. Nine EVENT candidates are
requested, with at most three shown. Cause selection sends actual category UUIDs;
the canonical starter category catalogue supplies labels if categories fail, but
never fabricated IDs. Loading uses static skeletons; empty and error states are
explicit and offer appropriate discovery/retry paths. No fallback NGO or event
records are inserted.

Known development fixtures (`5eedf1e0-` IDs) returned by the API are labelled
“Demo listing”, receive no verification badge and link to their actual record.
Their placeholder image keys are skipped; date/location artwork uses their own
fields. Genuine stored covers use the existing signed-image integration.

The map uses the first 100 public directory records, not a complete nationwide
coverage dataset. Only verified, non-fixture records with a known city are pinned.
Pins represent city centres from the existing city catalogue, not NGO street
addresses. Nearby cities cluster. Accessible city search/list controls and
organisation previews accompany the SVG. City links use `/ngos?city=...`, which
the existing directory consumes. Missing data creates an honest empty state;
unknown cities remain discoverable in the full directory. Connection lines are
illustrative, not proof of partnerships, travel or impact.

CTAs use `/events`, `/ngos`, `/signup`, `/login` and existing detail routes.
NGO registration follows account creation → role selection → onboarding →
document review. No duplicate authentication, application or publishing flow was
created. Reviewed documents, recorded payments, attendance and NGO-authored
reports have separate explanations. Receipts are not represented as 80G
certificates; NGO reports are not represented as independently audited outcomes.
There are no invented metrics, testimonials, partnerships or contact/legal pages.

## Scroll containment

The landing pane owns scrolling and is a positioned containing block. This keeps
absolutely positioned accessible labels inside the pane rather than enlarging an
Expo ancestor. Without that containment, section links moved both the pane and
outer document, concealed the header and exposed the application background.
Header-height-based scroll padding handles section offsets. Browser native hash
navigation/history remains intact; no global body-scroll workaround is used.

## Assets and licences

- Illustrations are original source SVG, not raster photos or footage of actual
  Nabhya volunteers. The example activity is explicitly illustrative.
- India geography: Natural Earth 1:50m Admin 0 countries, public domain:
  https://www.naturalearthdata.com/about/terms-of-use/ . All 14 source polygons
  are retained using a Mercator projection. The map disclosure identifies the
  source's de facto boundary convention.
- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson .
  Rebuild using `node scripts/build-landing-map.mjs`, optionally with a downloaded
  GeoJSON path. Only the generated ~21 KB SVG path ships, without a map engine,
  token, tile service or runtime geographic download.
- Newsreader: SIL Open Font License 1.1, retained with the local font in
  `apps/native/public/landing/`. MonaSans already belongs to the app.

## Verification

See `landing-redesign-review.md` for the prioritised OilOil review, actual-browser
checks and limits. The current iteration ran the real SDK 58 Expo web app and API,
not just an isolated component mockup. No dependency installation, native build,
account creation or real application submission was performed.
