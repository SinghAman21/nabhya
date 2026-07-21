import type {
	AdminOrgQuery,
	AdminOverview,
	AdminUserQuery,
	ApplicationQuery,
	ApplyToEventInput,
	AuditLogQuery,
	CompleteOrgOnboardingInput,
	CompleteVolunteerOnboardingInput,
	CreateEventInput,
	CreateNeedInput,
	CreatePledgeInput,
	OrgEventQuery,
	OrgNeedQuery,
	PaginationQuery,
	PublicEventQuery,
	PublicNeedQuery,
	ReviewApplicationInput,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	ReviewPledgeInput,
	SelectableRole,
	SetOrgStatusInput,
	SetUserStatusInput,
	UpdateEventInput,
	UpdateNeedInput,
	UpdateOrganizationInput,
	UpdateUserProfileInput,
	UploadOrgDocumentInput,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import type {
	AdminOrgDetail,
	AdminOrgDocQueueItem,
	AdminOrgListItem,
	AdminUserDetail,
	AdminUserDocQueueItem,
	AdminUserListItem,
	ApplicationListItem,
	AuditLogItem,
	Category,
	DocVerificationStatus,
	EventApplicant,
	MyPledgeListItem,
	MyProfile,
	NeedPledge,
	OnboardingStatus,
	OrganizationDetail,
	OrgEventListItem,
	OrgNeedListItem,
	OwnedDocument,
	PublicEvent,
	PublicEventDetail,
	PublicNeed,
	PublicNeedDetail,
	PublicOrgListItem,
} from "@/lib/types";
import {
	ADMIN,
	CATEGORIES,
	EVENTS,
	NEEDS,
	ONBOARDING,
	ORG_EVENTS,
	ORG_NEEDS,
	ORGANIZATIONS,
	USERS,
} from "./endpoints";
import { http } from "./http";

export const usersApi = {
	me: () => http.get<MyProfile>(USERS.ME),
	updateProfile: (input: UpdateUserProfileInput) =>
		http.patch<MyProfile>(USERS.ME, input),
	selectRole: (role: SelectableRole) =>
		http.post<{ role: SelectableRole; roles: string[] }>(USERS.ROLE, { role }),
	documents: () => http.get<OwnedDocument[]>(USERS.DOCUMENTS),
	uploadDocument: (input: UploadUserDocumentInput) =>
		http.post<OwnedDocument>(USERS.DOCUMENTS, input),
};

export const onboardingApi = {
	status: () => http.get<OnboardingStatus>(ONBOARDING.STATUS),
	completeOrganization: (input: CompleteOrgOnboardingInput) =>
		http.post<{ id: string }>(ONBOARDING.ORGANIZATION, input),
	completeVolunteer: (input: CompleteVolunteerOnboardingInput) =>
		http.post<MyProfile>(ONBOARDING.VOLUNTEER, input),
};

export const categoriesApi = {
	list: () => http.get<Category[]>(CATEGORIES.LIST),
};

export const organizationsApi = {
	listPublic: (
		query: Partial<PaginationQuery> & { search?: string; city?: string },
	) => http.getPage<PublicOrgListItem>(ORGANIZATIONS.LIST, query),
	publicDetail: (id: string) =>
		http.get<OrganizationDetail>(ORGANIZATIONS.detail(id)),
	mine: () => http.get<OrganizationDetail>(ORGANIZATIONS.ME),
	update: (input: UpdateOrganizationInput) =>
		http.patch<OrganizationDetail>(ORGANIZATIONS.ME, input),
	myDocuments: () => http.get<OwnedDocument[]>(ORGANIZATIONS.MY_DOCUMENTS),
	uploadDocument: (input: UploadOrgDocumentInput) =>
		http.post<OwnedDocument>(ORGANIZATIONS.MY_DOCUMENTS, input),
};

export const eventsApi = {
	listPublic: (query: Partial<PublicEventQuery>) =>
		http.getPage<PublicEvent>(EVENTS.LIST, query),
	detail: (id: string) => http.get<PublicEventDetail>(EVENTS.detail(id)),
	apply: (id: string, input: ApplyToEventInput) =>
		http.post<{ id: string }>(EVENTS.apply(id), input),
	withdraw: (id: string) => http.delete<{ id: string }>(EVENTS.withdraw(id)),
	myApplications: (query: Partial<ApplicationQuery>) =>
		http.getPage<ApplicationListItem>(EVENTS.MY_APPLICATIONS, query),
};

export const orgEventsApi = {
	list: (query: Partial<OrgEventQuery>) =>
		http.getPage<OrgEventListItem>(ORG_EVENTS.LIST, query),
	create: (input: CreateEventInput) =>
		http.post<OrgEventListItem>(ORG_EVENTS.CREATE, input),
	update: (id: string, input: UpdateEventInput) =>
		http.patch<OrgEventListItem>(ORG_EVENTS.detail(id), input),
	remove: (id: string) =>
		http.delete<{ deleted: boolean }>(ORG_EVENTS.detail(id)),
	applicants: (id: string, query: Partial<ApplicationQuery>) =>
		http.getPage<EventApplicant>(ORG_EVENTS.applications(id), query),
	reviewApplication: (
		id: string,
		applicationId: string,
		input: ReviewApplicationInput,
	) =>
		http.patch<EventApplicant>(
			ORG_EVENTS.reviewApplication(id, applicationId),
			input,
		),
};

export const needsApi = {
	listPublic: (query: Partial<PublicNeedQuery>) =>
		http.getPage<PublicNeed>(NEEDS.LIST, query),
	detail: (id: string) => http.get<PublicNeedDetail>(NEEDS.detail(id)),
	pledge: (id: string, input: CreatePledgeInput) =>
		http.post<{ id: string }>(NEEDS.pledge(id), input),
	myPledges: (query: Partial<PaginationQuery>) =>
		http.getPage<MyPledgeListItem>(NEEDS.MY_PLEDGES, query),
};

export const orgNeedsApi = {
	list: (query: Partial<OrgNeedQuery>) =>
		http.getPage<OrgNeedListItem>(ORG_NEEDS.LIST, query),
	create: (input: CreateNeedInput) =>
		http.post<OrgNeedListItem>(ORG_NEEDS.CREATE, input),
	update: (id: string, input: UpdateNeedInput) =>
		http.patch<OrgNeedListItem>(ORG_NEEDS.detail(id), input),
	remove: (id: string) =>
		http.delete<{ deleted: boolean }>(ORG_NEEDS.detail(id)),
	pledges: (id: string, query: Partial<PaginationQuery>) =>
		http.getPage<NeedPledge>(ORG_NEEDS.pledges(id), query),
	reviewPledge: (id: string, pledgeId: string, input: ReviewPledgeInput) =>
		http.patch<NeedPledge>(ORG_NEEDS.reviewPledge(id, pledgeId), input),
};

export const adminApi = {
	overview: () => http.get<AdminOverview>(ADMIN.OVERVIEW),
	organizations: (query: Partial<AdminOrgQuery>) =>
		http.getPage<AdminOrgListItem>(ADMIN.ORGANIZATIONS, query),
	organization: (id: string) =>
		http.get<AdminOrgDetail>(ADMIN.organization(id)),
	reviewOrganization: (id: string, input: ReviewOrganizationInput) =>
		http.patch<AdminOrgListItem>(ADMIN.organizationVerification(id), input),
	setOrganizationStatus: (id: string, input: SetOrgStatusInput) =>
		http.patch<AdminOrgListItem>(ADMIN.organizationStatus(id), input),
	users: (query: Partial<AdminUserQuery>) =>
		http.getPage<AdminUserListItem>(ADMIN.USERS, query),
	user: (id: string) => http.get<AdminUserDetail>(ADMIN.user(id)),
	setUserStatus: (id: string, input: SetUserStatusInput) =>
		http.patch<AdminUserListItem>(ADMIN.userStatus(id), input),
	orgDocuments: (
		query: Partial<PaginationQuery> & { status?: DocVerificationStatus },
	) => http.getPage<AdminOrgDocQueueItem>(ADMIN.ORG_DOCUMENTS, query),
	userDocuments: (
		query: Partial<PaginationQuery> & { status?: DocVerificationStatus },
	) => http.getPage<AdminUserDocQueueItem>(ADMIN.USER_DOCUMENTS, query),
	reviewOrgDocument: (id: string, input: ReviewDocumentInput) =>
		http.patch<{ id: string }>(ADMIN.orgDocument(id), input),
	reviewUserDocument: (id: string, input: ReviewDocumentInput) =>
		http.patch<{ id: string }>(ADMIN.userDocument(id), input),
	auditLogs: (query: Partial<AuditLogQuery>) =>
		http.getPage<AuditLogItem>(ADMIN.AUDIT_LOGS, query),
};
