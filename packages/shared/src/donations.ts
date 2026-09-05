import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

export const donationStatusSchema = z.enum([
	"PENDING",
	"COMPLETED",
	"FAILED",
	"REFUNDED",
]);

export type DonationStatus = z.infer<typeof donationStatusSchema>;

/** ₹10 minimum, ₹5,00,000 maximum — both in paise. */
export const MIN_DONATION_MINOR = 1_000;
export const MAX_DONATION_MINOR = 50_000_000;

export const createDonationSchema = z.object({
	organizationId: z.uuid(),
	/**
	 * Minor units (paise). Integer-only so no float rounding can ever reach the
	 * ledger — the client sends paise, never rupees.
	 */
	amountMinor: z.coerce
		.number()
		.int("Enter a whole amount")
		.min(MIN_DONATION_MINOR, "Minimum donation is ₹10")
		.max(MAX_DONATION_MINOR, "Please contact the NGO directly for this amount"),
	message: optionalText(500),
	isAnonymous: z.boolean().default(false),
	/** Required for guests; ignored when signed in. */
	donorName: optionalText(100),
	donorEmail: z.email("Enter a valid email").optional(),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;

export interface DonationCheckout {
	donationId: string;
	/** Provider-hosted payment page the client opens. */
	checkoutUrl: string;
	amountMinor: number;
	currency: string;
}

export const donationQuerySchema = paginationQuerySchema.extend({
	status: donationStatusSchema.optional(),
	organizationId: z.uuid().optional(),
});

export type DonationQuery = z.infer<typeof donationQuerySchema>;

export interface DonationStats {
	totalMinor: number;
	completedCount: number;
	pendingCount: number;
	donorCount: number;
}

/** Formats paise as ₹ for display. Amounts are integers everywhere else. */
export function formatMinor(amountMinor: number, currency = "INR"): string {
	const major = amountMinor / 100;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency,
		maximumFractionDigits: major % 1 === 0 ? 0 : 2,
	}).format(major);
}

/** Suggested amounts on the donate sheet, in paise. */
export const DONATION_PRESETS_MINOR = [50_000, 100_000, 250_000, 500_000];
