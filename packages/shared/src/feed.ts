import { z } from "zod";
import { paginationQuerySchema } from "./common";
import { needTypeSchema, needUrgencySchema } from "./needs";
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

export const postTagSchema = z.enum([
	"POST",
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
	"URGENT",
]);
export type PostTag = z.infer<typeof postTagSchema>;

export const createFeedPostSchema = z
	.object({
		text: z.string().trim().min(1, "Write something to share").max(5000),
		tag: postTagSchema.default("POST"),
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

// ─── Post engagement ─────────────────────────────────────────────────────────

export const feedInteractionTypeSchema = z.enum([
	"LIKE",
	"SAVE",
	"SHARE",
	"IMPRESSION",
]);

export type FeedInteractionType = z.infer<typeof feedInteractionTypeSchema>;

export const postTargetSchema = z.object({
	tag: postTagSchema,
	postId: z.uuid("Invalid post identifier"),
});

export type PostTarget = z.infer<typeof postTargetSchema>;

export const createFeedInteractionSchema = postTargetSchema.extend({
	interactionType: feedInteractionTypeSchema,
});

export type CreateFeedInteractionInput = z.infer<
	typeof createFeedInteractionSchema
>;

export const createFeedCommentSchema = postTargetSchema.extend({
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
 * - `categoryIds` — only NGOs tagged with at least one selected cause.
 * - `city`       — case-insensitive substring on the item's city, falling back
 *                  to the NGO's city.
 * - `search`     — substring over title / text / description / NGO name.
 * - `urgent`     — HIGH-urgency needs, urgent posts, events within three days.
 */
export const feedFilterSchema = z.object({
	kind: postTagSchema.optional(),
	categoryIds: z
		.union([z.uuid(), z.array(z.uuid()).min(1)])
		.transform((value) => (Array.isArray(value) ? value : [value]))
		.optional(),
	city: z.string().trim().max(80).optional(),
	search: z.string().trim().max(120).optional(),
	urgent: z
		.union([z.boolean(), z.enum(["true", "false"])])
		.transform((value) => value === true || value === "true")
		.optional(),
	needType: needTypeSchema.optional(),
	needUrgency: needUrgencySchema.optional(),
});
export type FeedFilterQuery = z.infer<typeof feedFilterSchema>;

export const forYouFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type ForYouFeedQuery = z.infer<typeof forYouFeedQuerySchema>;

export const trendingFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type TrendingFeedQuery = z.infer<typeof trendingFeedQuerySchema>;

export const followingFeedQuerySchema = paginationQuerySchema.extend(
	feedFilterSchema.shape,
);
export type FollowingFeedQuery = z.infer<typeof followingFeedQuerySchema>;

export const feedQuerySchema = paginationQuerySchema;
export type FeedQuery = z.infer<typeof feedQuerySchema>;

// ─── Client vocabulary ───────────────────────────────────────────────────────

/** The lenses the volunteer home offers; `urgent` is For You + the urgent filter. */
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

// Backward-compatible type/schema aliases during API migration.
export const feedItemTypeSchema = postTagSchema;
export const feedItemTargetSchema = postTargetSchema;
export type FeedItemType = PostTag;
export type FeedItemTarget = PostTarget;
