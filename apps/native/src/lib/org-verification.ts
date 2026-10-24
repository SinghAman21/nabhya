import type { UploadOrgDocumentInput } from "@nabhya/shared";
import type { OrgVerificationStatus } from "@/lib/types/domain";

/**
 * Everything the app says about an organisation's verification state, in one
 * place.
 *
 * Three surfaces render this: the dashboard banner, the profile banner and the
 * "Verification" row's trailing state. Each of them used to carry its own
 * chain of nested ternaries over the same four statuses, so the copy drifted -
 * the row said "Not started" where the banner said "Get verified to go
 * public", and a wording change meant finding all three.
 *
 * `tone`/`title`/`description` are the banner; `label` is the row. The
 * `VERIFIED` case exists for the row and for `(ngo)/verification.tsx`'s success
 * banner - the two profile banners are hidden once verified, because a notice
 * that congratulates you every visit is a notice you stop reading.
 */
export interface OrgVerificationCopy {
	/** Short state, for a list row's trailing value. */
	label: string;
	tone: "info" | "warning" | "success" | "error";
	title: string;
	description: string;
}

export function orgVerificationCopy(
	status: OrgVerificationStatus | null | undefined,
	rejectionReason?: string | null,
): OrgVerificationCopy {
	switch (status) {
		case "VERIFIED":
			return {
				label: "Verified",
				tone: "success",
				title: "Your organisation is verified",
				description: "Your events, needs and updates are public.",
			};
		case "UNDER_REVIEW":
			return {
				label: "Under review",
				tone: "info",
				title: "Verification under review",
				description:
					"A reviewer is checking your documents. Usually a few days.",
			};
		case "REJECTED":
			return {
				label: "Action needed",
				tone: "error",
				title: "Verification was not approved",
				description:
					rejectionReason ??
					"See the reviewer's notes and upload corrected documents.",
			};
		default:
			return {
				label: "Not started",
				tone: "warning",
				title: "Get verified to go public",
				description:
					"Upload your registration certificate and PAN card. Until then, events and needs stay private.",
			};
	}
}

/* -------------------------------------------------------------------------- */
/* The document set                                                           */
/* -------------------------------------------------------------------------- */

export type OrgDocumentType = UploadOrgDocumentInput["documentType"];

export interface OrgDocumentSpec {
	type: OrgDocumentType;
	/** What to hand over, in the words the person uploading needs. */
	hint: string;
}

/**
 * What review actually waits on. Both of these, and nothing else - the two
 * below are accelerants, not conditions.
 */
export const ORG_REQUIRED_DOCUMENTS: OrgDocumentSpec[] = [
	{
		type: "NGO_REGISTRATION_CERTIFICATE",
		hint: "Trust deed, society registration or Section 8 incorporation certificate.",
	},
	{
		type: "PAN_CARD",
		hint: "The organisation's PAN card, not a trustee's.",
	},
];

export const ORG_OPTIONAL_DOCUMENTS: OrgDocumentSpec[] = [
	{
		type: "80G_CERTIFICATE",
		hint: "Lets donors claim tax relief. Shown as a badge on your profile.",
	},
	{
		type: "12A_CERTIFICATE",
		hint: "Income-tax registration for the trust. Speeds up review.",
	},
];

/**
 * The three stages an organisation moves through.
 *
 * `(ngo)/verification.tsx` and the profile's Verification tab both draw this,
 * so it lives here with the document lists rather than being retyped either
 * side. Two screens disagreeing about which step you are on is worse than
 * neither showing one.
 */
export const ORG_VERIFICATION_STEPS = ["Documents", "Review", "Verified"];

export function orgVerificationStep(
	status: OrgVerificationStatus | null | undefined,
	uploadedRequired: number,
): number {
	// Past the last stage: every dot is a tick. Returning the last index drew
	// "Verified" as an unfinished "3" on a verified organisation.
	if (status === "VERIFIED") return ORG_VERIFICATION_STEPS.length;
	return uploadedRequired >= ORG_REQUIRED_DOCUMENTS.length ? 1 : 0;
}

/** The short state of one document slot, for a pill. */
export function orgDocumentState(state: string | null | undefined) {
	switch (state) {
		case "VERIFIED":
			return { label: "Verified", tone: "success" as const };
		case "REJECTED":
			return { label: "Rejected", tone: "error" as const };
		case "PENDING":
			return { label: "In review", tone: "info" as const };
		default:
			return { label: "Not uploaded", tone: "neutral" as const };
	}
}

/**
 * The document that currently stands for each type.
 *
 * An NGO answers a rejection by uploading a new copy, which adds a row rather
 * than replacing one, so every type can have a history. Both screens used to
 * build `new Map(docs.map(...))`, which keeps the *last* entry per key - and
 * the list arrives newest first, so that was the oldest copy: a corrected
 * upload went on showing its predecessor's "Rejected" and the reviewer's old
 * note. Sorted here rather than trusting the server's order, since that order
 * is an implementation detail of one query.
 */
export function currentDocumentsByType<
	T extends { documentType: string; uploadedAt: string },
>(documents: readonly T[] | undefined): Map<string, T> {
	const current = new Map<string, T>();
	for (const document of documents ?? []) {
		const held = current.get(document.documentType);
		if (!held || document.uploadedAt > held.uploadedAt) {
			current.set(document.documentType, document);
		}
	}
	return current;
}
