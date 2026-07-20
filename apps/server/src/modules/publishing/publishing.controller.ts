import type {
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	PaginationQuery,
	UpdateOrgAdminInput,
	UpsertAnnouncementInput,
} from "@nabhya/shared";
import {
	createFinancialReportSchema,
	inviteOrgAdminSchema,
	paginationQuerySchema,
	updateOrgAdminSchema,
	upsertAnnouncementSchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { ImpactService } from "./impact.service";
import { PublishingService } from "./publishing.service";

@ApiTags("Publishing")
@Controller()
export class PublishingController {
	constructor(
		@Inject(PublishingService)
		private readonly publishing: PublishingService,
		@Inject(ImpactService) private readonly impact: ImpactService,
	) {}

	// ─── Announcements ───────────────────────────────────────────────────────

	@Public()
	@Get("organizations/:id/announcements")
	@ApiOperation({ summary: "An organization's public updates" })
	listAnnouncements(
		@Param("id", ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.publishing.listAnnouncements(id, query);
	}

	@Get("org/announcements")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The caller's updates, including drafts" })
	listMyAnnouncements(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.publishing.listMyAnnouncements(user.id, query);
	}

	@Post("org/announcements")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Post an update. Publishing notifies everyone who bookmarked you.",
	})
	createAnnouncement(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(upsertAnnouncementSchema))
		body: UpsertAnnouncementInput,
	) {
		return this.publishing.createAnnouncement(user.id, body);
	}

	@Patch("org/announcements/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Edit an update" })
	updateAnnouncement(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(upsertAnnouncementSchema))
		body: UpsertAnnouncementInput,
	) {
		return this.publishing.updateAnnouncement(user.id, id, body);
	}

	@Delete("org/announcements/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Delete an update" })
	deleteAnnouncement(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.deleteAnnouncement(user.id, id);
	}

	// ─── Financial reports ───────────────────────────────────────────────────

	@Public()
	@Get("organizations/:id/reports")
	@ApiOperation({
		summary: "Published transparency documents. Public by design.",
	})
	listReports(@Param("id", ParseUUIDPipe) id: string) {
		return this.publishing.listFinancialReports(id);
	}

	@Post("org/reports")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Publish an annual report or audited statement" })
	createReport(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createFinancialReportSchema))
		body: CreateFinancialReportInput,
	) {
		return this.publishing.createFinancialReport(user.id, body);
	}

	@Delete("org/reports/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Withdraw a published report" })
	deleteReport(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.deleteFinancialReport(user.id, id);
	}

	// ─── Team ────────────────────────────────────────────────────────────────

	@Get("org/team")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The organization's admins" })
	listTeam(@CurrentUser() user: AuthUser) {
		return this.publishing.listTeam(user.id);
	}

	@Post("org/team")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Add an existing Nabhya account to the team",
	})
	inviteAdmin(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(inviteOrgAdminSchema))
		body: InviteOrgAdminInput,
	) {
		return this.publishing.inviteAdmin(user.id, body);
	}

	@Patch("org/team/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Change a team member's designation" })
	updateAdmin(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(updateOrgAdminSchema))
		body: UpdateOrgAdminInput,
	) {
		return this.publishing.updateAdmin(user.id, id, body);
	}

	@Delete("org/team/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Remove a team member" })
	removeAdmin(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.removeAdmin(user.id, id);
	}

	// ─── Impact ──────────────────────────────────────────────────────────────

	@Get("me/impact")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The caller's volunteering impact summary" })
	myImpact(@CurrentUser() user: AuthUser) {
		return this.impact.getVolunteerImpact(user.id);
	}

	@Public()
	@Get("organizations/:id/impact")
	@ApiOperation({ summary: "An organization's public impact figures" })
	organizationImpact(@Param("id", ParseUUIDPipe) id: string) {
		return this.impact.getOrganizationImpact(id);
	}
}
