import { z } from "zod";
import { phoneSchema } from "./common";

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;

export const RAZORPAY_ONBOARDING_STATUSES = [
	"NOT_STARTED",
	"SUBMITTED",
	"UNDER_REVIEW",
	"ACTIVATED",
	"NEEDS_CLARIFICATION",
	"REJECTED",
	"SUSPENDED",
] as const;

export const razorpayOnboardingStatusSchema = z.enum(
	RAZORPAY_ONBOARDING_STATUSES,
);

export type RazorpayOnboardingStatus = z.infer<
	typeof razorpayOnboardingStatusSchema
>;

export const BUSINESS_TYPES = ["trust", "society", "section8", "ngo"] as const;
export const businessTypeSchema = z.enum(BUSINESS_TYPES);
export type BusinessType = z.infer<typeof businessTypeSchema>;

/**
 * Payload sent by an NGO to submit their direct bank account and KYC profile.
 */
export const createPayoutProfileSchema = z
	.object({
		legalEntityName: z
			.string()
			.trim()
			.min(2, "Legal entity name must be at least 2 characters")
			.max(150, "Legal entity name must be under 150 characters"),
		businessType: businessTypeSchema,
		pan: z
			.string()
			.trim()
			.toUpperCase()
			.regex(PAN_REGEX, "Enter a valid 10-character PAN (e.g. AAATP1234F)"),

		// Bank Details
		accountHolderName: z
			.string()
			.trim()
			.min(2, "Account holder name must be at least 2 characters")
			.max(120, "Account holder name must be under 120 characters"),
		bankAccountNumber: z
			.string()
			.trim()
			.regex(BANK_ACCOUNT_REGEX, "Bank account number must be 9 to 18 digits"),
		confirmBankAccountNumber: z.string().trim(),
		ifsc: z
			.string()
			.trim()
			.toUpperCase()
			.regex(IFSC_REGEX, "Enter a valid 11-character IFSC (e.g. HDFC0001234)"),
		bankName: z.string().trim().max(100).optional(),
		bankBranch: z.string().trim().max(100).optional(),

		// Primary Stakeholder / Authorised Signatory (Mandatory for Razorpay Route KYC)
		signatoryName: z
			.string()
			.trim()
			.min(2, "Signatory name must be at least 2 characters")
			.max(100, "Signatory name must be under 100 characters"),
		signatoryEmail: z.email("Enter a valid email address"),
		signatoryPhone: phoneSchema,
		signatoryDob: z
			.string()
			.trim()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD")
			.optional(),
		signatoryPan: z
			.string()
			.trim()
			.toUpperCase()
			.regex(PAN_REGEX, "Signatory PAN must be a valid 10-character PAN")
			.optional(),
		signatoryAddress: z
			.string()
			.trim()
			.min(5, "Address must be at least 5 characters")
			.max(500, "Address must be under 500 characters")
			.optional(),
	})
	.refine((data) => data.bankAccountNumber === data.confirmBankAccountNumber, {
		message: "Bank account numbers do not match",
		path: ["confirmBankAccountNumber"],
	});

export type CreatePayoutProfileInput = z.infer<
	typeof createPayoutProfileSchema
>;

/**
 * Public/Masked representation returned to the client.
 * Never leaks the full bank account number.
 */
export const payoutProfileViewSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string().uuid(),
	legalEntityName: z.string(),
	businessType: z.string(),
	panMasked: z.string(),
	bankAccountLast4: z.string(),
	ifsc: z.string(),
	bankName: z.string().nullable(),
	bankBranch: z.string().nullable(),
	accountHolderName: z.string(),
	signatoryName: z.string(),
	signatoryEmail: z.string(),
	signatoryPhone: z.string(),
	razorpayAccountId: z.string().nullable(),
	razorpayStatus: razorpayOnboardingStatusSchema,
	statusReason: z.string().nullable(),
	requirementsDue: z.string().nullable(),
	isPennyDropVerified: z.boolean(),
	pennyDropRegisteredName: z.string().nullable(),
	activatedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type PayoutProfileView = z.infer<typeof payoutProfileViewSchema>;
