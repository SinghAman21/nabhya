/**
 * Central query key registry. Keeping them here means an invalidation in one
 * feature can safely target another's cache without importing its hooks.
 */
export const queryKeys = {
	me: ["me"] as const,
	myDocuments: ["me", "documents"] as const,
	onboardingStatus: ["onboarding", "status"] as const,
	categories: ["categories"] as const,

	publicEvents: (params?: unknown) => ["events", "public", params] as const,
	publicEvent: (id: string) => ["events", "public", "detail", id] as const,
	myApplications: (params?: unknown) =>
		["events", "me", "applications", params] as const,

	orgEvents: (params?: unknown) => ["org", "events", params] as const,
	orgEventApplicants: (id: string, params?: unknown) =>
		["org", "events", id, "applications", params] as const,

	publicNeeds: (params?: unknown) => ["needs", "public", params] as const,
	publicNeed: (id: string) => ["needs", "public", "detail", id] as const,
	myPledges: (params?: unknown) => ["needs", "me", "pledges", params] as const,

	orgNeeds: (params?: unknown) => ["org", "needs", params] as const,
	orgNeedPledges: (id: string, params?: unknown) =>
		["org", "needs", id, "pledges", params] as const,

	publicOrganizations: (params?: unknown) =>
		["organizations", "public", params] as const,
	organization: (id: string) => ["organizations", id] as const,
	myOrganization: ["organizations", "me"] as const,
	myOrgDocuments: ["organizations", "me", "documents"] as const,

	adminOverview: ["admin", "overview"] as const,
	adminOrganizations: (params?: unknown) =>
		["admin", "organizations", params] as const,
	adminOrganization: (id: string) => ["admin", "organizations", id] as const,
	adminUsers: (params?: unknown) => ["admin", "users", params] as const,
	adminUser: (id: string) => ["admin", "users", id] as const,
	adminOrgDocuments: (params?: unknown) =>
		["admin", "documents", "organizations", params] as const,
	adminUserDocuments: (params?: unknown) =>
		["admin", "documents", "users", params] as const,
	adminAuditLogs: (params?: unknown) =>
		["admin", "audit-logs", params] as const,
} as const;

/** Broad prefixes for invalidation after a mutation. */
export const queryScopes = {
	events: ["events"] as const,
	orgEvents: ["org", "events"] as const,
	needs: ["needs"] as const,
	orgNeeds: ["org", "needs"] as const,
	organizations: ["organizations"] as const,
	admin: ["admin"] as const,
} as const;
