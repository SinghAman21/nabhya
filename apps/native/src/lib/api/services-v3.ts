import type {
	AdminDonationFilter,
	AdminDonationQuery,
	AdminDonationRow,
	AdminDonationSummary,
	AdminFinancialReportQuery,
	AdminFinancialReportRow,
	CreateFinancialReportInput,
	ExportFile,
	InviteTeamMemberInput,
	MyAnnouncementQuery,
	NearbyQuery,
	OrganizationImpact,
	Paginated,
	PaginationQuery,
	UpdateOrgAdminInput,
	UpsertAnnouncementInput,
	VolunteerImpact,
} from "@nabhya/shared";
import {
	adminDonationLedgerResponseSchema,
	exportFileResponseSchema,
} from "@nabhya/shared";
import type {
	Announcement,
	FinancialReport,
	NearbyOrganization,
	OrgTeamMember,
	PublicOrganization,
	PublicOrganizationDetail,
	PublicTeamMember,
	TeamInvite,
	TeamListQuery,
} from "@/lib/types";
import { ADMIN, ORGANIZATIONS, PUBLISHING } from "./endpoints";
import { http } from "./http";

/**
 * The superadmin money console. Kept apart from `adminApi` because none of it
 * moderates anything - it reads the ledger and writes exports.
 */
export const financeApi = {
	donations: (query: Partial<AdminDonationQuery>) =>
		http.get<Paginated<AdminDonationRow> & { summary: AdminDonationSummary }>(
			ADMIN.DONATIONS,
			query,
			adminDonationLedgerResponseSchema,
		),
	exportDonations: (filter: AdminDonationFilter) =>
		http.post<ExportFile>(
			ADMIN.DONATIONS_EXPORT,
			filter,
			exportFileResponseSchema,
		),
	financialReports: (query: Partial<AdminFinancialReportQuery>) =>
		http.getPage<AdminFinancialReportRow>(ADMIN.FINANCIAL_REPORTS, query),
};

export const orgDirectoryApi = {
	list: (
		query: Partial<PaginationQuery & { search?: string; city?: string }>,
	) => http.getPage<PublicOrganization>(ORGANIZATIONS.LIST, query),
	detail: (id: string) =>
		http.get<PublicOrganizationDetail>(ORGANIZATIONS.detail(id)),
	nearby: (query: NearbyQuery) =>
		http.getPage<NearbyOrganization>(PUBLISHING.NEARBY, query),
};

export const publishingApi = {
	// Announcements
	listAnnouncements: (orgId: string, query: Partial<PaginationQuery>) =>
		http.getPage<Announcement>(PUBLISHING.announcements(orgId), query),
	listMyAnnouncements: (query: Partial<MyAnnouncementQuery>) =>
		http.getPage<Announcement>(PUBLISHING.MY_ANNOUNCEMENTS, query),
	createAnnouncement: (input: UpsertAnnouncementInput) =>
		http.post<Announcement>(PUBLISHING.MY_ANNOUNCEMENTS, input),
	updateAnnouncement: (id: string, input: UpsertAnnouncementInput) =>
		http.patch<Announcement>(PUBLISHING.announcement(id), input),
	deleteAnnouncement: (id: string) =>
		http.delete<{ deleted: boolean }>(PUBLISHING.announcement(id)),

	// Financial reports
	listReports: (orgId: string) =>
		http.get<FinancialReport[]>(PUBLISHING.reports(orgId)),
	createReport: (input: CreateFinancialReportInput) =>
		http.post<FinancialReport>(PUBLISHING.MY_REPORTS, input),
	deleteReport: (id: string) =>
		http.delete<{ deleted: boolean }>(PUBLISHING.report(id)),

	// Team
	listTeam: (query?: TeamListQuery) =>
		http.get<OrgTeamMember[]>(
			PUBLISHING.TEAM,
			query as Record<string, unknown>,
		),
	listPublicTeam: (orgId: string) =>
		http.get<PublicTeamMember[]>(ORGANIZATIONS.publicTeam(orgId)),
	listTeamInvites: () => http.get<TeamInvite[]>(PUBLISHING.TEAM_INVITES),
	createTeamInvite: (input: InviteTeamMemberInput) =>
		http.post<TeamInvite>(PUBLISHING.TEAM_INVITES, input),
	resendTeamInvite: (id: string) =>
		http.post<TeamInvite>(PUBLISHING.teamInviteResend(id)),
	revokeTeamInvite: (id: string) =>
		http.delete<TeamInvite>(PUBLISHING.teamInvite(id)),
	acceptTeamInvite: (token: string) =>
		http.post<OrgTeamMember>(PUBLISHING.acceptTeamInvite(token)),
	declineTeamInvite: (token: string) =>
		http.post<TeamInvite>(PUBLISHING.declineTeamInvite(token)),
	acceptTeamInviteById: (id: string) =>
		http.post<OrgTeamMember>(PUBLISHING.acceptTeamInviteById(id)),
	declineTeamInviteById: (id: string) =>
		http.post<TeamInvite>(PUBLISHING.declineTeamInviteById(id)),
	updateAdmin: (id: string, input: UpdateOrgAdminInput) =>
		http.patch<OrgTeamMember>(PUBLISHING.teamMember(id), input),
	removeAdmin: (id: string) =>
		http.delete<{ removed: boolean }>(PUBLISHING.teamMember(id)),
	leaveTeam: () => http.post<{ left: boolean }>(PUBLISHING.TEAM_LEAVE),
	requestOwnershipTransfer: (toMemberId: string) =>
		http.post<{ token: string }>(PUBLISHING.TEAM_TRANSFER, { toMemberId }),
	confirmOwnershipTransfer: (token: string) =>
		http.post<{ transferred: boolean }>(PUBLISHING.TEAM_TRANSFER_CONFIRM, {
			token,
		}),

	// Impact
	myImpact: () => http.get<VolunteerImpact>(PUBLISHING.MY_IMPACT),
	organizationImpact: (orgId: string) =>
		http.get<OrganizationImpact>(PUBLISHING.impact(orgId)),
};
