import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

export const markAttendanceSchema = z.object({
	/** false un-marks, which also blocks certificate issuance. */
	attended: z.boolean(),
	/**
	 * Hours actually served, in half-hour steps. Omit to keep what is stored
	 * (or to mean the whole event); `null` clears it.
	 */
	hours: z.null().or(z.number().min(0.5).max(500).multipleOf(0.5)).optional(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const issueCertificateSchema = z.object({
	note: optionalText(300),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

/**
 * After the event: mark a selection of accepted volunteers present, or issue
 * certificates to a selection that already is. Hours stay per person (the
 * whole event unless edited on the row) and so does a certificate note.
 */
export const bulkAttendanceSchema = z.object({
	ids: z.array(z.uuid()).min(1).max(50),
	action: z.enum(["MARK_ATTENDED", "ISSUE_CERTIFICATE"]),
});

export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;

export const revokeCertificateSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(3, "Give a reason so the record explains itself")
		.max(300),
});

export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;

export const certificateQuerySchema = paginationQuerySchema;

/** Public payload returned by the verification page - deliberately minimal. */
export interface CertificateVerification {
	code: string;
	valid: boolean;
	revoked: boolean;
	revokedReason: string | null;
	volunteerName: string | null;
	organizationName: string;
	eventTitle: string;
	eventDate: string;
	issuedAt: string;
	note: string | null;
}
