import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const upsertReviewSchema = z.object({
	rating: z.coerce
		.number()
		.int("Pick a whole number of stars")
		.min(1, "Rating must be at least 1")
		.max(5, "Rating cannot exceed 5"),
	body: optionalText(1000),
});

export type UpsertReviewInput = z.infer<typeof upsertReviewSchema>;

export const replyToReviewSchema = z.object({
	reply: z
		.string()
		.trim()
		.min(1, "Write a reply")
		.max(1000, "Reply must be under 1000 characters"),
});

export type ReplyToReviewInput = z.infer<typeof replyToReviewSchema>;

export const reviewQuerySchema = paginationQuerySchema.extend({
	organizationId: z.uuid().optional(),
});

export type ReviewQuery = z.infer<typeof reviewQuerySchema>;

export interface ReviewSummary {
	average: number;
	count: number;
	/** Star counts keyed 1–5, for the distribution bars. */
	distribution: Record<string, number>;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationTypeSchema = z.enum([
	"APPLICATION_ACCEPTED",
	"APPLICATION_REJECTED",
	"NEW_APPLICATION",
	"PLEDGE_ACCEPTED",
	"PLEDGE_REJECTED",
	"NEW_PLEDGE",
	"ORG_VERIFIED",
	"ORG_REJECTED",
	"DOCUMENT_VERIFIED",
	"DOCUMENT_REJECTED",
	"CERTIFICATE_ISSUED",
	"DONATION_RECEIVED",
	"NEW_REVIEW",
	"BROADCAST",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationQuerySchema = paginationQuerySchema.extend({
	unreadOnly: z.coerce.boolean().default(false),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const markReadSchema = z.object({
	/** Omit to mark everything read. */
	ids: z.array(z.uuid()).max(200).optional(),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

export const broadcastSchema = z.object({
	title: z.string().trim().min(3, "Add a title").max(140),
	body: z.string().trim().min(3, "Add a message").max(1000),
	/** Restricts the blast; omit to reach everyone. */
	audience: z.enum(["ALL", "VOLUNTEERS", "ORGANISATIONS"]).default("ALL"),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
