import { z } from "zod";
import { paginationQuerySchema } from "./common";
import type { UploadTicketResponse } from "./uploads";

export const MAX_FEED_MEDIA = 4;
export const MAX_FEED_MEDIA_BYTES = 25 * 1024 * 1024;

export const feedMediaContentTypeSchema = z.enum([
	"image/jpeg",
	"image/png",
	"image/webp",
	"video/mp4",
	"video/quicktime",
]);

export const feedMediaUploadSchema = z.object({
	fileName: z.string().trim().min(1).max(200),
	contentType: feedMediaContentTypeSchema,
	size: z.coerce
		.number()
		.int()
		.min(1, "File appears to be empty")
		.max(MAX_FEED_MEDIA_BYTES, "Feed media must be under 25 MB"),
});

export const createFeedMediaIntentsSchema = z.object({
	files: z.array(feedMediaUploadSchema).min(1).max(MAX_FEED_MEDIA),
});

export type CreateFeedMediaIntentsInput = z.infer<
	typeof createFeedMediaIntentsSchema
>;

export interface FeedMediaIntentsResponse {
	mediaFolder: string;
	tickets: UploadTicketResponse[];
}

export const createFeedPostSchema = z
	.object({
		text: z.string().trim().min(1, "Write something to share").max(5000),
		mediaFolder: z
			.string()
			.trim()
			.regex(/^\d{12}-[a-z0-9]{6}$/)
			.optional(),
		mediaKeys: z.array(z.string().trim().min(1).max(500)).max(MAX_FEED_MEDIA),
	})
	.refine((value) => value.mediaKeys.length === 0 || value.mediaFolder, {
		message: "Create media upload intents before publishing media.",
		path: ["mediaFolder"],
	});

export type CreateFeedPostInput = z.infer<typeof createFeedPostSchema>;

// ─── Feed engagement ─────────────────────────────────────────────────────────

export const feedItemTypeSchema = z.enum([
	"POST",
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
]);

export type FeedItemType = z.infer<typeof feedItemTypeSchema>;

export const feedInteractionTypeSchema = z.enum([
	"LIKE",
	"SAVE",
	"SHARE",
	"IMPRESSION",
]);

export type FeedInteractionType = z.infer<typeof feedInteractionTypeSchema>;

export const feedItemTargetSchema = z.object({
	targetType: feedItemTypeSchema,
	targetId: z.uuid("Invalid feed item identifier"),
});

export type FeedItemTarget = z.infer<typeof feedItemTargetSchema>;

export const createFeedInteractionSchema = feedItemTargetSchema.extend({
	interactionType: feedInteractionTypeSchema,
});

export type CreateFeedInteractionInput = z.infer<
	typeof createFeedInteractionSchema
>;

export const createFeedCommentSchema = feedItemTargetSchema.extend({
	body: z
		.string()
		.trim()
		.min(1, "Write a comment")
		.max(2000, "Comment must be under 2000 characters"),
});

export type CreateFeedCommentInput = z.infer<typeof createFeedCommentSchema>;

export const updateFeedCommentSchema = z.object({
	body: z
		.string()
		.trim()
		.min(1, "Write a comment")
		.max(2000, "Comment must be under 2000 characters"),
});

export type UpdateFeedCommentInput = z.infer<typeof updateFeedCommentSchema>;

export const feedCommentsQuerySchema = paginationQuerySchema;
export type FeedCommentsQuery = z.infer<typeof feedCommentsQuerySchema>;

// ─── Feed views ───────────────────────────────────────────────────────────────

/**
 * Narrowing every feed view accepts. The ranking service scores a candidate
 * pool and these cut the pool before scoring, so page N of a filtered view is
 * as well defined as page N of the plain one.
 *
 * - `kind`       — one item type only (the search page's result tabs).
 * - `categoryId` — only NGOs tagged with this cause (the volunteer's vertical).
 * - `city`       — case-insensitive substring match on the item's city, falling
 *                  back to the NGO's city.
 * - `search`     — substring match over title / text / description / NGO name.
 * - `urgent`     — HIGH-urgency needs and events starting within three days.
 */
export const feedFilterSchema = z.object({
	kind: feedItemTypeSchema.optional(),
	categoryId: z.uuid().optional(),
	city: z.string().trim().max(80).optional(),
	search: z.string().trim().max(120).optional(),
	urgent: z
		.union([z.boolean(), z.enum(["true", "false"])])
		.transform((value) => value === true || value === "true")
		.optional(),
});

export type FeedFilterQuery = z.infer<typeof feedFilterSchema>;

/** Personalized recommendations from local and engagement signals. */
export const forYouFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type ForYouFeedQuery = z.infer<typeof forYouFeedQuerySchema>;

/** Items ranked by recent interaction volume. */
export const trendingFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type TrendingFeedQuery = z.infer<typeof trendingFeedQuerySchema>;

/** Items published by organizations the user follows. */
export const followingFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type FollowingFeedQuery = z.infer<typeof followingFeedQuerySchema>;

/** Backward-compatible generic chronological feed query. */
export const feedQuerySchema = paginationQuerySchema;
export type FeedQuery = z.infer<typeof feedQuerySchema>;

// ─── Client vocabulary ───────────────────────────────────────────────────────

/**
 * The lenses the volunteer home offers. Three map to the three ranked views;
 * `urgent` is the For You view with the `urgent` filter on.
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
