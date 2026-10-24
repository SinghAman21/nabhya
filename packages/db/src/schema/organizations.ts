import { relations, sql } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizationCategories } from "./categories";
import { events } from "./events";
import { needs } from "./needs";
import { users } from "./users";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const orgVerificationStatusEnum = pgEnum("org_verification_status", [
	"PENDING",
	"UNDER_REVIEW",
	"VERIFIED",
	"REJECTED",
]);
/**
 * `DELETED` is a soft delete: the row and everything hanging off it (events,
 * donations, certificates, audit trail) are kept, the NGO disappears from every
 * public surface exactly as a suspended one does, and a superadmin can restore
 * it. Nothing in the platform hard-deletes an organization.
 */
export const orgStatusEnum = pgEnum("org_status", [
	"ACTIVE",
	"SUSPENDED",
	"DELETED",
]);
export const documentTypeEnum = pgEnum("document_type", [
	"NGO_REGISTRATION_CERTIFICATE",
	"PAN_CARD",
	"80G_CERTIFICATE",
	"12A_CERTIFICATE",
	"GST_CERTIFICATE",
	"BANK_ACCOUNT_PROOF",
	"OTHER",
]);
export const docVerificationStatusEnum = pgEnum("doc_verification_status", [
	"PENDING",
	"VERIFIED",
	"REJECTED",
]);
export const orgTypeEnum = pgEnum("org_type", [
	"TRUST",
	"SOCIETY",
	"SECTION_8",
	"OTHERS",
]);
export const teamRoleEnum = pgEnum("team_role", [
	"OWNER",
	"ADMIN",
	"MANAGER",
	"MEMBER",
	"VIEWER",
]);
export const teamStatusEnum = pgEnum("team_status", [
	"ACTIVE",
	"SUSPENDED",
	"LEFT",
	"REMOVED",
]);
export const teamInviteStatusEnum = pgEnum("team_invite_status", [
	"PENDING",
	"ACCEPTED",
	"DECLINED",
	"REVOKED",
	"EXPIRED",
]);
export const ownershipTransferStatusEnum = pgEnum("ownership_transfer_status", [
	"PENDING",
	"CONFIRMED",
	"CANCELLED",
	"EXPIRED",
]);

// ─── Organization Table ──────────────────────────────────────────────────────
export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerUserId: uuid("owner_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		organizationName: varchar("organization_name").notNull(),
		orgType: orgTypeEnum("org_type"),
		registrationNumber: varchar("registration_number"),
		email: varchar("email"),
		phone: varchar("phone"),
		description: text("description"),
		mission: text("mission"),
		vision: text("vision"),
		website: varchar("website"),
		logo: text("logo"),
		coverImage: text("cover_image"),
		address: text("address"),
		city: varchar("city"),
		state: varchar("state"),
		pincode: varchar("pincode"),
		latitude: decimal("latitude"),
		longitude: decimal("longitude"),
		teamSize: integer("team_size"),
		foundingYear: integer("founding_year"),
		verificationStatus: orgVerificationStatusEnum(
			"verification_status",
		).default("PENDING"),
		rejectionReason: text("rejection_reason"),
		reviewedBy: uuid("reviewed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at"),
		status: orgStatusEnum("status").default("ACTIVE"),
		/** Why the NGO is suspended or deleted. Cleared on reinstatement. */
		statusReason: text("status_reason"),
		/** Set only while `status` is DELETED. */
		deletedAt: timestamp("deleted_at"),
		deletedBy: uuid("deleted_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		// One organization per owner - enforced in the DB so a double-submitted
		// onboarding form cannot create a duplicate NGO.
		uniqueIndex("organizations_owner_unique").on(table.ownerUserId),
		// Drives the superadmin verification queue.
		index("organizations_verification_status_idx").on(table.verificationStatus),
		index("organizations_city_idx").on(table.city),
		// Proximity search filters on a latitude bounding box before computing
		// haversine, so this is what keeps "NGOs near me" off a full scan.
		index("organizations_latitude_idx").on(table.latitude),
	],
);

// ─── OrganizationAdmin Table ─────────────────────────────────────────────────
export const organizationAdmins = pgTable(
	"organization_admins",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		designation: varchar("designation", { length: 80 }),
		role: teamRoleEnum("role").default("MEMBER").notNull(),
		status: teamStatusEnum("status").default("ACTIVE").notNull(),
		isOwner: boolean("is_owner").default(false),
		isPublic: boolean("is_public").default(false).notNull(),
		invitedBy: uuid("invited_by").references(() => users.id, {
			onDelete: "set null",
		}),
		invitedAt: timestamp("invited_at"),
		lastActiveAt: timestamp("last_active_at"),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
		leftAt: timestamp("left_at"),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("organization_admins_active_member_unique")
			.on(table.organizationId, table.userId)
			.where(sql`${table.status} = 'ACTIVE'`),
		uniqueIndex("organization_admins_one_active_owner_per_org")
			.on(table.organizationId)
			.where(sql`${table.role} = 'OWNER' and ${table.status} = 'ACTIVE'`),
		uniqueIndex("organization_admins_one_active_owner_per_user")
			.on(table.userId)
			.where(sql`${table.role} = 'OWNER' and ${table.status} = 'ACTIVE'`),
		index("organization_admins_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("organization_admins_user_status_idx").on(table.userId, table.status),
	],
);

