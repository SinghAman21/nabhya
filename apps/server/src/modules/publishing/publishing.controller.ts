import type {
	ConfirmOwnershipTransferInput,
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	InviteTeamMemberInput,
	MyAnnouncementQuery,
	PaginationQuery,
	TeamListQuery,
	TransferOwnershipInput,
	UpdateOrgAdminInput,
	UpsertAnnouncementInput,
} from "@nabhya/shared";
import {
	confirmOwnershipTransferSchema,
	createFinancialReportSchema,
	inviteOrgAdminSchema,
	inviteTeamMemberSchema,
	myAnnouncementQuerySchema,
	paginationQuerySchema,
	teamListQuerySchema,
	transferOwnershipSchema,
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
		@Query(new ZodValidationPipe(myAnnouncementQuerySchema))
		query: MyAnnouncementQuery,
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
	@ApiOperation({ summary: "The organization's team members" })
	listTeam(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(teamListQuerySchema)) query: TeamListQuery,
	) {
		return this.publishing.listTeam(user.id, query);
	}

	@Post("org/team")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Legacy add-existing-account team member route",
	})
	inviteAdmin(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(inviteOrgAdminSchema))
		body: InviteOrgAdminInput,
	) {
		return this.publishing.inviteAdmin(user.id, body);
	}

	@Post("org/team/invites")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Invite someone to join the organization's team" })
	createTeamInvite(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(inviteTeamMemberSchema))
		body: InviteTeamMemberInput,
	) {
		return this.publishing.createTeamInvite(user.id, body);
	}

	@Get("org/team/invites")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "List pending team invites" })
	listTeamInvites(@CurrentUser() user: AuthUser) {
		return this.publishing.listTeamInvites(user.id);
	}

	@Delete("org/team/invites/:id")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Revoke a pending team invite" })
	revokeTeamInvite(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.revokeTeamInvite(user.id, id);
	}

	@Post("org/team/invites/:id/resend")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Regenerate and resend a team invite link" })
	resendTeamInvite(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.resendTeamInvite(user.id, id);
	}

	@Post("team/invites/by-id/:id/accept")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Accept a team invite from its in-app notification",
	})
	acceptTeamInviteById(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.acceptTeamInviteById(user.id, id);
	}

	@Post("team/invites/by-id/:id/decline")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Decline a team invite from its in-app notification",
	})
	declineTeamInviteById(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.publishing.declineTeamInviteById(user.id, id);
	}

	@Post("team/invites/:token/accept")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Accept a team invite" })
	acceptTeamInvite(
		@CurrentUser() user: AuthUser,
		@Param("token") token: string,
	) {
		return this.publishing.acceptTeamInvite(user.id, token);
	}

	@Post("team/invites/:token/decline")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Decline a team invite" })
	declineTeamInvite(
		@CurrentUser() user: AuthUser,
		@Param("token") token: string,
	) {
		return this.publishing.declineTeamInvite(user.id, token);
	}

	@Post("org/team/leave")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Leave the current organization team" })
	leaveTeam(@CurrentUser() user: AuthUser) {
		return this.publishing.leaveTeam(user.id);
	}

	@Post("org/team/transfer")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Request an ownership transfer" })
	requestOwnershipTransfer(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(transferOwnershipSchema))
		body: TransferOwnershipInput,
	) {
		return this.publishing.requestOwnershipTransfer(user.id, body.toMemberId);
	}

	@Post("org/team/transfer/confirm")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Confirm an ownership transfer" })
	confirmOwnershipTransfer(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(confirmOwnershipTransferSchema))
		body: ConfirmOwnershipTransferInput,
	) {
		return this.publishing.confirmOwnershipTransfer(user.id, body);
	}

	@Public()
	@Get("organizations/:id/team")
	@ApiOperation({ summary: "An organization's public team members" })
	listPublicTeam(@Param("id", ParseUUIDPipe) id: string) {
		return this.publishing.listPublicTeam(id);
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

	/**
	 * Closes events whose end time has passed.
	 *
	 * Nothing transitions an event out of PUBLISHED on its own, so without this
	 * the "Past" filter stays empty and finished events keep accepting
	 * applications. Exposed for the hourly scheduler described in the deployment
	 * notes; it is not a user-facing admin action.
	 */
	@Post("admin/events/close-finished")
	@Roles("superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Mark finished events COMPLETED (idempotent)" })
	closeFinishedEvents() {
		return this.impact.closeFinishedEvents();
	}

	@Public()
	@Get("organizations/:id/impact")
	@ApiOperation({ summary: "An organization's public impact figures" })
	organizationImpact(@Param("id", ParseUUIDPipe) id: string) {
		return this.impact.getOrganizationImpact(id);
	}
}
