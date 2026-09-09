/**
 * The feed card's public surface.
 *
 * The card was one 1300-line file holding the shell, the header, four kinds of
 * body, two fact blocks, three pill variants, a CTA and two near-identical
 * reaction buttons. It now lives in `components/feed/card/`, one concern per
 * file, the way `components/composer/` is laid out — so a change to the kicker
 * or the reaction bar touches a file whose name says so.
 *
 * This module stays as the import path because three screens and the need
 * preview drawer already point at it, and the split is not their business.
 */
export {
	CardKicker,
	FeedCard,
	type FeedCardActions,
	NeedFacts,
	toPublicNeed,
} from "./card";
