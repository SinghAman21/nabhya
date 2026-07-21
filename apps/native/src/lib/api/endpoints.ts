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
	ORGANIZATIONS: `${API_PREFIX}/admin/organizations`,
	USERS: `${API_PREFIX}/admin/users`,
	ORG_DOCUMENTS: `${API_PREFIX}/admin/documents/organizations`,
	USER_DOCUMENTS: `${API_PREFIX}/admin/documents/users`,
	AUDIT_LOGS: `${API_PREFIX}/admin/audit-logs`,
	organization: (id: string) => `${API_PREFIX}/admin/organizations/${id}`,
	organizationVerification: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/verification`,
	organizationStatus: (id: string) =>
		`${API_PREFIX}/admin/organizations/${id}/status`,
	user: (id: string) => `${API_PREFIX}/admin/users/${id}`,
	userStatus: (id: string) => `${API_PREFIX}/admin/users/${id}/status`,
	orgDocument: (id: string) =>
		`${API_PREFIX}/admin/documents/organizations/${id}`,
	userDocument: (id: string) => `${API_PREFIX}/admin/documents/users/${id}`,
} as const;

export const CATEGORIES = {
	LIST: `${API_PREFIX}/categories`,
} as const;
