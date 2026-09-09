import { z } from "zod";
import { paginationQuerySchema } from "./common";
import { roleSchema } from "./roles";

// ─── Monitoring queries ──────────────────────────────────────────────────────

export const orgVerificationStatusSchema = z.enum([
	"PENDING",
	"UNDER_REVIEW",
	"VERIFIED",
	"REJECTED",
]);

export const orgStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);
export const docVerificationStatusSchema = z.enum([
	"PENDING",
	"VERIFIED",
	"REJECTED",
]);

/**
 * Sorting on the admin lists.
 *
 * These are **server-side** and deliberately so: the console pages at 20 rows,
 * and re-ordering the rows already in the browser would sort a page rather than
 * a table — "oldest first" would show the oldest of the newest twenty. Every
 * key here maps to one column (or one correlated count) in
 * `AdminService`; a key with no mapping is rejected by the enum rather than
 * silently ignored.
 *
 * `dir` defaults to `desc` because every default sort is a timestamp and the
 * useful end of a timestamp is the recent one.
 */
export const sortDirSchema = z.enum(["asc", "desc"]).default("desc");
export type SortDir = z.infer<typeof sortDirSchema>;

export const adminOrgSortSchema = z
	.enum([
		"createdAt",
		"name",
		"city",
		"verificationStatus",
		"pendingDocuments",
		"events",
	])
	.default("createdAt");
export type AdminOrgSort = z.infer<typeof adminOrgSortSchema>;

export const adminOrgQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	verificationStatus: orgVerificationStatusSchema.optional(),
	status: orgStatusSchema.optional(),
	city: z.string().trim().max(80).optional(),
	sort: adminOrgSortSchema,
	dir: sortDirSchema,
});

export type AdminOrgQuery = z.infer<typeof adminOrgQuerySchema>;

export const adminUserSortSchema = z
	.enum([
		"createdAt",
		"name",
		"email",
		"verificationStatus",
		"applications",
		"pledges",
	])
	.default("createdAt");
export type AdminUserSort = z.infer<typeof adminUserSortSchema>;

export const adminUserQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	role: roleSchema.optional(),
	status: userStatusSchema.optional(),
	verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
	sort: adminUserSortSchema,
	dir: sortDirSchema,
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

// ─── Moderation actions ──────────────────────────────────────────────────────

export const reviewOrganizationSchema = z
	.object({
		verificationStatus: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"]),
		reason: z.string().trim().max(500).optional(),
	})
	.refine((v) => v.verificationStatus !== "REJECTED" || !!v.reason?.length, {
		message: "A reason is required when rejecting an organization",
		path: ["reason"],
	});

export type ReviewOrganizationInput = z.infer<typeof reviewOrganizationSchema>;

export const setOrgStatusSchema = z
	.object({
		status: orgStatusSchema,
		reason: z.string().trim().max(500).optional(),
	})
	.refine((v) => v.status !== "SUSPENDED" || !!v.reason?.length, {
		message: "A reason is required when suspending an organization",
		path: ["reason"],
	});

export type SetOrgStatusInput = z.infer<typeof setOrgStatusSchema>;

export const setUserStatusSchema = z
	.object({
		status: userStatusSchema,
		reason: z.string().trim().max(500).optional(),
	})
	.refine((v) => v.status === "ACTIVE" || !!v.reason?.length, {
		message: "A reason is required when suspending or deleting a user",
		path: ["reason"],
	});

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;

export const reviewDocumentSchema = z
	.object({
		verificationStatus: z.enum(["VERIFIED", "REJECTED"]),
		remarks: z.string().trim().max(500).optional(),
	})
	.refine((v) => v.verificationStatus !== "REJECTED" || !!v.remarks?.length, {
		message: "Remarks are required when rejecting a document",
		path: ["remarks"],
	});

export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

