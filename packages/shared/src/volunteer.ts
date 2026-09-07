import { z } from "zod";
import {
	latitudeSchema,
	longitudeSchema,
	optionalText,
	phoneSchema,
} from "./common";

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
	phone: phoneSchema,
	/** Storage object key from `POST /api/uploads/intent`, purpose `AVATAR`. */
	profileImage: optionalText(500),
});

export const volunteerLocationStepSchema = z.object({
	city: z.string().trim().min(2, "City is required").max(80),
	state: z.string().trim().min(2, "State is required").max(80),
	// Set only from the device's own location, never typed. Feeds the same
	// proximity search the organisations use.
	latitude: latitudeSchema.optional(),
	longitude: longitudeSchema.optional(),
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

/**
 * What the client actually sends — the schema's **input** side.
 *
 * The wizard posts the raw form values ("" for an untouched optional field) and
 * lets the server normalise them, because the parse is not idempotent: an
 * `optionalText` field parses `""` into `null`, and `null` is not valid *input*
 * for it. Posting the client-parsed output therefore failed server validation
 * with "expected string, received null" on `bio` and `profileImage`. There is
 * one normaliser, and it is the one at the boundary.
 */
export type CompleteVolunteerOnboardingPayload = z.input<
	typeof completeVolunteerOnboardingSchema
>;

export const userDocumentTypeSchema = z.enum([
	"AADHAR_CARD",
	"PAN_CARD",
	"DRIVING_LICENSE",
	"VOTER_ID",
	"PASSPORT",
	"SELFIE",
	"OTHER",
]);

export type UserDocumentType = z.infer<typeof userDocumentTypeSchema>;

/**
 * The liveness selfie is the single document type that is not a government ID.
 * Every other type identifies the person against an official record; the selfie
 * is what a superadmin compares that record against.
 */
export const SELFIE_DOCUMENT_TYPE = "SELFIE" as const;

export const isSelfieDocument = (type: string): boolean =>
	type === SELFIE_DOCUMENT_TYPE;

export const isGovernmentIdDocument = (type: string): boolean =>
	type !== SELFIE_DOCUMENT_TYPE;

/** Every user document type except the liveness selfie. */
export const GOVERNMENT_ID_DOCUMENT_TYPES =
	userDocumentTypeSchema.options.filter(isGovernmentIdDocument);

/** Liveness prompts the client can issue while capturing a selfie. */
export const livenessChallengeSchema = z.enum([
	"BLINK",
	"TURN_LEFT",
	"TURN_RIGHT",
	"SMILE",
	"NOD",
]);

export type LivenessChallenge = z.infer<typeof livenessChallengeSchema>;

/**
 * Extra data attached to a user document. Only the liveness selfie uses it
 * today: which challenge was issued and an optional second frame captured mid
 * challenge, so a reviewer can see motion rather than a single still.
 */
export const userDocumentMetadataSchema = z.object({
	liveness: z
		.object({
			challenge: livenessChallengeSchema,
			capturedAt: z.string().max(40).optional(),
			secondaryFrameKey: z.string().trim().min(1).max(500).optional(),
		})
		.optional(),
});

export type UserDocumentMetadata = z.infer<typeof userDocumentMetadataSchema>;

export const uploadUserDocumentSchema = z.object({
	documentType: userDocumentTypeSchema,
	documentKey: z.string().trim().min(1, "Upload a file first").max(500),
	metadata: userDocumentMetadataSchema.optional(),
});

export type UploadUserDocumentInput = z.infer<typeof uploadUserDocumentSchema>;

/**
 * A volunteer is only VERIFIED once BOTH a government ID and a liveness selfie
 * have been approved. Verifying a single document must never flip the account,
 * so the account status is always recomputed from the whole document set:
 *
 * - VERIFIED — a government ID *and* a selfie are both approved.
 * - REJECTED — a still-unsatisfied required slot (gov ID or selfie) was rejected.
 * - PENDING  — anything else (awaiting upload or review).
 */
export function computeUserVerificationStatus(
	documents: ReadonlyArray<{
		documentType: string;
		verificationStatus: string | null;
	}>,
): "PENDING" | "VERIFIED" | "REJECTED" {
	const hasVerifiedGovId = documents.some(
		(d) =>
			isGovernmentIdDocument(d.documentType) &&
			d.verificationStatus === "VERIFIED",
	);
	const hasVerifiedSelfie = documents.some(
		(d) =>
			isSelfieDocument(d.documentType) && d.verificationStatus === "VERIFIED",
	);

	if (hasVerifiedGovId && hasVerifiedSelfie) return "VERIFIED";

	const govIdRejected =
		!hasVerifiedGovId &&
		documents.some(
			(d) =>
				isGovernmentIdDocument(d.documentType) &&
				d.verificationStatus === "REJECTED",
		);
	const selfieRejected =
		!hasVerifiedSelfie &&
		documents.some(
			(d) =>
				isSelfieDocument(d.documentType) && d.verificationStatus === "REJECTED",
		);

	if (govIdRejected || selfieRejected) return "REJECTED";

	return "PENDING";
}

export const updateUserProfileSchema = z.object({
	fullName: z.string().trim().min(2).max(100).optional(),
	phone: phoneSchema.optional(),
	profileImage: optionalText(500),
	bio: optionalText(500),
	city: z.string().trim().min(2).max(80).optional(),
	state: z.string().trim().min(2).max(80).optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
