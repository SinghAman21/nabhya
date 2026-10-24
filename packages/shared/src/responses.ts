import { z } from "zod";
import { donationStatusSchema } from "./donations";

/**
 * Runtime contracts for what the API *returns*.
 *
 * Requests have always been validated (`ZodValidationPipe` on the server,
 * the same schema in the form). Responses were only TypeScript types on the
 * client, so a renamed or dropped field compiled fine and failed as
 * `undefined` deep in a screen. These close that gap where it matters, in
 * three layers:
 *
 * 1. **Every response** is checked for the `{ success, data, timestamp }`
 *    envelope (`apiEnvelopeSchema`) - the one shape all 147 routes share.
 * 2. **Every page** is checked for `{ items, meta }` (`paginatedSchema`), so a
 *    list can never silently page forever or stop after one page.
 * 3. **The payloads money and routing depend on** have a full schema below:
 *    onboarding status (decides which app a user lands in), checkout and
 *    receipts, exports and the superadmin ledger.
 *
 * Objects are `looseObject`: an extra field the client does not know yet is
 * not drift, only a missing or mistyped one is. Dates are ISO strings because
 * that is what JSON carries. The server specs parse real service output
 * through the same schemas (after a JSON round trip), so drift fails CI before
 * it reaches a phone.
 */

const isoDateTime = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "Expected an ISO date-time string",
	});

/** Any response contract - what the client's `http` helpers accept. */
export type ResponseContract = z.ZodType;

export const apiEnvelopeSchema = z.looseObject({
	success: z.literal(true),
	data: z.unknown(),
	timestamp: z.string(),
});

export const paginationMetaSchema = z.looseObject({
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int().min(0),
	totalPages: z.number().int().min(0),
	hasMore: z.boolean(),
});

/** A page of rows; `item` defaults to "any object" for lists without one. */
export function paginatedSchema<T extends z.ZodType>(item?: T) {
	return z.looseObject({
		items: z.array(item ?? z.looseObject({})),
		meta: paginationMetaSchema,
	});
}

export const onboardingStatusResponseSchema = z.looseObject({
	role: z.string().nullable(),
	needsRoleSelection: z.boolean(),
	isOnboarded: z.boolean(),
	organization: z
		.looseObject({
			id: z.string(),
			organizationName: z.string(),
			verificationStatus: z.string().nullable(),
			status: z.string().nullable(),
			statusReason: z.string().nullable(),
		})
		.nullable(),
	verificationStatus: z.string().nullable(),
});

export const donationCheckoutResponseSchema = z.looseObject({
	donationId: z.string(),
	checkoutUrl: z.string().optional(),
	orderId: z.string().optional(),
	razorpayKeyId: z.string().optional(),
	amountMinor: z.number().int().positive(),
	currency: z.string(),
});

export const donationReceiptResponseSchema = z.looseObject({
	id: z.string(),
	receiptNumber: z.string().nullable(),
	amountMinor: z.number().int(),
	currency: z.string(),
	status: donationStatusSchema,
	completedAt: isoDateTime.nullable(),
	donorName: z.string().nullable(),
	donorEmail: z.string().nullable(),
	organizationName: z.string(),
	organizationCity: z.string().nullable(),
	organizationRegistration: z.string().nullable(),
	paymentReference: z.string().nullable(),
});

export const signedUrlResponseSchema = z.looseObject({
	url: z.string().min(1),
});

export const exportFileResponseSchema = z.looseObject({
	url: z.string().min(1),
	fileName: z.string(),
	rowCount: z.number().int().min(0),
	truncated: z.boolean(),
});

export const adminDonationRowSchema = z.looseObject({
	id: z.string(),
	amountMinor: z.number().int(),
	currency: z.string(),
	status: donationStatusSchema,
	receiptNumber: z.string().nullable(),
	providerPaymentId: z.string().nullable(),
	provider: z.string(),
	isAnonymous: z.boolean(),
	donorUserId: z.string().nullable(),
	donorName: z.string().nullable(),
	donorEmail: z.string().nullable(),
	message: z.string().nullable(),
	failureReason: z.string().nullable(),
	createdAt: isoDateTime,
	completedAt: isoDateTime.nullable(),
	organization: z.looseObject({ id: z.string(), organizationName: z.string() }),
});

export const adminDonationSummarySchema = z.looseObject({
	completedMinor: z.number(),
	completedCount: z.number().int(),
	pendingCount: z.number().int(),
	failedCount: z.number().int(),
	refundedMinor: z.number(),
	refundedCount: z.number().int(),
	donorCount: z.number().int(),
});

export const adminDonationLedgerResponseSchema = paginatedSchema(
	adminDonationRowSchema,
).extend({ summary: adminDonationSummarySchema });

/** Thrown (in development) when a response breaks its contract. */
export class ResponseContractError extends Error {
	constructor(
		readonly url: string,
		readonly issues: z.core.$ZodIssue[],
	) {
		super(
			`Response from ${url} broke its contract: ${issues
				.slice(0, 3)
				.map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
				.join("; ")}`,
		);
		this.name = "ResponseContractError";
	}
}
