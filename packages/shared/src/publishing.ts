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
	isUrgent: z.boolean().default(false),
});

export type UpsertAnnouncementInput = z.infer<typeof upsertAnnouncementSchema>;

export const announcementQuerySchema = paginationQuerySchema;

/**
 * The NGO's own list, which also holds drafts. Filtering by status has to
 * happen here: filtered on the client it only ever looked through the pages
 * loaded so far, so "Drafts" could read empty with drafts on page three.
 */
export const myAnnouncementQuerySchema = paginationQuerySchema.extend({
	status: announcementStatusSchema.optional(),
});

export type MyAnnouncementQuery = z.infer<typeof myAnnouncementQuerySchema>;

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

/**
 * The superadmin's cross-NGO view of transparency documents. Every report an
 * NGO has filed, including those of suspended or deleted NGOs - the console is
 * where a reviewer checks the books of an organisation the public can no
 * longer see. `search` matches the title and the NGO's name.
 */
export const adminFinancialReportQuerySchema = paginationQuerySchema.extend({
	organizationId: z.uuid().optional(),
	type: financialReportTypeSchema.optional(),
	financialYear: z.coerce.number().int().min(1990).max(2100).optional(),
	search: z.string().trim().max(120).optional(),
});

export type AdminFinancialReportQuery = z.infer<
	typeof adminFinancialReportQuerySchema
>;

export interface AdminFinancialReportRow {
	id: string;
	type: FinancialReportType;
	title: string;
	financialYear: number;
	documentKey: string;
	notes: string | null;
	createdAt: string;
	organization: {
		id: string;
		organizationName: string;
		status: string | null;
		verificationStatus: string | null;
	};
}

/** Labels the FY the way Indian NGOs write it: 2025 → "FY 2025–26". */
export function formatFinancialYear(year: number): string {
	return `FY ${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}

// ─── Organization team ───────────────────────────────────────────────────────

export const teamRoleSchema = z.enum([
	"OWNER",
	"ADMIN",
	"MANAGER",
	"MEMBER",
	"VIEWER",
]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const teamStatusSchema = z.enum([
	"ACTIVE",
	"SUSPENDED",
	"LEFT",
	"REMOVED",
]);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const teamInviteStatusSchema = z.enum([
	"PENDING",
	"ACCEPTED",
	"DECLINED",
	"REVOKED",
	"EXPIRED",
]);
export type TeamInviteStatus = z.infer<typeof teamInviteStatusSchema>;

export const orgPermissionActionSchema = z.enum([
	"team.invite",
	"team.remove",
	"team.changeRole",
	"content.publish",
	"content.delete",
	"people.review",
	"people.attendance",
	"certs.issue",
	"certs.revoke",
	"money.view",
	"reports.manage",
	"org.edit",
]);
export type OrgPermissionAction = z.infer<typeof orgPermissionActionSchema>;

export const ROLE_PERMISSIONS = {
	OWNER: orgPermissionActionSchema.options,
	ADMIN: [
		"team.invite",
		"team.remove",
		"team.changeRole",
		"content.publish",
		"content.delete",
		"people.review",
		"people.attendance",
		"certs.issue",
		"certs.revoke",
		"money.view",
		"reports.manage",
		"org.edit",
	],
	MANAGER: [
		"content.publish",
		"content.delete",
		"people.review",
		"people.attendance",
		"certs.issue",
		"org.edit",
	],
	MEMBER: ["people.attendance"],
	VIEWER: ["money.view"],
} as const satisfies Record<TeamRole, readonly OrgPermissionAction[]>;

export const canTeamRole = (
	role: TeamRole,
	action: OrgPermissionAction,
): boolean =>
	(ROLE_PERMISSIONS[role] as readonly OrgPermissionAction[]).includes(action);

export const inviteTeamMemberSchema = z.object({
	email: z
		.email("Enter a valid email")
		.transform((email) => email.toLowerCase()),
	role: teamRoleSchema.exclude(["OWNER"]),
	designation: optionalText(80),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

export const teamInviteTokenSchema = z.object({
	token: z.string().trim().min(32).max(256),
});

export type TeamInviteTokenInput = z.infer<typeof teamInviteTokenSchema>;

export const updateOrgAdminSchema = z
	.object({
		role: teamRoleSchema.exclude(["OWNER"]).optional(),
		designation: optionalText(80).optional(),
		isPublic: z.boolean().optional(),
		status: teamStatusSchema.exclude(["LEFT", "REMOVED"]).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Change at least one team member field",
	});

export type UpdateOrgAdminInput = z.infer<typeof updateOrgAdminSchema>;

export const teamListQuerySchema = z.object({
	status: teamStatusSchema.default("ACTIVE"),
	includeLeft: z.coerce.boolean().default(false),
});

export type TeamListQuery = z.infer<typeof teamListQuerySchema>;

export const transferOwnershipSchema = z.object({
	toMemberId: z.uuid(),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export const confirmOwnershipTransferSchema = z.object({
	token: z.string().trim().min(32).max(256),
});

export type ConfirmOwnershipTransferInput = z.infer<
	typeof confirmOwnershipTransferSchema
>;

/**
 * Back-compat for the legacy POST /org/team route. It becomes a thin wrapper
 * around invites during the migration and must never create accounts silently.
 */
export const inviteOrgAdminSchema = z.object({
	/** Legacy add-member path: keep accepting existing callers without role. */
	email: z
		.email("Enter a valid email")
		.transform((email) => email.toLowerCase()),
	role: teamRoleSchema.exclude(["OWNER"]).default("MEMBER"),
	designation: optionalText(80),
});

export type InviteOrgAdminInput = z.input<typeof inviteOrgAdminSchema>;

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
