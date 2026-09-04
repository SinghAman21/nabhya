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
export const feedQuerySchema = paginationQuerySchema;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
