import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";
import { PAN_REGEX } from "./payout";

export const donationStatusSchema = z.enum([
	"PENDING",
	"COMPLETED",
	"FAILED",
	"REFUNDED",
]);

export type DonationStatus = z.infer<typeof donationStatusSchema>;

/** ₹10 minimum, ₹5,00,000 maximum - both in paise. */
export const MIN_DONATION_MINOR = 1_000;
export const MAX_DONATION_MINOR = 50_000_000;

export const createDonationSchema = z
	.object({
		organizationId: z.uuid(),
		/**
		 * Minor units (paise). Integer-only so no float rounding can ever reach the
		 * ledger - the client sends paise, never rupees.
		 */
		amountMinor: z.coerce
			.number()
			.int("Enter a whole amount")
			.min(MIN_DONATION_MINOR, "Minimum donation is ₹10")
			.max(
				MAX_DONATION_MINOR,
				"Please contact the NGO directly for this amount",
			),
		message: optionalText(500),
		isAnonymous: z.boolean().default(false),
		/** Required for guests; ignored when signed in. */
		donorName: optionalText(100),
		donorEmail: z.email("Enter a valid email").optional(),
		wants80G: z.boolean().default(false),
		donorPan: z
			.string()
			.trim()
			.toUpperCase()
			.regex(PAN_REGEX, "Enter a valid 10-character PAN")
			.optional(),
		donorAddress: optionalText(500),
	})
	.refine(
		(data) => {
			if (data.wants80G && !data.donorPan) return false;
			return true;
		},
		{
			message: "PAN is required to claim an 80G tax receipt",
			path: ["donorPan"],
		},
	);

export type CreateDonationInput = z.infer<typeof createDonationSchema>;

export interface DonationCheckout {
	donationId: string;
	/** Provider-hosted payment page, present for hosted checkout providers. */
	checkoutUrl?: string;
	/** Native checkout order, present for Razorpay. */
	orderId?: string;
	razorpayKeyId?: string;
	amountMinor: number;
	currency: string;
}

export const donationQuerySchema = paginationQuerySchema.extend({
	status: donationStatusSchema.optional(),
	organizationId: z.uuid().optional(),
});

export type DonationQuery = z.infer<typeof donationQuerySchema>;

/**
 * Sorting what an organisation has received. Its own schema rather than keys on
 * `donationQuerySchema`, which a donor's own history (`/me/donations`) shares
 * and which takes no sort - a key that one route honours and the other ignores
 * is a silent no-op. Defaults to newest first, the order before sorting existed.
 *
 * `donor` sorts by the *displayed* name, so an anonymous gift sorts as no name
 * rather than by the name it hides - ordering by the real column would let the
 * row's position leak what the response blanks out.
 */
export const orgDonationSortSchema = z
	.enum(["createdAt", "amount", "donor"])
	.default("createdAt");
export type OrgDonationSort = z.infer<typeof orgDonationSortSchema>;

export const orgDonationQuerySchema = donationQuerySchema.extend({
	sort: orgDonationSortSchema,
	dir: z.enum(["asc", "desc"]).default("desc"),
});

export type OrgDonationQuery = z.infer<typeof orgDonationQuerySchema>;

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

// ─── Superadmin ledger ───────────────────────────────────────────────────────

/**
 * Filters for the platform-wide donation ledger and its CSV export.
 *
 * One schema for both so an export is exactly the rows the reviewer is looking
 * at - an export that quietly ignored a filter would hand finance a different
 * set of numbers from the one on screen. `from`/`to` are calendar days (IST),
 * inclusive, matched against when the donation was created; `search` matches
 * the donor's name or email, the receipt number and the provider's payment id.
 *
 * Unlike the NGO's own list, every status is visible by default: a ledger that
 * hid failed and pending attempts could not reconcile against the provider.
 */
export const adminDonationFilterSchema = z
	.object({
		status: donationStatusSchema.optional(),
		organizationId: z.uuid().optional(),
		from: z.iso.date().optional(),
		to: z.iso.date().optional(),
		search: z.string().trim().max(120).optional(),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, {
		message: "The start date must be on or before the end date",
		path: ["to"],
	});

export type AdminDonationFilter = z.infer<typeof adminDonationFilterSchema>;

export const adminDonationSortSchema = z
	.enum(["createdAt", "amount", "organization", "status"])
	.default("createdAt");
export type AdminDonationSort = z.infer<typeof adminDonationSortSchema>;

export const adminDonationQuerySchema = paginationQuerySchema
	.extend({
		status: donationStatusSchema.optional(),
		organizationId: z.uuid().optional(),
		from: z.iso.date().optional(),
		to: z.iso.date().optional(),
		search: z.string().trim().max(120).optional(),
		sort: adminDonationSortSchema,
		dir: z.enum(["asc", "desc"]).default("desc"),
	})
	.refine((v) => !v.from || !v.to || v.from <= v.to, {
		message: "The start date must be on or before the end date",
		path: ["to"],
	});

export type AdminDonationQuery = z.infer<typeof adminDonationQuerySchema>;

/**
 * A ledger row. Superadmins see the donor's real name and email even on an
 * anonymous gift - anonymity is a promise about the public page and the NGO,
 * not about the platform that has to answer for the money. `isAnonymous` is
 * still returned so the console can say so.
 */
export interface AdminDonationRow {
	id: string;
	amountMinor: number;
	currency: string;
	status: DonationStatus;
	receiptNumber: string | null;
	providerPaymentId: string | null;
	provider: string;
	isAnonymous: boolean;
	donorUserId: string | null;
	donorName: string | null;
	donorEmail: string | null;
	message: string | null;
	failureReason: string | null;
	createdAt: string;
	completedAt: string | null;
	organization: { id: string; organizationName: string };
}

/** Totals over the whole filtered set, not the visible page. */
export interface AdminDonationSummary {
	completedMinor: number;
	completedCount: number;
	pendingCount: number;
	failedCount: number;
	refundedMinor: number;
	refundedCount: number;
	donorCount: number;
}

/** A generated export: a short-lived link to the CSV in private storage. */
export interface ExportFile {
	url: string;
	fileName: string;
	rowCount: number;
	/** True when the row cap cut the export short; narrow the filters. */
	truncated: boolean;
}

/** Hard ceiling on one export, so a CSV is built in memory safely. */
export const MAX_EXPORT_ROWS = 50_000;

/** What an NGO exports of its own donations - the same filters as its list. */
export const orgDonationExportSchema = z.object({
	status: donationStatusSchema.optional(),
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
});

export type OrgDonationExportQuery = z.infer<typeof orgDonationExportSchema>;
