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
	DocumentQueueQuery,
	DownloadUrlResponse,
	FeedQuery,
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
	UploadIntentInput,
	UploadOrgDocumentInput,
	UploadTicketResponse,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import type {
	AdminOrgDetail,
	AdminOrgDocument,
	AdminOrgDocumentQueueItem,
	AdminOrgListItem,
	AdminUserDetail,
	AdminUserDocumentQueueItem,
	AdminUserListItem,
	ApplicationListItem,
	AuditLogEntry,
	Category,
	EventApplicant,
	FeedItem,
	MyPledgeListItem,
	MyProfile,
	NeedPledge,
	OnboardingStatus,
	OrgEventDetail,
	OrgEventListItem,
	OrgNeedListItem,
	PublicEvent,
	PublicEventDetail,
	PublicNeed,
} from "@/lib/types";
import {
	ADMIN,
	CATEGORIES,
	EVENTS,
	FEED,
	NEEDS,
	ONBOARDING,
	ORG_EVENTS,
	ORG_NEEDS,
	ORGANIZATIONS,
	UPLOADS,
	USERS,
} from "./endpoints";
import { http } from "./http";

export const usersApi = {
	me: () => http.get<MyProfile>(USERS.ME),
	updateProfile: (input: UpdateUserProfileInput) =>
		http.patch<MyProfile>(USERS.ME, input),
	selectRole: (role: SelectableRole) =>
		http.post<{ role: SelectableRole; roles: string[] }>(USERS.ROLE, { role }),
	documents: () => http.get<AdminOrgDocument[]>(USERS.DOCUMENTS),
	uploadDocument: (input: UploadUserDocumentInput) =>
		http.post<AdminOrgDocument>(USERS.DOCUMENTS, input),
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
	mine: () => http.get<AdminOrgDetail>(ORGANIZATIONS.ME),
	update: (input: UpdateOrganizationInput) =>
		http.patch<AdminOrgDetail>(ORGANIZATIONS.ME, input),
	documents: () => http.get<AdminOrgDocument[]>(ORGANIZATIONS.MY_DOCUMENTS),
	uploadDocument: (input: UploadOrgDocumentInput) =>
		http.post<AdminOrgDocument>(ORGANIZATIONS.MY_DOCUMENTS, input),
};

export const uploadsApi = {
	createIntent: (input: UploadIntentInput) =>
		http.post<UploadTicketResponse>(UPLOADS.INTENT, input),
	/** Signed, short-lived read URL. Document keys are never public. */
	downloadUrl: (key: string) =>
		http.post<DownloadUrlResponse>(UPLOADS.DOWNLOAD_URL, { key }),
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
	detail: (id: string) => http.get<OrgEventDetail>(ORG_EVENTS.detail(id)),
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

export const feedApi = {
	list: (query: Partial<FeedQuery>) => http.getPage<FeedItem>(FEED.LIST, query),
};

export const needsApi = {
	listPublic: (query: Partial<PublicNeedQuery>) =>
		http.getPage<PublicNeed>(NEEDS.LIST, query),
	detail: (id: string) => http.get<PublicNeed>(NEEDS.detail(id)),
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
	orgDocuments: (query: Partial<DocumentQueueQuery>) =>
		http.getPage<AdminOrgDocumentQueueItem>(ADMIN.ORG_DOCUMENTS, query),
	userDocuments: (query: Partial<DocumentQueueQuery>) =>
		http.getPage<AdminUserDocumentQueueItem>(ADMIN.USER_DOCUMENTS, query),
	reviewOrgDocument: (id: string, input: ReviewDocumentInput) =>
		http.patch<{ id: string }>(ADMIN.orgDocument(id), input),
	reviewUserDocument: (id: string, input: ReviewDocumentInput) =>
		http.patch<{ id: string }>(ADMIN.userDocument(id), input),
	auditLogs: (query: Partial<AuditLogQuery>) =>
		http.getPage<AuditLogEntry>(ADMIN.AUDIT_LOGS, query),
};
