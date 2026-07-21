import type {
	ApplicationStatus,
	EventStatus,
	NeedStatus,
	NeedType,
	NeedUrgency,
	PledgeStatus,
	Role,
} from "@nabhya/shared";

export type OrgVerificationStatus =
	| "PENDING"
	| "UNDER_REVIEW"
	| "VERIFIED"
	| "REJECTED";
export type OrgStatus = "ACTIVE" | "SUSPENDED";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type DocVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface Category {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	icon: string | null;
}

export interface OrganizationSummary {
	id: string;
	organizationName: string;
	logo: string | null;
	city: string | null;
	state: string | null;
	verificationStatus?: OrgVerificationStatus | null;
}

/** A document as its owner sees it (identity or org verification doc). */
export interface OwnedDocument {
	id: string;
	documentType: string;
	documentUrl: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
	verifiedAt: string | null;
}

export interface MyProfile {
	id: string;
	email: string;
	name: string | null;
	phone: string | null;
	profileImage: string | null;
	bio: string | null;
	city: string | null;
	state: string | null;
	emailVerified: boolean | null;
	verificationStatus: DocVerificationStatus | null;
	status: UserStatus | null;
	onboardedAt: string | null;
	role: Role | null;
	roles: Role[];
	interestCategoryIds: string[];
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: OrgVerificationStatus | null;
		status: OrgStatus | null;
		logo: string | null;
		city: string | null;
		state: string | null;
	} | null;
	createdAt: string;
	updatedAt: string;
}

export interface OnboardingStatus {
	role: Role | null;
	needsRoleSelection: boolean;
	isOnboarded: boolean;
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: OrgVerificationStatus | null;
		status: OrgStatus | null;
	} | null;
	verificationStatus: string | null;
}

// ─── Organizations ───────────────────────────────────────────────────────────

export interface PublicOrgListItem {
	id: string;
	organizationName: string;
	description: string | null;
	logo: string | null;
	coverImage: string | null;
	city: string | null;
	state: string | null;
	website: string | null;
	verificationStatus: OrgVerificationStatus | null;
}

/**
 * Shape of GET /organizations/:id and /organizations/me — the full org row
 * plus owner and categories (no admin-only extras like documents or stats).
 */
export interface OrganizationDetail {
	id: string;
	organizationName: string;
	orgType: string | null;
	registrationNumber: string | null;
	email: string | null;
	phone: string | null;
	description: string | null;
	mission: string | null;
	vision: string | null;
	website: string | null;
	logo: string | null;
	coverImage: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	pincode: string | null;
	teamSize: number | null;
	foundingYear: number | null;
	verificationStatus: OrgVerificationStatus | null;
	rejectionReason: string | null;
	status: OrgStatus | null;
	createdAt: string;
	updatedAt: string;
	owner: {
		id: string;
		fullName: string | null;
		email: string;
		phone: string | null;
	};
	categories: Category[];
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface PublicEvent {
	id: string;
	title: string;
	description: string;
	coverImage: string | null;
	venue: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	startAt: string;
	endAt: string;
	applicationDeadline: string | null;
	volunteersNeeded: number;
	acceptedCount: number;
	status: EventStatus;
	createdAt: string;
	organization: OrganizationSummary;
}

export interface MyEventApplication {
	id: string;
	status: ApplicationStatus;
	message: string | null;
	reviewNote: string | null;
	appliedAt: string;
}

export interface PublicEventDetail extends PublicEvent {
	myApplication: MyEventApplication | null;
}

export interface OrgEventListItem {
	id: string;
	title: string;
	description: string;
	venue: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	startAt: string;
	endAt: string;
	applicationDeadline: string | null;
	status: EventStatus;
	volunteersNeeded: number;
	acceptedCount: number;
	coverImage: string | null;
	createdAt: string;
	pendingApplications: number;
}

export interface VolunteerSummary {
	id: string;
	fullName: string | null;
	email: string;
	phone: string | null;
	profileImage: string | null;
	city: string | null;
	verificationStatus: DocVerificationStatus | null;
}

export interface EventApplicant {
	id: string;
	status: ApplicationStatus;
	message: string | null;
	reviewNote: string | null;
	appliedAt: string;
	volunteer: VolunteerSummary;
}

export interface ApplicationListItem {
	id: string;
	status: ApplicationStatus;
	message: string | null;
	reviewNote: string | null;
	appliedAt: string;
	event: {
		id: string;
		title: string;
		startAt: string;
		endAt: string;
		city: string | null;
		coverImage: string | null;
		status: EventStatus;
	};
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
	};
}

// ─── Needs ───────────────────────────────────────────────────────────────────

export interface PublicNeed {
	id: string;
	type: NeedType;
	title: string;
	description: string;
	quantity: number | null;
	unit: string | null;
	fulfilledQuantity: number;
	urgency: NeedUrgency;
	status: NeedStatus;
	city: string | null;
	state: string | null;
	expiresAt: string | null;
	createdAt: string;
	organization: OrganizationSummary;
}

