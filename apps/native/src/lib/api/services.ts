import type {
	AdminActivityItem,
	AdminActivityQuery,
	AdminAnalytics,
	AdminAnalyticsQuery,
	AdminCategory,
	AdminOrgPost,
	AdminOrgPostsQuery,
	AdminOrgQuery,
	AdminOverview,
	AdminTrendQuery,
	AdminTrends,
	AdminUserQuery,
	ApplicationQuery,
	ApplyToEventInput,
	AuditLogQuery,
	BulkResult,
	BulkReviewApplicationsInput,
	BulkReviewDocumentsInput,
	BulkReviewResult,
	CompleteOrgOnboardingPayload,
	CompleteVolunteerOnboardingPayload,
	CreateCategoryInput,
	CreateEventInput,
	CreateFeedCommentInput,
	CreateFeedMediaIntentsInput,
	CreateFeedPostInput,
	CreateNeedInput,
	CreatePledgeInput,
	DocumentQueueQuery,
	DownloadUrlResponse,
	FeedCommentsQuery,
	FeedMediaIntentsResponse,
	FollowingFeedQuery,
	ForYouFeedQuery,
	OrgEventQuery,
	OrgNeedQuery,
	OrgOverview,
	PaginationQuery,
	PledgeQuery,
	PublicEventQuery,
	PublicNeedQuery,
	ReviewApplicationInput,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	ReviewPledgeInput,
	SavedFeedQuery,
	SearchQuery,
	SelectableRole,
	SetOrgStatusInput,
	SetUserStatusInput,
	TrendingFeedQuery,
	UpdateCategoryInput,
	UpdateEventInput,
	UpdateNeedInput,
	UpdateOrganizationInput,
	UpdateUserProfilePayload,
	UploadIntentInput,
	UploadOrgDocumentInput,
	UploadTicketResponse,
	UploadUserDocumentInput,
} from "@nabhya/shared";
import { toFeedItem } from "@/lib/feed-adapter";
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
	FeedApiItem,
	FeedApiItemType,
	FeedComment,
	FeedPostRecord,
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
	PublicNeedDetail,
	SearchResults,
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
	SEARCH,
	UPLOADS,
	USERS,
} from "./endpoints";
import { http } from "./http";

export const usersApi = {
	me: () => http.get<MyProfile>(USERS.ME),
	updateProfile: (input: UpdateUserProfilePayload) =>
		http.patch<MyProfile>(USERS.ME, input),
	selectRole: (role: SelectableRole) =>
		http.post<{ role: SelectableRole; roles: string[] }>(USERS.ROLE, { role }),
	documents: () => http.get<AdminOrgDocument[]>(USERS.DOCUMENTS),
	uploadDocument: (input: UploadUserDocumentInput) =>
		http.post<AdminOrgDocument>(USERS.DOCUMENTS, input),
};

export const onboardingApi = {
	status: () => http.get<OnboardingStatus>(ONBOARDING.STATUS),
	// The payload types are the schemas' *input* side: the wizards post raw form
	// values and the server normalises them. Posting the client-parsed output
	// fails validation - `optionalText` turns "" into null, and null is not
	// valid input for it.
	completeOrganization: (input: CompleteOrgOnboardingPayload) =>
		http.post<{ id: string }>(ONBOARDING.ORGANIZATION, input),
	completeVolunteer: (input: CompleteVolunteerOnboardingPayload) =>
		http.post<MyProfile>(ONBOARDING.VOLUNTEER, input),
};

export const categoriesApi = {
	list: () => http.get<Category[]>(CATEGORIES.LIST),
	adminList: () => http.get<AdminCategory[]>(CATEGORIES.ADMIN),
	create: (input: CreateCategoryInput) =>
		http.post<AdminCategory>(CATEGORIES.ADMIN, input),
	update: (id: string, input: UpdateCategoryInput) =>
		http.patch<AdminCategory>(CATEGORIES.adminCategory(id), input),
	archive: (id: string) =>
		http.delete<AdminCategory>(CATEGORIES.adminCategory(id)),
};

export const searchApi = {
	search: (
		query: Pick<SearchQuery, "search"> & Partial<Omit<SearchQuery, "search">>,
	) => http.get<SearchResults>(SEARCH.LIST, query),
};

export const organizationsApi = {
	mine: () => http.get<AdminOrgDetail>(ORGANIZATIONS.ME),
	overview: () => http.get<OrgOverview>(ORGANIZATIONS.MY_OVERVIEW),
	update: (input: UpdateOrganizationInput) =>
		http.patch<AdminOrgDetail>(ORGANIZATIONS.ME, input),
	documents: () => http.get<AdminOrgDocument[]>(ORGANIZATIONS.MY_DOCUMENTS),
	uploadDocument: (input: UploadOrgDocumentInput) =>
		http.post<AdminOrgDocument>(ORGANIZATIONS.MY_DOCUMENTS, input),
};