/**
 * Reviewing a page of documents at once.
 *
 * The queue is the reviewer's grind — four documents per NGO, one decision
 * each, and the decision is nearly always "approve" — so approving a selection
 * is the single action that changes how long verification takes. Capped at 50
 * because each identity document additionally re-derives its owner's account
 * status inside a transaction.
 *
 * Rejection still needs remarks, and one set of remarks covers the whole
 * selection: rejecting fifteen documents for fifteen different reasons is
 * fifteen decisions, and belongs in fifteen rows.
 */
export const bulkReviewDocumentsSchema = z
	.object({
		ids: z.array(z.uuid()).min(1).max(50),
		verificationStatus: z.enum(["VERIFIED", "REJECTED"]),
		remarks: z.string().trim().max(500).optional(),
	})
	.refine((v) => v.verificationStatus !== "REJECTED" || !!v.remarks?.length, {
		message: "Remarks are required when rejecting documents",
		path: ["remarks"],
	});

export type BulkReviewDocumentsInput = z.infer<
	typeof bulkReviewDocumentsSchema
>;

/**
 * Per-document outcome, never a bare count. One id in a selection of forty can
 * fail on its own (already reviewed, deleted underneath the reviewer) and
 * "38 of 40" with no names is not something anyone can act on.
 */
export interface BulkReviewResult {
	reviewed: string[];
	failed: Array<{ id: string; reason: string }>;
}

export const auditLogSortSchema = z
	.enum(["createdAt", "action"])
	.default("createdAt");
export type AuditLogSort = z.infer<typeof auditLogSortSchema>;