// ─── TeamInvite Table ────────────────────────────────────────────────────────
export const teamInvites = pgTable(
	"team_invites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		email: varchar("email", { length: 320 }).notNull(),
		role: teamRoleEnum("role").notNull(),
		designation: varchar("designation", { length: 80 }),
		tokenHash: text("token_hash").notNull(),
		invitedBy: uuid("invited_by").references(() => users.id, {
			onDelete: "set null",
		}),
		status: teamInviteStatusEnum("status").default("PENDING").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		acceptedBy: uuid("accepted_by").references(() => users.id, {
			onDelete: "set null",
		}),
		acceptedAt: timestamp("accepted_at"),
		declinedAt: timestamp("declined_at"),
		revokedAt: timestamp("revoked_at"),
		resentCount: integer("resent_count").default(0).notNull(),
		lastSentAt: timestamp("last_sent_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("team_invites_token_hash_unique").on(table.tokenHash),
		uniqueIndex("team_invites_pending_email_per_org_unique")
			.on(table.organizationId, table.email)
			.where(sql`${table.status} = 'PENDING'`),
		index("team_invites_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("team_invites_email_status_idx").on(table.email, table.status),
		index("team_invites_expires_at_idx").on(table.expiresAt),
	],
);

// ─── OwnershipTransfer Table ─────────────────────────────────────────────────
export const organizationOwnershipTransfers = pgTable(
	"organization_ownership_transfers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		fromMemberId: uuid("from_member_id")
			.notNull()
			.references(() => organizationAdmins.id, { onDelete: "cascade" }),
		toMemberId: uuid("to_member_id")
			.notNull()
			.references(() => organizationAdmins.id, { onDelete: "cascade" }),
		requestedBy: uuid("requested_by").references(() => users.id, {
			onDelete: "set null",
		}),
		confirmedBy: uuid("confirmed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		tokenHash: text("token_hash").notNull(),
		status: ownershipTransferStatusEnum("status").default("PENDING").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		confirmedAt: timestamp("confirmed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("organization_ownership_transfers_token_hash_unique").on(
			table.tokenHash,
		),
		uniqueIndex("organization_ownership_transfers_pending_org_unique")
			.on(table.organizationId)
			.where(sql`${table.status} = 'PENDING'`),
		index("organization_ownership_transfers_to_member_idx").on(
			table.toMemberId,
		),
	],
);

// ─── OrganizationDocument Table ──────────────────────────────────────────────
export const organizationDocuments = pgTable("organization_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	documentType: documentTypeEnum("document_type").notNull(),
	documentKey: text("document_key").notNull(),
	verificationStatus: docVerificationStatusEnum("verification_status").default(
		"PENDING",
	),
	remarks: text("remarks"),
	uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
	verifiedBy: uuid("verified_by").references(() => users.id),
	verifiedAt: timestamp("verified_at"),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const organizationsRelations = relations(
	organizations,
	({ one, many }) => ({
		owner: one(users, {
			fields: [organizations.ownerUserId],
			references: [users.id],
		}),
		admins: many(organizationAdmins),
		teamInvites: many(teamInvites),
		ownershipTransfers: many(organizationOwnershipTransfers),
		documents: many(organizationDocuments),
		events: many(events),
		needs: many(needs),
		organizationCategories: many(organizationCategories),
	}),
);

export const organizationAdminsRelations = relations(
	organizationAdmins,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [organizationAdmins.organizationId],
			references: [organizations.id],
		}),
		user: one(users, {
			fields: [organizationAdmins.userId],
			references: [users.id],
			relationName: "organizationAdminUser",
		}),
		inviter: one(users, {
			fields: [organizationAdmins.invitedBy],
			references: [users.id],
			relationName: "organizationAdminInviter",
		}),
		outgoingOwnershipTransfers: many(organizationOwnershipTransfers, {
			relationName: "ownershipTransferFromMember",
		}),
		incomingOwnershipTransfers: many(organizationOwnershipTransfers, {
			relationName: "ownershipTransferToMember",
		}),
	}),
);

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
	organization: one(organizations, {
		fields: [teamInvites.organizationId],
		references: [organizations.id],
	}),
	inviter: one(users, {
		fields: [teamInvites.invitedBy],
		references: [users.id],
		relationName: "teamInviteInviter",
	}),
	acceptedByUser: one(users, {
		fields: [teamInvites.acceptedBy],
		references: [users.id],
		relationName: "teamInviteAcceptedBy",
	}),
}));

export const organizationOwnershipTransfersRelations = relations(
	organizationOwnershipTransfers,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationOwnershipTransfers.organizationId],
			references: [organizations.id],
		}),
		fromMember: one(organizationAdmins, {
			fields: [organizationOwnershipTransfers.fromMemberId],
			references: [organizationAdmins.id],
			relationName: "ownershipTransferFromMember",
		}),
		toMember: one(organizationAdmins, {
			fields: [organizationOwnershipTransfers.toMemberId],
			references: [organizationAdmins.id],
			relationName: "ownershipTransferToMember",
		}),
		requester: one(users, {
			fields: [organizationOwnershipTransfers.requestedBy],
			references: [users.id],
			relationName: "ownershipTransferRequester",
		}),
		confirmer: one(users, {
			fields: [organizationOwnershipTransfers.confirmedBy],
			references: [users.id],
			relationName: "ownershipTransferConfirmer",
		}),
	}),
);

export const organizationDocumentsRelations = relations(
	organizationDocuments,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationDocuments.organizationId],
			references: [organizations.id],
		}),
		verifier: one(users, {
			fields: [organizationDocuments.verifiedBy],
			references: [users.id],
		}),
	}),
);
