# Nabhya — visual-first landing redesign and navigation repair

Use `$oiloil-ui-ux-guide` to review and redesign the existing Nabhya landing page. Implement the result in this repository.

The objective is immediate understanding: **Nabhya connects people who want to help with NGOs that need help.** Make that connection tangible through a custom illustrated volunteering journey, concise copy, and clear next steps.

The user has chosen:

- Nabhya's original orange brand, `#FF7E40`.
- Less visible text and more meaningful visual explanation.
- One autoplay illustrated story with timed progress indicators and manual controls.
- A compact page with a clear path for volunteers and NGOs.
- Accurate product claims and geographic information.
- Lightweight implementation suitable for a low-spec development device.

## 1. Apply the skill to this existing product

- Read the skill and relevant references. Start in **review mode**, then use **guide mode** to define and implement the landing-page rules.
- Complete the skill's initial repository inspection. Read applicable `AGENTS.md` files, existing design specifications if present, the landing components, shared tokens, routes, authentication, and application workflows.
- Classify the project's current design maturity and give a short, evidence-based P0/P1/P2 review. Focus on navigation, task hierarchy, feedback, copy density, and the clarity of the volunteering story.
- Reuse the established brand and components. The product, primary colour, audience, and requested motion direction are already supplied; do not restart a broad brand interview.
- Ask one question only when an unresolved consequential decision prevents progress. Otherwise state a reasonable assumption and continue.
- Proceed to implementation after the short review. Deliver the working page, rather than only a concept or recommendations.

Useful starting points:

- `apps/native/src/components/landing/`
- `apps/native/src/constants/design-system.ts`
- `apps/native/src/app/index.tsx`, `_layout.tsx`, and `+html.tsx`
- `apps/native/src/lib/web-styles.ts`
- Public event and NGO routes, event application hooks, and `applicants-sheet.tsx`
- `docs/product/landing-page.md`

This is an Expo/TypeScript application with Expo web rendering, not a separate web application. Follow the repository's version-specific documentation requirements before changing framework behavior.

## 2. P0: investigate and repair anchor navigation first

The supplied screenshots show two states:

- Before clicking a section link, the landing page fills the viewport and the header is visible.
- After clicking a link such as `#causes`, the header disappears and a dark strip appears beneath the page content.

These are same-page hash links. Do not assume that this is a route redirect or that the screenshots prove a particular cause.

The current `.nabhya-landing` has its own overflow container, percentage height, viewport minimum height, and scroll padding. Investigate its interaction with the document, Expo root containers, sticky header, browser hash scrolling, and `scrollIntoView()`.

- Reproduce in the **actual Expo application**, using an existing running server where available.
- Compare `window.scrollY`, the document scrolling element, landing-container scroll position, and root/header bounds before and after a hash jump.
- Establish one intentional primary page scroll owner with consistent viewport sizing. Preserve intentionally bounded scrolling regions where genuinely needed.
- Make anchors, programmatic scrolling, sticky navigation, and browser history work with that owner.
- Keep target headings visible below the header; avoid applying competing offsets that create large gaps.
- Verify repeated section clicks, direct hash loads, reloads, Back/Forward, resizing, scrolling to the footer, and returning to the top.
- Check mobile-menu anchor selection and the skip link as well.
- Fix the underlying layout/scroll behavior. Painting the exposed region ivory or clipping inaccessible content is insufficient.
- Keep any root-layout changes compatible with existing protected routes and native behavior.

## 3. The story visitors should understand

**NGO posts → Volunteer discovers → Applies → NGO accepts → Volunteer shows up → Contributes with the community.**

Discovery, applications, and application decisions happen through Nabhya. Show how this reduces fragmented coordination through forwarded links and scattered messages. Do not promise that every application is accepted or that all real-world coordination disappears.

Preferred hero direction:

**Volunteering, without the back-and-forth.**

Supporting sentence:

“One place to discover opportunities, apply, and hear back from the NGO.”

Use **Explore opportunities** as the primary CTA and a clear NGO entry such as **Register your NGO** as the secondary CTA. Use existing routes. If another label promises posting, make the required registration and document-review steps clear.

## 4. Build one signature illustrated story

Use a single coherent visual stage that evolves through six scenes. Keep the opportunity and people recognisable between scenes, so the visitor follows one journey rather than six unrelated feature cards.

1. **Post:** an NGO prepares an opportunity with a role, place and date.
2. **Discover:** that same opportunity appears in the volunteer's discovery view.
3. **Apply:** an application is submitted and becomes pending.
4. **Accepted:** the NGO reviews and accepts the application.
5. **Show up:** the digital scene connects to the volunteer arriving at the activity.
6. **Contribute:** the volunteer works alongside the NGO team and community.

- Use custom SVG/CSS or existing lightweight illustration tools. Show believable Indian community settings, purposeful actions and consistent people, proportions and line work.
- Integrate concise product UI into the scene: opportunity details, pending application, acceptance and attendance where supported.
- Clearly identify illustrative examples. Their UI explains the workflow; it must not pretend to submit a real application, accept a volunteer, or display a real notification.
- Keep short labels for all six stages visible from the beginning. Visitors should understand the whole journey without waiting for the animation to finish.
- Give the current scene one short caption. Do not repeat the caption in a paragraph below it.
- A few fading message fragments may introduce the coordination problem. Resolve them into the connected flow quickly; avoid a wall of messages or third-party logos.
- Integrate this story into the hero or directly below it. Use its section as the “How it works” destination; avoid a second explanation of the same six steps elsewhere.
- Show the identity-verification requirement near the application explanation. NGO approval of an application is a decision, not an automatic guarantee.

## 5. Autoplay behavior: a story carousel, not a loading screen

