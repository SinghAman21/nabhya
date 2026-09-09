const API_PREFIX = "/api";

export const USERS = {
	ME: `${API_PREFIX}/users/me`,
	ROLE: `${API_PREFIX}/users/me/role`,
	DOCUMENTS: `${API_PREFIX}/users/me/documents`,
} as const;

export const ONBOARDING = {
	STATUS: `${API_PREFIX}/onboarding/status`,
	ORGANIZATION: `${API_PREFIX}/onboarding/organization`,
	VOLUNTEER: `${API_PREFIX}/onboarding/volunteer`,
} as const;

export const ORGANIZATIONS = {
	LIST: `${API_PREFIX}/organizations`,
	ME: `${API_PREFIX}/organizations/me`,
	MY_DOCUMENTS: `${API_PREFIX}/organizations/me/documents`,
	detail: (id: string) => `${API_PREFIX}/organizations/${id}`,
} as const;

export const EVENTS = {
	LIST: `${API_PREFIX}/events`,
	MY_APPLICATIONS: `${API_PREFIX}/events/me/applications`,
	detail: (id: string) => `${API_PREFIX}/events/${id}`,
	apply: (id: string) => `${API_PREFIX}/events/${id}/applications`,
	withdraw: (id: string) => `${API_PREFIX}/events/${id}/applications/me`,
} as const;

export const ORG_EVENTS = {
	LIST: `${API_PREFIX}/org/events`,
	CREATE: `${API_PREFIX}/org/events`,
	detail: (id: string) => `${API_PREFIX}/org/events/${id}`,
	applications: (id: string) => `${API_PREFIX}/org/events/${id}/applications`,
	reviewApplication: (id: string, applicationId: string) =>
		`${API_PREFIX}/org/events/${id}/applications/${applicationId}`,
} as const;

export const NEEDS = {
	LIST: `${API_PREFIX}/needs`,
	MY_PLEDGES: `${API_PREFIX}/needs/me/pledges`,
	detail: (id: string) => `${API_PREFIX}/needs/${id}`,
	pledge: (id: string) => `${API_PREFIX}/needs/${id}/pledges`,
	withdrawPledge: (id: string) => `${API_PREFIX}/needs/${id}/pledges/me`,
} as const;

export const ORG_NEEDS = {
	LIST: `${API_PREFIX}/org/needs`,
	CREATE: `${API_PREFIX}/org/needs`,
	detail: (id: string) => `${API_PREFIX}/org/needs/${id}`,
	pledges: (id: string) => `${API_PREFIX}/org/needs/${id}/pledges`,
	reviewPledge: (id: string, pledgeId: string) =>
		`${API_PREFIX}/org/needs/${id}/pledges/${pledgeId}`,
} as const;

export const ADMIN = {
	OVERVIEW: `${API_PREFIX}/admin/overview`,
	TRENDS: `${API_PREFIX}/admin/overview/trends`,
	ANALYTICS: `${API_PREFIX}/admin/analytics`,
	ORGANIZATIONS: `${API_PREFIX}/admin/organizations`,
	USERS: `${API_PREFIX}/admin/users`,
	ORG_DOCUMENTS: `${API_PREFIX}/admin/documents/organizations`,
	USER_DOCUMENTS: `${API_PREFIX}/admin/documents/users`,
	// POST, not PATCH: the body names its own targets, so there is no single
	// resource being patched. Literal segments, so they cannot collide with the
	// `:id` routes.
	ORG_DOCUMENTS_BULK: `${API_PREFIX}/admin/documents/organizations/bulk`,
	USER_DOCUMENTS_BULK: `${API_PREFIX}/admin/documents/users/bulk`,
	AUDIT_LOGS: `${API_PREFIX}/admin/audit-logs`,
	organization: (id: string) => `${API_PREFIX}/admin/organizations/${id}`,
	organizationActivity: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/activity`,
	organizationPosts: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/posts`,
	organizationVerification: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/verification`,
	organizationStatus: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/status`,
	user: (id: string) => `${API_PREFIX}/admin/users/${id}`,
	userActivity: (id: string) => `${API_PREFIX}/admin/users/${id}/activity`,
	userStatus: (id: string) => `${API_PREFIX}/admin/users/${id}/status`,
	orgDocument: (id: string) =>
		`${API_PREFIX}/admin/documents/organizations/${id}`,
	userDocument: (id: string) => `${API_PREFIX}/admin/documents/users/${id}`,
	post: (id: string) => `${API_PREFIX}/admin/posts/${id}`,
} as const;

