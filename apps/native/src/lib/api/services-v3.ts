import type {
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	InviteTeamMemberInput,
	NearbyQuery,
	OrganizationImpact,
	PaginationQuery,
	UpdateOrgAdminInput,
	UpsertAnnouncementInput,
	VolunteerImpact,
} from "@nabhya/shared";
import type {
	Announcement,
	FinancialReport,
	NearbyOrganization,
	OrgTeamMember,
	PublicOrganization,
	TeamInvite,
} from "@/lib/types";
import { ORGANIZATIONS, PUBLISHING } from "./endpoints";
import { http } from "./http";

export const orgDirectoryApi = {
	list: (
		query: Partial<PaginationQuery & { search?: string; city?: string }>,
	) => http.getPage<PublicOrganization>(ORGANIZATIONS.LIST, query),
	detail: (id: string) =>
		http.get<PublicOrganization>(ORGANIZATIONS.detail(id)),
	nearby: (query: NearbyQuery) =>
		http.getPage<NearbyOrganization>(PUBLISHING.NEARBY, query),
};

export const publishingApi = {
	// Announcements
	listAnnouncements: (orgId: string, query: Partial<PaginationQuery>) =>
		http.getPage<Announcement>(PUBLISHING.announcements(orgId), query),
	listMyAnnouncements: (query: Partial<PaginationQuery>) =>
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
	listTeam: () => http.get<OrgTeamMember[]>(PUBLISHING.TEAM),
	listTeamInvites: () => http.get<TeamInvite[]>(PUBLISHING.TEAM_INVITES),
	inviteAdmin: (input: InviteOrgAdminInput) =>
		http.post<OrgTeamMember>(PUBLISHING.TEAM, input),
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
	updateAdmin: (id: string, input: UpdateOrgAdminInput) =>
		http.patch<OrgTeamMember>(PUBLISHING.teamMember(id), input),
	removeAdmin: (id: string) =>
		http.delete<{ removed: boolean }>(PUBLISHING.teamMember(id)),
	leaveTeam: () => http.post<{ left: boolean }>(PUBLISHING.TEAM_LEAVE),
	requestOwnershipTransfer: (toMemberId: string) =>
		http.post<{ token: string }>(PUBLISHING.TEAM_TRANSFER, { toMemberId }),

	// Impact
	myImpact: () => http.get<VolunteerImpact>(PUBLISHING.MY_IMPACT),
	organizationImpact: (orgId: string) =>
		http.get<OrganizationImpact>(PUBLISHING.impact(orgId)),
};
