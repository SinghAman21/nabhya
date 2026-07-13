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
	name: text("name"),
	role: roleEnum("role").notNull().default("volunteer"),
	phoneNumber: text("phone_number"),
	profilePicture: text("profile_picture"),
	isEmailVerified: text("is_email_verified").default("false"),
	isPhoneVerified: text("is_phone_verified").default("false"),
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