export const CATEGORIES = {
	LIST: `${API_PREFIX}/categories`,
} as const;

export const SEARCH = {
	LIST: `${API_PREFIX}/search`,
} as const;

export const FEED = {
	LIST: `${API_PREFIX}/feed`,
	FOR_YOU: `${API_PREFIX}/feed/for-you`,
	TRENDING: `${API_PREFIX}/feed/trending`,
	FOLLOWING: `${API_PREFIX}/feed/following`,
	SAVED: `${API_PREFIX}/feed/saved`,
	UPLOAD_INTENTS: `${API_PREFIX}/feed/upload-intents`,
	detail: (id: string) => `${API_PREFIX}/feed/${id}`,
	interaction: (
		type: string,
		id: string,
		action: "like" | "save" | "share" | "impression",
	) => `${API_PREFIX}/feed/${type}/${id}/${action}`,
	comments: (type: string, id: string) =>
		`${API_PREFIX}/feed/${type}/${id}/comments`,
	deleteComment: (id: string) => `${API_PREFIX}/feed/comments/${id}`,
} as const;

export const UPLOADS = {
	INTENT: `${API_PREFIX}/uploads/intent`,
	DOWNLOAD_URL: `${API_PREFIX}/uploads/download-url`,
} as const;

export const NOTIFICATIONS = {
	LIST: `${API_PREFIX}/notifications`,
	UNREAD_COUNT: `${API_PREFIX}/notifications/unread-count`,
	READ: `${API_PREFIX}/notifications/read`,
	BROADCAST: `${API_PREFIX}/notifications/broadcast`,
} as const;

export const ENGAGEMENT = {
	MY_BOOKMARKS: `${API_PREFIX}/me/bookmarks`,
	ORG_REVIEWS: `${API_PREFIX}/org/reviews`,
	bookmark: (id: string) => `${API_PREFIX}/organizations/${id}/bookmark`,
	follow: (id: string) => `${API_PREFIX}/organizations/${id}/follow`,
	reviews: (id: string) => `${API_PREFIX}/organizations/${id}/reviews`,
	myReview: (id: string) => `${API_PREFIX}/organizations/${id}/reviews/me`,
	replyToReview: (reviewId: string) =>
		`${API_PREFIX}/org/reviews/${reviewId}/reply`,
} as const;

export const CERTIFICATES = {
	MINE: `${API_PREFIX}/me/certificates`,
	pdf: (id: string) => `${API_PREFIX}/me/certificates/${id}/pdf`,
	verify: (code: string) => `${API_PREFIX}/certificates/${code}/verify`,
	attendance: (eventId: string, applicationId: string) =>
		`${API_PREFIX}/org/events/${eventId}/applications/${applicationId}/attendance`,
	issue: (eventId: string, applicationId: string) =>
		`${API_PREFIX}/org/events/${eventId}/applications/${applicationId}/certificate`,
	revoke: (id: string) => `${API_PREFIX}/org/certificates/${id}/revoke`,
} as const;

export const DONATIONS = {
	CHECKOUT: `${API_PREFIX}/donations/checkout`,
	MINE: `${API_PREFIX}/me/donations`,
	ORG: `${API_PREFIX}/org/donations`,
	receipt: (id: string) => `${API_PREFIX}/me/donations/${id}/receipt`,
} as const;

export const PUBLISHING = {
	MY_ANNOUNCEMENTS: `${API_PREFIX}/org/announcements`,
	MY_REPORTS: `${API_PREFIX}/org/reports`,
	TEAM: `${API_PREFIX}/org/team`,
	MY_IMPACT: `${API_PREFIX}/me/impact`,
	NEARBY: `${API_PREFIX}/organizations/nearby`,
	announcements: (orgId: string) =>
		`${API_PREFIX}/organizations/${orgId}/announcements`,
	reports: (orgId: string) => `${API_PREFIX}/organizations/${orgId}/reports`,
	impact: (orgId: string) => `${API_PREFIX}/organizations/${orgId}/impact`,
	announcement: (id: string) => `${API_PREFIX}/org/announcements/${id}`,
	report: (id: string) => `${API_PREFIX}/org/reports/${id}`,
	teamMember: (id: string) => `${API_PREFIX}/org/team/${id}`,
} as const;
