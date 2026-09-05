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

export const forYouFeedQuerySchema = paginationQuerySchema;
export type ForYouFeedQuery = z.infer<typeof forYouFeedQuerySchema>;

export const trendingFeedQuerySchema = paginationQuerySchema;
export type TrendingFeedQuery = z.infer<typeof trendingFeedQuerySchema>;

export const followingFeedQuerySchema = paginationQuerySchema;
export type FollowingFeedQuery = z.infer<typeof followingFeedQuerySchema>;

export const feedQuerySchema = paginationQuerySchema;
export type FeedQuery = z.infer<typeof feedQuerySchema>;

// Backward-compatible type/schema aliases during API migration.
export const feedItemTypeSchema = postTagSchema;
export const feedItemTargetSchema = postTargetSchema;
export type FeedItemType = PostTag;
export type FeedItemTarget = PostTarget;
