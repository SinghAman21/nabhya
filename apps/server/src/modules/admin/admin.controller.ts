import type {
	AdminOrgQuery,
	AdminUserQuery,
	AuditLogQuery,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	SetOrgStatusInput,
	SetUserStatusInput,
} from "@nabhya/shared";
import {
	adminOrgQuerySchema,
	adminUserQuerySchema,
	auditLogQuerySchema,
	paginationQuerySchema,
	reviewDocumentSchema,
	reviewOrganizationSchema,
	setOrgStatusSchema,
	setUserStatusSchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import type { AdminService } from "./admin.service";

const documentQueueQuerySchema = paginationQuerySchema.extend({
	status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});

type DocumentQueueQuery = z.infer<typeof documentQueueQuerySchema>;

/**
 * Superadmin monitoring surface. The class-level @Roles guard means every route
 * here is unreachable without the superadmin role.
 */
@ApiTags("Admin")
@Controller("admin")
@Roles("superadmin")
@ApiBearerAuth("access-token")
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Get("overview")
	@ApiOperation({ summary: "Platform-wide counters for the admin dashboard" })
	getOverview() {
		return this.adminService.getOverview();
	}

	// ─── Organizations ───────────────────────────────────────────────────────

	@Get("organizations")
	@ApiOperation({ summary: "Monitor organizations" })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({
		name: "verificationStatus",
		required: false,
		enum: ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"],
	})
	@ApiQuery({ name: "status", required: false, enum: ["ACTIVE", "SUSPENDED"] })
	listOrganizations(
		@Query(new ZodValidationPipe(adminOrgQuerySchema)) query: AdminOrgQuery,
	) {
		return this.adminService.listOrganizations(query);
	}

	@Get("organizations/:id")
	@ApiOperation({
		summary: "Full organization dossier — documents, stats, recent events",
	})
	getOrganization(@Param("id", ParseUUIDPipe) id: string) {
		return this.adminService.getOrganizationDetail(id);
	}

	@Patch("organizations/:id/verification")
	@ApiOperation({ summary: "Approve, reject or start reviewing an NGO" })
	reviewOrganization(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(reviewOrganizationSchema))
		body: ReviewOrganizationInput,
	) {
		return this.adminService.reviewOrganization(admin.id, id, body);
	}

	@Patch("organizations/:id/status")
	@ApiOperation({
		summary:
			"Suspend or reinstate an NGO. Suspending also unpublishes its events and needs.",
	})
	setOrganizationStatus(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(setOrgStatusSchema)) body: SetOrgStatusInput,
	) {
		return this.adminService.setOrganizationStatus(admin.id, id, body);
	}

	// ─── Users ───────────────────────────────────────────────────────────────

	@Get("users")
	@ApiOperation({ summary: "Monitor users and volunteers" })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({
		name: "role",
		required: false,
		enum: ["superadmin", "volunteer", "organisation"],
	})
	@ApiQuery({
		name: "status",
		required: false,
		enum: ["ACTIVE", "SUSPENDED", "DELETED"],
	})
	listUsers(
		@Query(new ZodValidationPipe(adminUserQuerySchema)) query: AdminUserQuery,
	) {
		return this.adminService.listUsers(query);
	}

	@Get("users/:id")
	@ApiOperation({
		summary: "User dossier — documents plus their full participation history",
	})
	getUser(@Param("id", ParseUUIDPipe) id: string) {
		return this.adminService.getUserDetail(id);
	}

	@Patch("users/:id/status")
	@ApiOperation({ summary: "Suspend, delete or reinstate a user" })
	setUserStatus(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(setUserStatusSchema)) body: SetUserStatusInput,
	) {
		return this.adminService.setUserStatus(admin.id, id, body);
	}

	// ─── Document verification queues ────────────────────────────────────────

	@Get("documents/organizations")
	@ApiOperation({ summary: "Organization document verification queue" })
	@ApiQuery({
		name: "status",
		required: false,
		enum: ["PENDING", "VERIFIED", "REJECTED"],
	})
	listOrgDocuments(
		@Query(new ZodValidationPipe(documentQueueQuerySchema))
		query: DocumentQueueQuery,
	) {
		return this.adminService.listOrganizationDocuments(query);
	}

	@Patch("documents/organizations/:id")
	@ApiOperation({ summary: "Approve or reject an organization document" })
	reviewOrgDocument(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(reviewDocumentSchema))
		body: ReviewDocumentInput,
	) {
		return this.adminService.reviewOrganizationDocument(admin.id, id, body);
	}

	@Get("documents/users")
	@ApiOperation({ summary: "Identity document verification queue" })
	@ApiQuery({
		name: "status",
		required: false,
		enum: ["PENDING", "VERIFIED", "REJECTED"],
	})
	listUserDocuments(
		@Query(new ZodValidationPipe(documentQueueQuerySchema))
		query: DocumentQueueQuery,
	) {
		return this.adminService.listUserDocuments(query);
	}

	@Patch("documents/users/:id")
	@ApiOperation({ summary: "Approve or reject an identity document" })
	reviewUserDocument(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(reviewDocumentSchema))
		body: ReviewDocumentInput,
	) {
		return this.adminService.reviewUserDocument(admin.id, id, body);
	}

	// ─── Audit ───────────────────────────────────────────────────────────────

	@Get("audit-logs")
	@ApiOperation({ summary: "Search the platform activity trail" })
	@ApiQuery({ name: "action", required: false })
	@ApiQuery({ name: "entityName", required: false })
	listAuditLogs(
		@Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
	) {
		return this.adminService.listAuditLogs(query);
	}
}
