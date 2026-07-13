import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ─── Role Enum ───────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", [
	"superadmin",
	"volunteer",
	"organisation",
]);

// ─── Users Table ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: text("email").unique().notNull(),
	passwordHash: text("password_hash").notNull(), // Hashed with bcrypt
	name: text("name"),
	role: roleEnum("role").notNull().default("volunteer"),
	phoneNumber: text("phone_number"),
	profilePicture: text("profile_picture"),
	isEmailVerified: text("is_email_verified").default("false"),
	isPhoneVerified: text("is_phone_verified").default("false"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Email Verification Token ────────────────────────────────────────────────
export const emailVerificationTokens = pgTable("email_verification_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	token: text("token").unique().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Password Reset Token ────────────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	token: text("token").unique().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	refreshToken: text("refresh_token").unique().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── User Verification Document ──────────────────────────────────────────────
export const userVerificationDocuments = pgTable(
	"user_verification_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		documentType: text("document_type").notNull(), // e.g., "aadhar", "pan", "passport"
		documentUrl: text("document_url").notNull(),
		isVerified: text("is_verified").default("false"),
		verifiedAt: timestamp("verified_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
);