/** A ranked feed page, with every row mapped to the client's `FeedItem`. */
async function feedPage(url: string, query: Record<string, unknown>) {
	const page = await http.getPage<FeedApiItem>(url, query);
	return { ...page, items: page.items.map(toFeedItem) };
}

export const feedApi = {
	forYou: (query: Partial<ForYouFeedQuery>) => feedPage(FEED.FOR_YOU, query),
	trending: (query: Partial<TrendingFeedQuery>) =>
		feedPage(FEED.TRENDING, query),
	following: (query: Partial<FollowingFeedQuery>) =>
		feedPage(FEED.FOLLOWING, query),
	saved: (query: Partial<SavedFeedQuery>) => feedPage(FEED.SAVED, query),
	createMediaIntents: (input: CreateFeedMediaIntentsInput) =>
		http.post<FeedMediaIntentsResponse>(FEED.UPLOAD_INTENTS, input),
	create: (input: CreateFeedPostInput) =>
		http.post<FeedPostRecord>(FEED.LIST, input),
	remove: (id: string) => http.delete<{ deleted: boolean }>(FEED.detail(id)),
	react: (
		type: FeedApiItemType,
		id: string,
		action: "like" | "save",
		on: boolean,
	) =>
		on
			? http.post<unknown>(FEED.interaction(type, id, action))
			: http.delete<unknown>(FEED.interaction(type, id, action)),
	interact: (
		type: FeedApiItemType,
		id: string,
		action: "share" | "impression",
	) => http.post<{ recorded: boolean }>(FEED.interaction(type, id, action)),
	listComments: (
		type: FeedApiItemType,
		id: string,
		query: Partial<FeedCommentsQuery>,
	) => http.getPage<FeedComment>(FEED.comments(type, id), query),
	createComment: (
		type: FeedApiItemType,
		id: string,
		input: Pick<CreateFeedCommentInput, "body">,
	) => http.post<FeedComment>(FEED.comments(type, id), input),
	deleteComment: (id: string) =>
		http.delete<{ deleted: boolean }>(FEED.deleteComment(id)),
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
	bulkReview: (id: string, input: BulkReviewApplicationsInput) =>
		http.post<BulkResult>(ORG_EVENTS.bulkReview(id), input),
};

export const needsApi = {
	listPublic: (query: Partial<PublicNeedQuery>) =>
		http.getPage<PublicNeed>(NEEDS.LIST, query),
	detail: (id: string) => http.get<PublicNeedDetail>(NEEDS.detail(id)),
	pledge: (id: string, input: CreatePledgeInput) =>
		http.post<{ id: string }>(NEEDS.pledge(id), input),
	withdrawPledge: (id: string) =>
		http.delete<{ id: string; status: "CANCELLED" }>(NEEDS.withdrawPledge(id)),
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
	pledges: (id: string, query: Partial<PledgeQuery>) =>
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
	organizationActivity: (id: string, query: Partial<AdminActivityQuery>) =>
		http.getPage<AdminActivityItem>(ADMIN.organizationActivity(id), query),
	organizationPosts: (id: string, query: Partial<AdminOrgPostsQuery>) =>
		http.getPage<AdminOrgPost>(ADMIN.organizationPosts(id), query),
	deletePost: (id: string) => http.delete<{ deleted: boolean }>(ADMIN.post(id)),
	trends: (query: Partial<AdminTrendQuery>) =>
		http.get<AdminTrends>(ADMIN.TRENDS, query),
	analytics: (query: Partial<AdminAnalyticsQuery>) =>
		http.get<AdminAnalytics>(ADMIN.ANALYTICS, query),

	users: (query: Partial<AdminUserQuery>) =>
		http.getPage<AdminUserListItem>(ADMIN.USERS, query),
	user: (id: string) => http.get<AdminUserDetail>(ADMIN.user(id)),
	userActivity: (id: string, query: Partial<AdminActivityQuery>) =>
		http.getPage<AdminActivityItem>(ADMIN.userActivity(id), query),
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
	bulkReviewDocuments: (
		kind: "organization" | "user",
		input: BulkReviewDocumentsInput,
	) =>
		http.post<BulkReviewResult>(
			kind === "organization"
				? ADMIN.ORG_DOCUMENTS_BULK
				: ADMIN.USER_DOCUMENTS_BULK,
			input,
		),
	auditLogs: (query: Partial<AuditLogQuery>) =>
		http.getPage<AuditLogEntry>(ADMIN.AUDIT_LOGS, query),
};