export const auditLogQuerySchema = paginationQuerySchema.extend({
	action: z.string().trim().max(80).optional(),
	entityName: z.string().trim().max(80).optional(),
	sort: auditLogSortSchema,
	dir: sortDirSchema,
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const documentQueueSortSchema = z
	.enum(["uploadedAt", "documentType", "owner"])
	.default("uploadedAt");
export type DocumentQueueSort = z.infer<typeof documentQueueSortSchema>;

/** Filter for the cross-organization document verification queues. */
export const documentQueueQuerySchema = paginationQuerySchema.extend({
	status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
	sort: documentQueueSortSchema,
	dir: sortDirSchema,
});

export type DocumentQueueQuery = z.infer<typeof documentQueueQuerySchema>;

// ─── Admin activity timelines ────────────────────────────────────────────────

export const adminActivityKindSchema = z.enum([
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
	"REPORT",
	"DOCUMENT",
	"APPLICATION",
	"PLEDGE",
	"DONATION",
	"REVIEW",
	"CERTIFICATE",
	"POST",
]);
export type AdminActivityKind = z.infer<typeof adminActivityKindSchema>;

export const adminActivityQuerySchema = paginationQuerySchema.extend({
	kind: adminActivityKindSchema.optional(),
});
export type AdminActivityQuery = z.infer<typeof adminActivityQuerySchema>;

export interface AdminActivityActor {
	id: string;
	name: string | null;
	email: string | null;
}

export interface AdminActivitySubject {
	id: string;
	label: string;
	type?: string | null;
	status?: string | null;
}

/**
 * A flat, paginated timeline item. The frontend can group by `groupKey` for
 * day sections, by `kind` for tabs/chips, or ignore both and render it as one
 * chronological list.
 */
export interface AdminActivityItem {
	id: string;
	kind: AdminActivityKind;
	occurredAt: string;
	groupKey: string;
	groupLabel: string;
	title: string;
	description: string | null;
	status: string | null;
	amountMinor?: number | null;
	currency?: string | null;
	actor?: AdminActivityActor | null;
	subject?: AdminActivitySubject | null;
	organization?: { id: string; organizationName: string } | null;
}

// ─── Admin analytics ─────────────────────────────────────────────────────────

export const adminAnalyticsQuerySchema = z.object({
	days: z.coerce
		.number()
		.int()
		.refine((v) => [7, 30, 90].includes(v), {
			message: "Window must be 7, 30 or 90 days",
		})
		.default(30),
	limit: z.coerce.number().int().min(3).max(25).default(10),
});
export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;

export interface AdminAnalyticsPoint {
	label: string;
	value: number;
}

export interface AdminReviewQueueBucket {
	label: string;
	orgDocuments: number;
	userDocuments: number;
}

export interface AdminTopOrganization {
	id: string;
	organizationName: string;
	city: string | null;
	state: string | null;
	events: number;
	needs: number;
	applications: number;
	donationAmountMinor: number;
}

export interface AdminDonationTrendPoint {
	date: string;
	amountMinor: number;
	count: number;
}

export interface AdminAnalytics {
	windowDays: number;
	locations: {
		organizations: AdminAnalyticsPoint[];
		volunteers: AdminAnalyticsPoint[];
	};
	categories: {
		organizations: AdminAnalyticsPoint[];
		volunteers: AdminAnalyticsPoint[];
	};
	applicationFunnel: AdminAnalyticsPoint[];
	reviewQueues: {
		pending: { organizationDocuments: number; userDocuments: number };
		ageBuckets: AdminReviewQueueBucket[];
	};
	topOrganizations: AdminTopOrganization[];
	donations: {
		totalAmountMinor: number;
		completedCount: number;
		points: AdminDonationTrendPoint[];
	};
}

// ─── Dashboard payload ───────────────────────────────────────────────────────

export interface AdminOverview {
	organizations: {
		total: number;
		pending: number;
		underReview: number;
		verified: number;
		rejected: number;
		suspended: number;
	};
	users: {
		total: number;
		volunteers: number;
		organisations: number;
		suspended: number;
		pendingVerification: number;
	};
	events: {
		total: number;
		published: number;
		upcoming: number;
	};
	needs: {
		total: number;
		open: number;
		wants: number;
		offers: number;
	};
	applications: {
		total: number;
		pending: number;
		accepted: number;
	};
	documents: {
		pendingOrgDocuments: number;
		pendingUserDocuments: number;
	};
}

// ─── Dashboard trends ────────────────────────────────────────────────────────

/**
 * How far back the Overview's charts look.
 *
 * A window, not a free date range: the console has one reader and one question
 * ("is the platform growing, and is the queue keeping up"), and a from/to picker
 * is a whole interaction to build for three answers. 7 / 30 / 90 covers a week
 * of noise, a month of shape, and a quarter of trend.
 */
export const TREND_WINDOWS = [7, 30, 90] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export const trendWindowSchema = z.coerce
	.number()
	.int()
	.refine((v): v is TrendWindow => TREND_WINDOWS.includes(v as TrendWindow), {
		message: "Window must be 7, 30 or 90 days",
	})
	.default(30);

export const adminTrendQuerySchema = z.object({
	days: trendWindowSchema,
});

export type AdminTrendQuery = z.infer<typeof adminTrendQuerySchema>;

/** One day. Zero-filled — see `AdminTrends`. */
export interface AdminTrendPoint {
	/** `YYYY-MM-DD`, UTC. */
	date: string;
	organizations: number;
	volunteers: number;
	events: number;
	applications: number;
}

/**
 * The Overview's time series.
 *
 * **Every day in the window is present, including the zeros.** A `GROUP BY date`
 * returns only days that had a row, and plotting those points as a line draws a
 * straight segment across a gap — which reads as steady activity over a week
 * when the truth is nothing happened. The server zero-fills so the client never
 * has to know the difference, and a young platform's chart honestly reads as
 * mostly floor.
 *
 * `totals` are sums over the same window, so the chart's caption and the chart
 * cannot disagree; `previousTotals` is the window immediately before it, which
 * is what makes a delta possible ("+18% on the previous 30 days") without the
 * client fetching twice.
 */
export interface AdminTrends {
	days: number;
	points: AdminTrendPoint[];
	totals: Omit<AdminTrendPoint, "date">;
	previousTotals: Omit<AdminTrendPoint, "date">;
}
