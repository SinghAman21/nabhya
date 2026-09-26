import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizationAdmins, organizations } from "./organizations";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const verificationStatusEnum = pgEnum("verification_status", [
	"PENDING",
	"VERIFIED",
	"REJECTED",
]);
export const userStatusEnum = pgEnum("user_status", [
	"ACTIVE",
	"SUSPENDED",
	"DELETED",
]);
export const userDocumentTypeEnum = pgEnum("user_document_type", [
	"AADHAR_CARD",
	"PAN_CARD",
	"DRIVING_LICENSE",
	"VOTER_ID",
	"PASSPORT",
	"SELFIE",
	"OTHER",
]);
export const userDocVerificationStatusEnum = pgEnum(
	"user_doc_verification_status",
	["PENDING", "VERIFIED", "REJECTED"],
);

// ─── User Table ──────────────────────────────────────────────────────────────
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(), // Also sub from Supabase Auth
	authUserId: varchar("auth_user_id").unique(),
	fullName: varchar("full_name"),
	email: varchar("email").unique().notNull(),
	phone: varchar("phone"),
	profileImage: text("profile_image"),
	bio: text("bio"),
	city: varchar("city"),
	state: varchar("state"),
	latitude: decimal("latitude"),
	longitude: decimal("longitude"),
	emailVerified: boolean("email_verified").default(false),
	verificationStatus: verificationStatusEnum("verification_status").default(
		"PENDING",
	),
	status: userStatusEnum("status").default("ACTIVE"),
	suspendedReason: text("suspended_reason"),
	// Set when the role-specific onboarding flow is submitted. For an
	// organisation the authoritative signal is still "does an organization row
	// exist", but volunteers have no such row, so this is what gates their
	// entry into the app.
	onboardedAt: timestamp("onboarded_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Role Table ──────────────────────────────────────────────────────────────
export const roles = pgTable("roles", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name").unique().notNull(), // USER, ORG_ADMIN, SUPER_ADMIN
	description: text("description"),
});

// ─── UserRole Table (Many-to-Many) ───────────────────────────────────────────
export const userRoles = pgTable("user_roles", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	roleId: uuid("role_id")
		.notNull()
		.references(() => roles.id, { onDelete: "cascade" }),
	assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

// ─── UserDocument Table ──────────────────────────────────────────────────────
export const userDocuments = pgTable("user_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	documentType: userDocumentTypeEnum("document_type").notNull(),
	documentKey: text("document_key").notNull(),
	verificationStatus: userDocVerificationStatusEnum(
		"verification_status",
	).default("PENDING"),
	remarks: text("remarks"),
	// Optional per-document extras. Only the liveness selfie populates this
	// today: the issued challenge plus an optional second frame's storage key.
	metadata: jsonb("metadata"),
	uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
	verifiedBy: uuid("verified_by").references(() => users.id),
	verifiedAt: timestamp("verified_at"),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
	userRoles: many(userRoles),
	userDocuments: many(userDocuments),
	ownedOrganizations: many(organizations),
	organizationAdmins: many(organizationAdmins),
	// Applications and pledges are intentionally not exposed as reverse
	// relations: both child tables reference users twice (actor + reviewer),
	// which Drizzle cannot disambiguate without relationName. Query those from
	// the child side instead - e.g. eventApplications where volunteerId = ?
}));

export const rolesRelations = relations(roles, ({ many }) => ({
	userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id],
	}),
}));

export const userDocumentsRelations = relations(userDocuments, ({ one }) => ({
	user: one(users, {
		fields: [userDocuments.userId],
		references: [users.id],
	}),
	verifier: one(users, {
		fields: [userDocuments.verifiedBy],
		references: [users.id],
	}),
}));
