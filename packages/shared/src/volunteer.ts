import { z } from "zod";
import { optionalText } from "./common";

/**
 * Volunteer onboarding mirrors the org wizard's shape: a small set of steps,
 * each with its own schema so the client can validate per screen, plus a merged
 * payload for the single submit at the end.
 */
export const volunteerProfileStepSchema = z.object({
	fullName: z
		.string()
		.trim()
		.min(2, "Enter your full name")
		.max(100, "Name must be under 100 characters"),
	phone: z
		.string()
		.trim()
		.min(10, "Enter a valid phone number")
		.max(15, "Enter a valid phone number"),
});

export const volunteerLocationStepSchema = z.object({
	city: z.string().trim().min(2, "City is required").max(80),
	state: z.string().trim().min(2, "State is required").max(80),
});

export const volunteerInterestsStepSchema = z.object({
	categoryIds: z
		.array(z.uuid())
		.max(5, "Pick up to 5 causes")
		.optional()
		.default([]),
	bio: optionalText(500),
});

export const completeVolunteerOnboardingSchema = volunteerProfileStepSchema
	.extend(volunteerLocationStepSchema.shape)
	.extend(volunteerInterestsStepSchema.shape);

export type VolunteerProfileStep = z.infer<typeof volunteerProfileStepSchema>;
export type VolunteerLocationStep = z.infer<typeof volunteerLocationStepSchema>;
export type VolunteerInterestsStep = z.infer<
	typeof volunteerInterestsStepSchema
>;
export type CompleteVolunteerOnboardingInput = z.infer<
	typeof completeVolunteerOnboardingSchema
>;

export const userDocumentTypeSchema = z.enum(["AADHAR_CARD", "OTHER"]);

export const uploadUserDocumentSchema = z.object({
	documentType: userDocumentTypeSchema,
	documentKey: z.string().trim().min(1, "Upload a file first").max(500),
});

export type UploadUserDocumentInput = z.infer<typeof uploadUserDocumentSchema>;

export const updateUserProfileSchema = z.object({
	fullName: z.string().trim().min(2).max(100).optional(),
	phone: z.string().trim().min(10).max(15).optional(),
	profileImage: optionalText(500),
	bio: optionalText(500),
	city: z.string().trim().min(2).max(80).optional(),
	state: z.string().trim().min(2).max(80).optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
