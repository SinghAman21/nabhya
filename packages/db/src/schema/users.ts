import { relations } from "drizzle-orm";
import {
	boolean,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

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
	"OTHER",
]);
export const userDocVerificationStatusEnum = pgEnum(
	"user_doc_verification_status",
	["PENDING", "VERIFIED", "REJECTED"],
);

// ─── User Table ──────────────────────────────────────────────────────────────
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(), // Also sub from Neon Auth
	neonUserId: varchar("neon_user_id").unique(),
	fullName: varchar("full_name"),
	email: varchar("email").unique().notNull(),
	phone: varchar("phone"),
	profileImage: text("profile_image"),
	emailVerified: boolean("email_verified").default(false),
	verificationStatus: verificationStatusEnum("verification_status").default(
		"PENDING",
	),
	status: userStatusEnum("status").default("ACTIVE"),
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
	documentUrl: text("document_url").notNull(),
	verificationStatus: userDocVerificationStatusEnum(
		"verification_status",
	).default("PENDING"),
	remarks: text("remarks"),
	uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
	verifiedBy: uuid("verified_by").references(() => users.id),
	verifiedAt: timestamp("verified_at"),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
	userRoles: many(userRoles),
	userDocuments: many(userDocuments),
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
