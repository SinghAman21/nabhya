import { z } from "zod";

export const uploadPurposeSchema = z.enum([
	"ORG_DOCUMENT",
	"USER_DOCUMENT",
	"ORG_LOGO",
	"ORG_COVER",
	"AVATAR",
	"EVENT_COVER",
	"FINANCIAL_REPORT",
]);

export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

export const uploadContentTypeSchema = z.enum([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export type UploadContentType = z.infer<typeof uploadContentTypeSchema>;

/** 10 MB, mirrored on the server so the picker can reject early. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadIntentSchema = z.object({
	purpose: uploadPurposeSchema,
	/** Required for NGO verification documents so their storage name is stable. */
	organizationDocumentType: z.string().trim().min(1).max(80).optional(),
	fileName: z.string().trim().min(1).max(200),
	contentType: uploadContentTypeSchema,
	/** Checked against the limit up front; re-verified after the upload lands. */
	size: z.coerce
		.number()
		.int()
		.min(1, "File appears to be empty")
		.max(MAX_UPLOAD_BYTES, "Files must be under 10 MB"),
});

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

export interface UploadTicketResponse {
	key: string;
	url: string;
	headers: Record<string, string>;
	expiresAt: string;
}

export const downloadUrlSchema = z.object({
	key: z.string().trim().min(1).max(400),
});

export type DownloadUrlInput = z.infer<typeof downloadUrlSchema>;

export interface DownloadUrlResponse {
	url: string;
	expiresAt: string;
}

/** Human labels for the document types shown in the upload UI. */
export const ORG_DOCUMENT_LABELS: Record<string, string> = {
	NGO_REGISTRATION_CERTIFICATE: "Registration certificate",
	PAN_CARD: "PAN card",
	"80G_CERTIFICATE": "80G certificate",
	"12A_CERTIFICATE": "12A certificate",
	GST_CERTIFICATE: "GST certificate",
	BANK_ACCOUNT_PROOF: "Bank account proof",
	OTHER: "Other document",
};

export const USER_DOCUMENT_LABELS: Record<string, string> = {
	AADHAR_CARD: "Aadhaar card",
	PAN_CARD: "PAN card",
	DRIVING_LICENSE: "Driving licence",
	VOTER_ID: "Voter ID",
	PASSPORT: "Passport",
	SELFIE: "Selfie (liveness)",
	OTHER: "Other ID",
};
