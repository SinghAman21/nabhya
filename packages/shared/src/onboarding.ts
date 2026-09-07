import { z } from "zod";
import {
	latitudeSchema,
	longitudeSchema,
	optionalCount,
	optionalText,
	phoneSchema,
} from "./common";

/**
 * The NGO setup wizard, one schema per step.
 *
 * Each step validates on its own screen and the merged payload
 * (`completeOrgOnboardingSchema` in `organization.ts`) is what the single
 * submit posts, so the wizard and the API cannot drift.
 */
export const step1BasicInfoSchema = z.object({
	orgName: z
		.string()
		.trim()
		.min(2, "Organization name must be at least 2 characters")
		.max(100, "Organization name must be under 100 characters"),
	phone: phoneSchema,
	orgType: z.enum(["trust", "society", "section8", "others"] as const, {
		message: "Select your organization type",
	}),
	// The single most important field for verifying an Indian NGO — a
	// superadmin checks this against the uploaded registration certificate.
	registrationNumber: z
		.string()
		.trim()
		.min(3, "Enter your registration number")
		.max(60, "That looks too long"),
});

export const step2AddressSchema = z.object({
	address: z
		.string()
		.trim()
		.min(10, "Please enter your full address")
		.max(500, "Address must be under 500 characters"),
	city: z.string().trim().min(2, "City is required").max(80),
	state: z.string().trim().min(2, "State is required").max(80),
	pincode: z
		.string()
		.trim()
		.regex(/^[1-9]\d{5}$/, "Enter a 6-digit pincode"),
	// Optional, and only ever set from the device's own location — it powers
	// "NGOs near me", which no NGO ever appears in if the only way to record
	// coordinates is an edit screen nobody opens after signing up.
	latitude: latitudeSchema.optional(),
	longitude: longitudeSchema.optional(),
});

/**
 * What the NGO works on, and in its own words.
 *
 * Causes were the gap that mattered most: `organization_categories` is what
 * the feed's "For you" lens joins through, so an NGO that finishes onboarding
 * without a single category can never be matched to a volunteer's interests.
 * The wizard is the only moment we are guaranteed to have their attention.
 */
export const orgCausesStepSchema = z.object({
	categoryIds: z
		.array(z.uuid())
		.max(5, "Pick up to 5 causes")
		.optional()
		.default([]),
	description: optionalText(500),
});

/** Team, history and public presence — every field optional. */
export const step4TeamSchema = z.object({
	teamSize: optionalCount(1, 100000, {
		min: "At least 1 member",
		max: "That seems too high",
	}),
	foundingYear: optionalCount(1900, new Date().getFullYear(), {
		min: "Enter a valid year",
		max: "Year cannot be in the future",
	}),
	website: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
});

// No `logo` here, deliberately. `ORG_LOGO` upload keys are derived from the
// caller's organization, so one cannot exist before this payload is accepted —
// the wizard holds the picked file locally and PATCHes the key onto the new
// organization afterwards. See `components/onboarding/photo-field.tsx`.

export type Step1BasicInfo = z.infer<typeof step1BasicInfoSchema>;
export type Step2Address = z.infer<typeof step2AddressSchema>;
export type OrgCausesStep = z.infer<typeof orgCausesStepSchema>;
export type Step4Team = z.infer<typeof step4TeamSchema>;
