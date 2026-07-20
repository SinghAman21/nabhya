import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

export const eventStatusSchema = z.enum([
	"DRAFT",
	"PUBLISHED",
	"CANCELLED",
	"COMPLETED",
]);

export const applicationStatusSchema = z.enum([
	"PENDING",
	"ACCEPTED",
	"REJECTED",
	"WITHDRAWN",
]);

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

// ─── Create / update ─────────────────────────────────────────────────────────

const eventBaseSchema = z.object({
	title: z
		.string()
		.trim()
		.min(4, "Title must be at least 4 characters")
		.max(140, "Title must be under 140 characters"),
	description: z
		.string()
		.trim()
		.min(20, "Describe the event in at least 20 characters")
		.max(4000, "Description must be under 4000 characters"),
	coverImage: optionalText(500),
	venue: optionalText(160),
	address: optionalText(500),
	city: z.string().trim().min(2, "City is required").max(80),
	state: z.string().trim().min(2, "State is required").max(80),
	startAt: z.coerce.date(),
	endAt: z.coerce.date(),
	applicationDeadline: z.coerce.date().optional(),
	volunteersNeeded: z.coerce
		.number()
		.int("Must be a whole number")
		.min(1, "At least 1 volunteer")
		.max(10000, "That seems too high"),
	status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});

/**
 * Cross-field rules live here rather than in the service so the wizard shows
 * them inline and the API rejects the same payloads.
 */
interface EventDateFields {
	startAt?: Date;
	endAt?: Date;
	applicationDeadline?: Date;
}

const endAfterStart = (v: EventDateFields) =>
	!v.startAt || !v.endAt || v.endAt >= v.startAt;

const deadlineBeforeStart = (v: EventDateFields) =>
	!v.applicationDeadline || !v.startAt || v.applicationDeadline <= v.startAt;

const END_AFTER_START = {
	message: "End time must be after the start time",
	path: ["endAt"],
};
const DEADLINE_BEFORE_START = {
	message: "Deadline must fall on or before the start time",
	path: ["applicationDeadline"],
};

export const createEventSchema = eventBaseSchema
	.refine(endAfterStart, END_AFTER_START)
	.refine(deadlineBeforeStart, DEADLINE_BEFORE_START);

export const updateEventSchema = eventBaseSchema
	.partial()
	.extend({ status: eventStatusSchema.optional() })
	.refine(endAfterStart, END_AFTER_START)
	.refine(deadlineBeforeStart, DEADLINE_BEFORE_START);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ─── Queries ─────────────────────────────────────────────────────────────────

export const publicEventQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	city: z.string().trim().max(80).optional(),
	organizationId: z.uuid().optional(),
	/** `upcoming` hides events whose start time has already passed. */
	when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
});

export type PublicEventQuery = z.infer<typeof publicEventQuerySchema>;

export const orgEventQuerySchema = paginationQuerySchema.extend({
	status: eventStatusSchema.optional(),
});

export type OrgEventQuery = z.infer<typeof orgEventQuerySchema>;

// ─── Applications ────────────────────────────────────────────────────────────

export const applyToEventSchema = z.object({
	message: optionalText(500),
});

export type ApplyToEventInput = z.infer<typeof applyToEventSchema>;

export const reviewApplicationSchema = z.object({
	status: z.enum(["ACCEPTED", "REJECTED"]),
	reviewNote: optionalText(500),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;

export const applicationQuerySchema = paginationQuerySchema.extend({
	status: applicationStatusSchema.optional(),
});

export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;
