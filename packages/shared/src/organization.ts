import { z } from "zod";
import { optionalText, phoneSchema } from "./common";
import {
	orgCausesStepSchema,
	step1BasicInfoSchema,
	step2AddressSchema,
	step4TeamSchema,
} from "./onboarding";

/**
 * The org onboarding wizard collects its data step by step and keeps it in the
 * client store; this is the single payload it submits at the end. Built by
 * merging the per-step schemas so the wizard and the API can never drift.
 *
 * Every field the team/causes steps add is optional in its own step schema, so
 * there is no `.partial()` here - a blank optional field arrives as absent,
 * not as a zero that the range checks then reject.
 */
export const completeOrgOnboardingSchema = step1BasicInfoSchema
	.extend(step2AddressSchema.shape)
	.extend(orgCausesStepSchema.shape)
	.extend(step4TeamSchema.shape);

export type CompleteOrgOnboardingInput = z.infer<
	typeof completeOrgOnboardingSchema
>;

/** What the client sends: raw form values. See the volunteer counterpart. */
export type CompleteOrgOnboardingPayload = z.input<
	typeof completeOrgOnboardingSchema
>;

/** Wizard values → `org_type` enum stored in Postgres. */
export const ORG_TYPE_TO_ENUM = {
	trust: "TRUST",
	society: "SOCIETY",
	section8: "SECTION_8",
	others: "OTHERS",
} as const;

export const ORG_TYPE_FROM_ENUM = {
	TRUST: "trust",
	SOCIETY: "society",
	SECTION_8: "section8",
	OTHERS: "others",
} as const;

export const updateOrganizationSchema = z.object({
	organizationName: z.string().trim().min(2).max(100).optional(),
	phone: phoneSchema.optional(),
	email: z.email("Enter a valid email").optional(),
	registrationNumber: optionalText(60),
	description: optionalText(1000),
	mission: optionalText(1000),
	vision: optionalText(1000),
	website: z.union([z.url("Enter a valid URL"), z.literal("")]).optional(),
	logo: optionalText(500),
	coverImage: optionalText(500),
	address: optionalText(500),
	city: z.string().trim().min(2).max(80).optional(),
	state: z.string().trim().min(2).max(80).optional(),
	pincode: z.string().trim().min(4).max(10).optional(),
	teamSize: z.coerce.number().int().min(1).max(100000).optional(),
	foundingYear: z.coerce
		.number()
		.int()
		.min(1900)
		.max(new Date().getFullYear())
		.optional(),
	categoryIds: z.array(z.uuid()).max(5).optional(),
	// Set from the map picker; powers "NGOs near me".
	latitude: z.coerce.number().min(-90).max(90).optional(),
	longitude: z.coerce.number().min(-180).max(180).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationDocumentTypeSchema = z.enum([
	"NGO_REGISTRATION_CERTIFICATE",
	"PAN_CARD",
	"80G_CERTIFICATE",
	"12A_CERTIFICATE",
	"GST_CERTIFICATE",
	"BANK_ACCOUNT_PROOF",
	"OTHER",
]);

export const uploadOrgDocumentSchema = z.object({
	documentType: organizationDocumentTypeSchema,
	documentKey: z.string().trim().min(1, "Upload a file first").max(500),
});

export type UploadOrgDocumentInput = z.infer<typeof uploadOrgDocumentSchema>;
