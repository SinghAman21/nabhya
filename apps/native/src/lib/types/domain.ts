import type {
	ApplicationStatus,
	DonationStatus,
	EventStatus,
	NeedStatus,
	NeedType,
	NeedUrgency,
	NotificationType,
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
	city: string | null;
	state: string | null;
	startAt: string;
	endAt: string;
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
	/** Set once the organization confirms the volunteer turned up. */
	attendedAt: string | null;
	volunteer: VolunteerSummary;
	/** The certificate issued for this application, if any. */
	certificate: {
		id: string;
		code: string;
		revokedAt: string | null;
	} | null;
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
	documentKey: string;
	verificationStatus: DocVerificationStatus | null;
	remarks: string | null;
	uploadedAt: string;
}

/**
 * A row of the cross-organization verification queue.
 *
 * Same document shape as the dossier view, plus the owner it belongs to —
 * the queue is sorted by upload time across every NGO, so each row has to
 * name its own organization.
 */
export interface AdminOrgDocumentQueueItem extends AdminOrgDocument {
	organization: {
		id: string;
		organizationName: string;
		verificationStatus: OrgVerificationStatus | null;
	};
}

export interface AdminUserDocumentQueueItem extends AdminOrgDocument {
	user: {
		id: string;
		fullName: string | null;
		email: string;
		verificationStatus: DocVerificationStatus | null;
	};
}

export interface AdminOrgDetail {
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

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotificationItem {
	id: string;
	type: NotificationType;
	title: string;
	body: string | null;
	entityName: string | null;
	entityId: string | null;
	readAt: string | null;
	createdAt: string;
}

// ─── Engagement ──────────────────────────────────────────────────────────────

export interface BookmarkListItem {
	id: string;
	createdAt: string;
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
		city: string | null;
		state: string | null;
		description: string | null;
	};
}

export interface ReviewItem {
	id: string;
	rating: number;
	body: string | null;
	reply: string | null;
	repliedAt: string | null;
	createdAt: string;
	user: { id: string; fullName: string | null; profileImage: string | null };
}

// ─── Certificates ────────────────────────────────────────────────────────────

export interface MyCertificate {
	id: string;
	code: string;
	note: string | null;
	pdfKey: string | null;
	issuedAt: string;
	revokedAt: string | null;
	event: {
		id: string;
		title: string;
		startAt: string;
		city: string | null;
	};
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
	};
}

// ─── Donations ───────────────────────────────────────────────────────────────

export interface MyDonation {
	id: string;
	amountMinor: number;
	currency: string;
	status: DonationStatus;
	message: string | null;
	isAnonymous: boolean;
	receiptNumber: string | null;
	completedAt: string | null;
	createdAt: string;
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
	};
}

/** The 80G-style receipt, available only once the payment has completed. */
export interface DonationReceipt {
	id: string;
	receiptNumber: string | null;
	amountMinor: number;
	currency: string;
	status: DonationStatus;
	completedAt: string | null;
	donorName: string | null;
	donorEmail: string | null;
	organizationName: string;
	organizationCity: string | null;
}

export interface OrgDonation {
	id: string;
	amountMinor: number;
	currency: string;
	status: DonationStatus;
	message: string | null;
	isAnonymous: boolean;
	receiptNumber: string | null;
	completedAt: string | null;
	createdAt: string;
	/** Null when the donor chose to stay anonymous — enforced server-side. */
	donorName: string | null;
}

// ─── Organization directory ──────────────────────────────────────────────────

export interface PublicOrganization {
	id: string;
	organizationName: string;
	orgType: string | null;
	registrationNumber: string | null;
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
	latitude: string | null;
	longitude: string | null;
	teamSize: number | null;
	foundingYear: number | null;
	verificationStatus: OrgVerificationStatus | null;
	status: OrgStatus | null;
	createdAt: string;
	categories: Category[];
	owner?: { id: string; fullName: string | null; email: string };
}

export interface NearbyOrganization {
	id: string;
	organizationName: string;
	description: string | null;
	logo: string | null;
	city: string | null;
	state: string | null;
	latitude: string | null;
	longitude: string | null;
	/** Great-circle distance from the query point, in kilometres. */
	distanceKm: number;
}

// ─── Publishing ──────────────────────────────────────────────────────────────

export interface Announcement {
	id: string;
	organizationId: string;
	title: string;
	body: string;
	coverImageKey: string | null;
	status: "DRAFT" | "PUBLISHED";
	isPinned: boolean;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface FinancialReport {
	id: string;
	organizationId: string;
	type: string;
	title: string;
	financialYear: number;
	documentKey: string;
	notes: string | null;
	createdAt: string;
}

export interface OrgTeamMember {
	id: string;
	designation: string | null;
	isOwner: boolean;
	joinedAt: string;
	user: {
		id: string;
		fullName: string | null;
		email: string;
		profileImage: string | null;
	};
}

export interface AuditLogEntry {
	id: string;
	action: string;
	entityName: string | null;
	entityId: string | null;
	oldValue: unknown;
	newValue: unknown;
	createdAt: string;
	/** Null for system actions, or when the actor has since been deleted. */
	actor: { id: string; fullName: string | null; email: string } | null;
}