The desired pattern is an **autoplay story carousel with timed progress indicators**.

- Start with a complete, readable first scene. No loading animation should delay the value proposition or CTA.
- Advance approximately every five to six seconds while the story is visible. Provide labelled stage selectors, Previous/Next and a visible Pause/Play control.
- Keep the illustration canvas and surrounding layout stable between stages. Adapt the composition for mobile without introducing horizontal page overflow.
- Use one active stage and one timing mechanism. Avoid multiple competing intervals or per-frame React state updates.
- Pause when the story leaves the viewport, the browser tab becomes hidden, or keyboard focus enters its controls. Pause on hover for pointer users.
- A manual stage selection or explicit pause must leave the visitor in control; do not immediately advance past their selection. Explicit Play can resume.
- Respect reduced motion: disable autoplay and substantial transitions, retain manual navigation and the complete visible sequence.
- Do not move keyboard focus automatically or announce every autoplay transition through a live region.
- Provide an accessible HTML explanation of the sequence. Touch interaction must work without hover.
- Progress segments indicate scene timing, not network loading, application completion or measured impact.
- Avoid autoplay video, audio, continuous decorative motion, scroll hijacking and heavy animation dependencies. Keep existing feed-media autoplay rules intact.

## 6. Use a compact page narrative

Each section should communicate one distinct idea. Aim for a headline and one short supporting sentence; put useful detail on demand. Keep task-critical requirements visible even when shortening copy.

### Hero and illustrated journey

Give the message, two audience paths and story visual priority. Avoid a large introductory paragraph, unrelated floating cards, ornamental statistics or a second hero illustration elsewhere.

### Discover something to do

Show up to three genuine opportunities using existing data. Prioritise the activity, NGO, place, date and a clear detail-page link. Keep descriptions short and show verification only when actually available.

Use truthful loading, empty and error states with recovery. If only demonstration/seed content is available, distinguish it explicitly; never present invented listings as live opportunities. The illustrative story should remain useful independently of API availability.

Integrate causes as a compact, labelled discovery control using the existing category catalogue. Avoid another full-screen grid competing with the story. Additional categories can be revealed on demand.

### Find where help is happening

Retain the India map only if it adds useful discovery. Use accurate existing geometry, actual directory records, honest city-level placement, accessible location alternatives and meaningful links.

Never populate a reach map with fictional NGOs, inferred activity or unsupported coverage. If suitable live locations are unavailable, use an unmarked geographic visual with an honest discovery/empty state, or a simpler location search. Illustration may express nationwide purpose; markers must represent supported data.

### Trust at a glance

Use a few clear visual cues such as document review, NGO application decisions and participation records, with concise labels. Put fuller explanations in accessible disclosures.

Keep distinctions accurate: document review does not guarantee conduct; an application is not an acceptance; NGO reports are not independently audited impact; payment receipts are not 80G certificates. Do not turn secondary features into a long public-facing feature inventory.

### Final invitation and footer

Close with one concise invitation and the same two audience paths. Keep the footer compact and use real destinations. Avoid another oversized text section or repeated pitches after each section.

## 7. Preserve Nabhya's identity and usability

- Orange `#FF7E40` remains the main brand colour. Use existing dark labels on orange fills and darker orange ink for text; do not restore green as the main theme.
- Retain the real wordmark, warm neutrals, established typography and coherent icon family. Evaluate typography for readability rather than replacing fonts for novelty.
- Give illustrations more visual weight than supporting copy. Use warm, distinctive community scenes rather than generic business avatars, emojis or decorative botanical repetitions.
- Keep primary actions recognisable, labels readable, touch targets generous, and focus states visible.
- Apply the skill's task hierarchy, state coverage, feedback, consistency, spacing and progressive-disclosure rules. Mark states that are not applicable rather than inventing extra controls.
- Use semantic HTML and logical headings. Preserve a useful story and CTA when motion is disabled.

## 8. Implementation and verification

- Work in the existing components and routes. Preserve authentication, onboarding, application and acceptance behavior. Do not duplicate these systems for the landing page.
- Reuse existing dependencies and tokens. Keep illustration assets and timing logic modular. Do not modify unrelated product screens.
- Keep this low-resource: reuse the running app, limit bundler workers, use one browser session and focused checks. Stop heavy work if the device shows overheating or sustained resource pressure. Do not run native builds or install large tooling just for visual QA.
- Inspect current dependencies and server state; do not assume earlier environment blockers still apply.
- Use Playwright for focused verification when feasible. Check the actual Expo page as well as any isolated visual preview; clearly distinguish their coverage.
- Verify navigation/hash behavior first, then desktop/tablet/mobile layouts, each story stage, autoplay timing, pause/resume, manual selection, visibility pause, reduced motion, keyboard access, real-data states and CTA destinations.
- Run appropriate existing checks and meaningful focused tests. Fix regressions introduced by this work and report unrelated failures accurately.
- Summarise what changed, what was actually checked and any remaining limitations. Include screenshots if feasible. Never report the full application as tested based only on a component preview.

## Acceptance criteria

- A visitor can identify Nabhya's purpose and the primary action within a few seconds.
- Posting, discovery, applying, acceptance and real-world participation read as one connected journey before the first autoplay cycle completes.
- Autoplay is understandable, controllable, lightweight and optional for reduced-motion users.
- The page is substantially lighter in copy without hiding eligibility, trust or decision states.
- Same-page links never expose a dark gap, lose the header unexpectedly or strand content outside the intended scroll area.
- The orange brand is consistent, opportunity/location information is honest, and all audience paths lead to working existing flows.

**Let the visual demonstrate the simplicity. Make the underlying navigation equally dependable.**
