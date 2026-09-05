import { z } from "zod";
import { paginationQuerySchema } from "./common";

/**
 * The volunteer home feed: needs, offers, events and NGO updates in one list.
 *
 * Tabs are *lenses over the same feed*, not separate lists — each is a filter
 * and a sort the server applies, so page 2 of any tab is well defined.
 *
 * - `for_you`   — ranked by the volunteer's interests (their categories), their
 *                 city, and urgency. Anonymous callers get urgency + recency.
 * - `following` — only NGOs the volunteer has bookmarked. Needs auth.
 * - `trending`  — most pledges / applications in the last 7 days.
 * - `urgent`    — HIGH-urgency needs and events closing within 3 days.
 */
export const feedTabSchema = z.enum([
	"for_you",
	"following",
	"trending",
	"urgent",
]);

export type FeedTab = z.infer<typeof feedTabSchema>;

export const FEED_TAB_LABELS: Record<FeedTab, string> = {
	for_you: "For you",
	following: "Following",
	trending: "Trending",
	urgent: "Urgent",
};

export const feedKindSchema = z.enum(["need", "event", "story"]);

export type FeedKind = z.infer<typeof feedKindSchema>;

export const feedQuerySchema = paginationQuerySchema.extend({
	tab: feedTabSchema.default("for_you"),
	/** A cause category — the volunteer's "vertical". */
	/** Narrow to one kind of post — search uses this for its result tabs. */
	kind: feedKindSchema.optional(),
	categoryId: z.uuid().optional(),
	city: z.string().trim().max(80).optional(),
	search: z.string().trim().max(120).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