export interface PublicNeedDetail extends PublicNeed {
	myPledge: {
		id: string;
		status: PledgeStatus;
		quantity: number | null;
		message: string | null;
		createdAt: string;
	} | null;
}

export interface OrgNeedListItem {
	id: string;
	type: NeedType;
	title: string;
	description: string;
	quantity: number | null;
	unit: string | null;
	fulfilledQuantity: number;
	urgency: NeedUrgency;
	status: NeedStatus;
	city: string | null;
	state: string | null;
	expiresAt: string | null;
	createdAt: string;
	pendingPledges: number;
}

/** A pledge as the owning organization sees it — who responded. */
export interface NeedPledge {
	id: string;
	status: PledgeStatus;
	quantity: number | null;
	message: string | null;
	reviewNote: string | null;
	createdAt: string;
	user: VolunteerSummary;
}

/** The same pledge as the volunteer sees it — what they responded to. */
export interface MyPledgeListItem {
	id: string;
	status: PledgeStatus;
	quantity: number | null;
	message: string | null;
	reviewNote: string | null;
	createdAt: string;
	need: {
		id: string;
		type: NeedType;
		title: string;
		unit: string | null;
		status: NeedStatus;
	};
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
	};
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminOrgListItem {
	id: string;
	organizationName: string;
	orgType: string | null;
	email: string | null;
	phone: string | null;
	city: string | null;
	state: string | null;
	logo: string | null;
	verificationStatus: OrgVerificationStatus | null;
	status: OrgStatus | null;
	createdAt: string;
	owner: { id: string; fullName: string | null; email: string };
	pendingDocuments: number;
	eventCount: number;
	needCount: number;
}

export interface AdminOrgDocument {
	id: string;
	documentType: string;
	documentUrl: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
}

export interface AdminOrgDetail {
	id: string;
	organizationName: string;
	orgType: string | null;
	registrationNumber: string | null;
	email: string | null;
	phone: string | null;
	description: string | null;
	website: string | null;
	logo: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	pincode: string | null;
	teamSize: number | null;
	foundingYear: number | null;
	verificationStatus: OrgVerificationStatus | null;
	rejectionReason: string | null;
	status: OrgStatus | null;
	createdAt: string;
	owner: {
		id: string;
		fullName: string | null;
		email: string;
		phone: string | null;
		verificationStatus: DocVerificationStatus | null;
		status: UserStatus | null;
		createdAt: string;
	};
	categories: Category[];
	documents: AdminOrgDocument[];
	stats: {
		events: { total: number; published: number };
		needs: { total: number; open: number };
	};
	recentEvents: Array<{
		id: string;
		title: string;
		status: EventStatus;
		startAt: string;
		volunteersNeeded: number;
		acceptedCount: number;
	}>;
}

/** Row in the admin org-document verification queue. */
export interface AdminOrgDocQueueItem {
	id: string;
	documentType: string;
	documentUrl: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: OrgVerificationStatus | null;
	};
}

/** Row in the admin identity-document verification queue. */
export interface AdminUserDocQueueItem {
	id: string;
	documentType: string;
	documentUrl: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
	user: {
		id: string;
		fullName: string | null;
		email: string;
		verificationStatus: DocVerificationStatus | null;
	};
}

export interface AuditLogItem {
	id: string;
	action: string;
	entityName: string;
	entityId: string | null;
	oldValue: unknown;
	newValue: unknown;
	createdAt: string;
	actor: { id: string; fullName: string | null; email: string } | null;
}

export interface AdminUserListItem {
	id: string;
	fullName: string | null;
	email: string;
	phone: string | null;
	profileImage: string | null;
	city: string | null;
	state: string | null;
	verificationStatus: DocVerificationStatus | null;
	status: UserStatus | null;
	onboardedAt: string | null;
	createdAt: string;
	roles: Role[];
	applicationCount: number;
	acceptedCount: number;
	pledgeCount: number;
}

export interface AdminUserDetail {
	id: string;
	fullName: string | null;
	email: string;
	phone: string | null;
	profileImage: string | null;
	bio: string | null;
	city: string | null;
	state: string | null;
	verificationStatus: DocVerificationStatus | null;
	status: UserStatus | null;
	suspendedReason: string | null;
	onboardedAt: string | null;
	createdAt: string;
	roles: Role[];
	documents: AdminOrgDocument[];
	applications: Array<{
		id: string;
		status: ApplicationStatus;
		appliedAt: string;
		reviewedAt: string | null;
		event: {
			id: string;
			title: string;
			startAt: string;
			city: string | null;
			status: EventStatus;
		};
		organization: { id: string; organizationName: string };
	}>;
	pledges: Array<{
		id: string;
		status: PledgeStatus;
		quantity: number | null;
		createdAt: string;
		need: { id: string; title: string; type: NeedType; unit: string | null };
		organization: { id: string; organizationName: string };
	}>;
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: OrgVerificationStatus | null;
		status: OrgStatus | null;
	} | null;
	stats: { applications: number; accepted: number; pledges: number };
}
