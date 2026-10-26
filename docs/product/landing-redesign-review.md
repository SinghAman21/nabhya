# Nabhya landing review and implementation

## Context

- Stage: established design system; this is a landing-surface revision.
- Surface: public Expo web marketing page, volunteers and NGOs.
- Primary task: find a volunteering event; CTA `/events`.
- Secondary path: NGO account creation at `/signup`, then the existing role/onboarding/document-review flow.
- User direction: original orange brand, a compact illustrated journey, controlled autoplay, less visible copy, truthful geographic discovery and limited device resources.

## Findings and decisions

### P0 — competing page scrolling

- Evidence in the actual Expo page: a `#causes` click changed `window.scrollY` from 0 to 100 while the landing pane also scrolled. The header moved to -100px; the viewport was 960px tall while the outer document extended to 3951px.
- Diagnosis: execution gulf — a familiar section link moved the containing application and concealed its navigation.
- Fix: give the landing pane a positioned containing block as well as bounded scrolling. Absolutely positioned accessible labels remain inside their intended pane; root/document geometry no longer includes their offscreen placement. Use one header-height-based scroll offset. Keep the existing native root and auth gates.
- Browser experiment: setting the pane's positioning to relative reduced document height to the 960px viewport and preserved header top at 0 after the same click. This is an actual containing-block fix, not background paint over the gap.

### P1 — the volunteering story required too much reading

- Evidence: hero, audience paths and three-stage how-it-works repeated the product explanation; the application/acceptance transition was described rather than shown.
- Diagnosis: execution and evaluation gulfs — the next action and what follows an application were hard to connect.
- Fix: one custom SVG world with the same coordinator, volunteer and example opportunity. Six selectable scenes cover posting, discovery, applying, acceptance, arrival and contributing. All stage labels are visible before the first cycle completes. The mock UI is explicitly an illustrated walkthrough and performs no live actions.

### P2 — discovery and supporting material dominated the page

- Evidence: a ten-cell category section and repeated conversion sections stretched the page; unavailable data could introduce demonstration NGO markers.
- Fix: cause chips beside the event preview; fuller causes on demand; one compact trust section with disclosures; concise final invitation. Directory markers require current, verified records with known city coordinates. No fallback NGO marker list or fabricated coverage.

## Rules applied

- Reuse `#FF7E40`, the existing dark orange ink and contrast tokens, the wordmark and MonaSans. Retain the existing serif for concise headings.
- A single six-second scene timer, with remaining time retained on temporary pauses. CSS paints progress; React does not render every animation frame.
- Pause/play is at the top of the story so it remains easy to reach on mobile. Stage selection pauses until explicit Play. Hover, keyboard focus, offscreen visibility and hidden tabs temporarily hold playback. Reduced motion disables autoplay and transitions; manual controls and the complete HTML sequence remain.
- No automatic focus movement or repeated live announcements. Only manual changes use the polite status region.
- State coverage: actual API loading skeletons, successful event data, empty selection, unavailable data and retry. Account/identity/organisation permissions use existing product flows; the application scene explains identity verification and NGO decisions.
- Event previews use real record date/location information when no usable cover is available. Known `5eedf1e0-` development fixtures are labelled and receive no verification badge; their placeholder image keys are not fetched. Live records retain their existing signed-image integration.
- The map is an index of the current directory preview, not a nationwide coverage metric or evidence of partnerships. City-centre markers and an accessible city list lead to existing NGO detail/city-filtered routes.

## Verification scope

- Actual Expo web app at port 8081 and API at port 3000 were used for reproduction and initial checks.
- Eight changed presentation/playback modules passed focused semantic TypeScript checks using the real Expo ambient declarations.
- Biome checks passed across 26 landing, palette and metadata files, including accessibility lint rules. Landing modules also passed syntax/transpilation checks.
- Actual browser checks at 320, 390, 768 and 1440 pixels found no horizontal overflow. The story's inner stage fits its frame at each width. A mobile aspect-ratio/min-height issue found during inspection was corrected with an explicit width and separate placement for the arrival/contribution preview.
- All six scenes were selected and their frame heights compared. Timed advancement, manual selection holding, Play resuming advancement, hover hold, keyboard-focus hold and offscreen hold passed. A synthetic document visibility-change check confirmed hidden-tab hold. Reduced-motion mode kept autoplay off and allowed manual selection.
- Direct `#causes` entry, section clicks, and back/forward navigation preserved header top at 0 and outer window scroll at 0. Outer document height matched the viewport. Mobile menu selection closed the menu; Escape closed it, and the skip link focused `main-content`.
- Expanded all ten causes, selected Environment, observed its real category UUID in the event request, and cleared the filter.
- Map selection and keyboard activation updated the directory preview. Search handled no matches. The map's directory empty state was exercised using an intercepted empty API response; no fallback fixture markers were added.
- Opened an actual event detail, the public event listing and the existing account-registration form. A map city link opened `/ngos?city=Mumbai`, and the directory displayed its city filter. No account was created and no application was submitted.
- Intercepted empty and 503 event responses produced the intended empty/error UI. Removing the error interception and clicking Try again restored the API listings. These were browser test responses, not changes to database records.
- The final landing render produced no browser runtime errors. Intentional 503 testing produced the expected network error; reduced-motion development mode emitted Reanimated's informational warning.
- A full native TypeScript project pass exceeded its 50-second limit during memory pressure. It is not reported as passing.
- A preview process capped at 1 GB reached its heap limit while loading further app routes. Remaining browser checks ran with one Metro worker and a 1.5 GB cap. Preview/test processes were stopped after QA to release resources.
- Full native builds, new dependency installation and third-party sign-in were not required for this landing change.
