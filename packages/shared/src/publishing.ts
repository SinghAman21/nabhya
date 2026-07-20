import { z } from "zod";
import { optionalText, paginationQuerySchema } from "./common";

// ─── Announcements ───────────────────────────────────────────────────────────

export const announcementStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export const upsertAnnouncementSchema = z.object({
	title: z
		.string()
		.trim()
		.min(4, "Give the update a title")
		.max(140, "Title must be under 140 characters"),
	body: z
		.string()
		.trim()
		.min(10, "Write at least a sentence")
		.max(5000, "Update must be under 5000 characters"),
	coverImageKey: optionalText(400),
	status: announcementStatusSchema.default("PUBLISHED"),
	isPinned: z.boolean().default(false),
});

export type UpsertAnnouncementInput = z.infer<typeof upsertAnnouncementSchema>;

export const announcementQuerySchema = paginationQuerySchema;

// ─── Financial reports ───────────────────────────────────────────────────────

export const financialReportTypeSchema = z.enum([
	"ANNUAL_REPORT",
	"AUDITED_STATEMENT",
	"FCRA_RETURN",
	"UTILISATION_CERTIFICATE",
	"OTHER",
]);

export type FinancialReportType = z.infer<typeof financialReportTypeSchema>;

export const FINANCIAL_REPORT_LABELS: Record<FinancialReportType, string> = {
	ANNUAL_REPORT: "Annual report",
	AUDITED_STATEMENT: "Audited statement",
	FCRA_RETURN: "FCRA return",
	UTILISATION_CERTIFICATE: "Utilisation certificate",
	OTHER: "Other document",
};

const currentFinancialYear = () => {
	const now = new Date();
	// India's financial year starts in April: before then we're still reporting
	// on the previous one.
	return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

export const createFinancialReportSchema = z.object({
	type: financialReportTypeSchema.default("ANNUAL_REPORT"),
	title: z.string().trim().min(3, "Give the document a title").max(140),
	financialYear: z.coerce
		.number()
		.int()
		.min(1990, "That year seems too early")
		.max(currentFinancialYear(), "That financial year hasn't finished yet"),
	documentKey: z.string().trim().min(1, "Upload a file first").max(400),
	notes: optionalText(500),
});

export type CreateFinancialReportInput = z.infer<
	typeof createFinancialReportSchema
>;

/** Labels the FY the way Indian NGOs write it: 2025 → "FY 2025–26". */
export function formatFinancialYear(year: number): string {
	return `FY ${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}

// ─── Organization team ───────────────────────────────────────────────────────

export const inviteOrgAdminSchema = z.object({
	/** The person must already have an account — we never create one silently. */
	email: z.email("Enter a valid email"),
	designation: optionalText(80),
});

export type InviteOrgAdminInput = z.infer<typeof inviteOrgAdminSchema>;

export const updateOrgAdminSchema = z.object({
	designation: optionalText(80),
});

export type UpdateOrgAdminInput = z.infer<typeof updateOrgAdminSchema>;

// ─── Proximity ───────────────────────────────────────────────────────────────

export const nearbyQuerySchema = paginationQuerySchema.extend({
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180),
	/** Search radius in kilometres. */
	radiusKm: z.coerce.number().min(1).max(500).default(25),
});

export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

// ─── Impact ──────────────────────────────────────────────────────────────────

export interface VolunteerImpact {
	eventsAttended: number;
	organizationsHelped: number;
	/** Sum of attended event durations, rounded to the nearest hour. */
	hoursContributed: number;
	certificatesEarned: number;
	itemsDonated: number;
	pledgesCompleted: number;
	applicationsSubmitted: number;
	acceptanceRate: number;
	firstVolunteeredAt: string | null;
}

export interface OrganizationImpact {
	eventsHosted: number;
	volunteersEngaged: number;
	volunteerHours: number;
	certificatesIssued: number;
	needsFulfilled: number;
	itemsReceived: number;
	activeSince: string | null;
}
