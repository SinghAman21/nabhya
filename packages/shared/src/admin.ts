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

export const adminOrgQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	verificationStatus: orgVerificationStatusSchema.optional(),
	status: orgStatusSchema.optional(),
	city: z.string().trim().max(80).optional(),
});

export type AdminOrgQuery = z.infer<typeof adminOrgQuerySchema>;

export const adminUserQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().max(120).optional(),
	role: roleSchema.optional(),
	status: userStatusSchema.optional(),
	verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
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

export const auditLogQuerySchema = paginationQuerySchema.extend({
	action: z.string().trim().max(80).optional(),
	entityName: z.string().trim().max(80).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/** Filter for the cross-organization document verification queues. */
export const documentQueueQuerySchema = paginationQuerySchema.extend({
	status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});

export type DocumentQueueQuery = z.infer<typeof documentQueueQuerySchema>;

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
