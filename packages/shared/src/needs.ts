import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

/**
 * WANT  - the organization is asking for something.
 * OFFER - the organization has surplus it wants to give away.
 */
export const needTypeSchema = z.enum(["WANT", "OFFER"]);
export const needStatusSchema = z.enum(["OPEN", "FULFILLED", "CLOSED"]);
export const needUrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const pledgeStatusSchema = z.enum([
	"PENDING",
	"ACCEPTED",
	"REJECTED",
	"COMPLETED",
	"CANCELLED",
]);

export type NeedType = z.infer<typeof needTypeSchema>;
export type NeedStatus = z.infer<typeof needStatusSchema>;
export type NeedUrgency = z.infer<typeof needUrgencySchema>;
export type PledgeStatus = z.infer<typeof pledgeStatusSchema>;

export const NEED_TYPE_LABELS: Record<NeedType, string> = {
	WANT: "We need",
	OFFER: "We're giving",
};

// ─── Create / update ─────────────────────────────────────────────────────────

const needBaseSchema = z.object({
	type: needTypeSchema,
	title: z
		.string()
		.trim()
		.min(4, "Title must be at least 4 characters")
		.max(140, "Title must be under 140 characters"),
	description: z
		.string()
		.trim()
		.min(10, "Add at least 10 characters of detail")
		.max(2000, "Description must be under 2000 characters"),
	coverImage: optionalText(500),
	quantity: z.coerce
		.number()
		.int("Must be a whole number")
		.min(1, "Quantity must be at least 1")
		.max(1000000, "That seems too high")
		.optional(),
	unit: optionalText(40),
	urgency: needUrgencySchema.default("MEDIUM"),
	city: z.string().trim().min(2, "City is required").max(80),
	state: z.string().trim().min(2, "State is required").max(80),
	expiresAt: z.coerce.date().optional(),
});

export const createNeedSchema = needBaseSchema;

export const updateNeedSchema = needBaseSchema.partial().extend({
	status: needStatusSchema.optional(),
});

export type CreateNeedInput = z.infer<typeof createNeedSchema>;
export type UpdateNeedInput = z.infer<typeof updateNeedSchema>;

// ─── Queries ─────────────────────────────────────────────────────────────────

export const publicNeedQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	type: needTypeSchema.optional(),
	urgency: needUrgencySchema.optional(),
	city: z.string().trim().max(80).optional(),
	organizationId: z.uuid().optional(),
});

export type PublicNeedQuery = z.infer<typeof publicNeedQuerySchema>;

export const orgNeedQuerySchema = paginationQuerySchema.extend({
	type: needTypeSchema.optional(),
	status: needStatusSchema.optional(),
});

export type OrgNeedQuery = z.infer<typeof orgNeedQuerySchema>;

// ─── Pledges ─────────────────────────────────────────────────────────────────

export const createPledgeSchema = z.object({
	quantity: z.coerce.number().int().min(1).max(1000000).optional(),
	message: optionalText(500),
});

export type CreatePledgeInput = z.infer<typeof createPledgeSchema>;

export const reviewPledgeSchema = z.object({
	status: z.enum(["ACCEPTED", "REJECTED", "COMPLETED"]),
	reviewNote: optionalText(500),
});

export type ReviewPledgeInput = z.infer<typeof reviewPledgeSchema>;
