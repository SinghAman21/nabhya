/**
 * Central query key registry. Keeping them here means an invalidation in one
 * feature can safely target another's cache without importing its hooks.
 */
export const queryKeys = {
	me: ["me"] as const,
	onboardingStatus: ["onboarding", "status"] as const,
	categories: ["categories"] as const,
	adminCategories: ["admin", "categories"] as const,

	publicEvents: (params?: unknown) => ["events", "public", params] as const,
	publicEvent: (id: string) => ["events", "public", "detail", id] as const,
	myApplications: (params?: unknown) =>
		["events", "me", "applications", params] as const,

	orgEvents: (params?: unknown) => ["org", "events", params] as const,
	orgEvent: (id: string) => ["org", "events", id, "detail"] as const,
	orgEventApplicants: (id: string, params?: unknown) =>
		["org", "events", id, "applications", params] as const,

	publicNeeds: (params?: unknown) => ["needs", "public", params] as const,
	publicNeed: (id: string) => ["needs", "public", "detail", id] as const,
	myPledges: (params?: unknown) => ["needs", "me", "pledges", params] as const,

	orgNeeds: (params?: unknown) => ["org", "needs", params] as const,
	search: (params?: unknown) => ["search", params] as const,
	orgNeedPledges: (id: string, params?: unknown) =>
		["org", "needs", id, "pledges", params] as const,

	organization: (id: string) => ["organizations", id] as const,
	myOrganization: ["organizations", "me"] as const,
	/** Whole-org dashboard counts; invalidated by every events/needs mutation. */
	orgOverview: ["organizations", "me", "overview"] as const,
	myOrgDocuments: ["organizations", "me", "documents"] as const,
	myUserDocuments: ["users", "me", "documents"] as const,
	/** Signed read URL for one stored object key. */
	storedImage: (key: string) => ["uploads", "download-url", key] as const,

	adminOverview: ["admin", "overview"] as const,
	adminTrends: (days: number) => ["admin", "overview", "trends", days] as const,
	adminAnalytics: (params?: unknown) => ["admin", "analytics", params] as const,
	adminOrganizations: (params?: unknown) =>
		["admin", "organizations", params] as const,
	adminOrganization: (id: string) => ["admin", "organizations", id] as const,
	adminOrganizationActivity: (id: string, params?: unknown) =>
		["admin", "organizations", id, "activity", params] as const,
	adminOrganizationPosts: (id: string, params?: unknown) =>
		["admin", "organizations", id, "posts", params] as const,
	adminUsers: (params?: unknown) => ["admin", "users", params] as const,
	adminUser: (id: string) => ["admin", "users", id] as const,
	adminUserActivity: (id: string, params?: unknown) =>
		["admin", "users", id, "activity", params] as const,
	adminOrgDocuments: (params?: unknown) =>
		["admin", "documents", "organizations", params] as const,
	adminUserDocuments: (params?: unknown) =>
		["admin", "documents", "users", params] as const,
	adminAuditLogs: (params?: unknown) =>
		["admin", "audit-logs", params] as const,

	notifications: (params?: unknown) => ["notifications", params] as const,
	unreadCount: ["notifications", "unread-count"] as const,

	bookmarks: (params?: unknown) => ["bookmarks", params] as const,
	following: (params?: unknown) => ["following", params] as const,
	reviews: (id: string, params?: unknown) => ["reviews", id, params] as const,
	myReview: (id: string) => ["reviews", id, "me"] as const,
	orgReviews: (params?: unknown) => ["reviews", "org", params] as const,

	certificates: (params?: unknown) => ["certificates", params] as const,
	certificateVerification: (code: string) =>
		["certificates", "verify", code] as const,

	myDonations: (params?: unknown) => ["donations", "me", params] as const,
	orgDonations: (params?: unknown) => ["donations", "org", params] as const,
	donationReceipt: (id: string) => ["donations", "receipt", id] as const,

	organizations: (params?: unknown) =>
		["organizations", "list", params] as const,
	nearby: (params?: unknown) => ["organizations", "nearby", params] as const,

	announcements: (id: string, params?: unknown) =>
		["announcements", id, params] as const,
	myAnnouncements: (params?: unknown) =>
		["announcements", "me", params] as const,
	reports: (id: string) => ["reports", id] as const,
	team: (params?: unknown) => ["org", "team", params] as const,
	teamInvites: ["org", "team", "invites"] as const,
	publicTeam: (orgId: string) => ["organizations", orgId, "team"] as const,

	feed: (params?: unknown) => ["feed", params] as const,
	feedComments: (id: string, params?: unknown) =>
		["feed", "comments", id, params] as const,

	myImpact: ["impact", "me"] as const,
	orgImpact: (id: string) => ["impact", "org", id] as const,
} as const;

/** Broad prefixes for invalidation after a mutation. */
export const queryScopes = {
	events: ["events"] as const,
	orgEvents: ["org", "events"] as const,
	needs: ["needs"] as const,
	feed: ["feed"] as const,
	orgNeeds: ["org", "needs"] as const,
	admin: ["admin"] as const,
	notifications: ["notifications"] as const,
	bookmarks: ["bookmarks"] as const,
	following: ["following"] as const,
	reviews: ["reviews"] as const,
	certificates: ["certificates"] as const,
	donations: ["donations"] as const,
	organizations: ["organizations"] as const,
	announcements: ["announcements"] as const,
	reports: ["reports"] as const,
	team: ["org", "team"] as const,
	impact: ["impact"] as const,
} as const;
