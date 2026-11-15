import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const razorpayOnboardingStatusEnum = pgEnum(
	"razorpay_onboarding_status",
	[
		"NOT_STARTED",
		"SUBMITTED",
		"UNDER_REVIEW",
		"ACTIVATED",
		"NEEDS_CLARIFICATION",
		"REJECTED",
		"SUSPENDED",
	],
);

/**
 * Isolated banking & KYC details for Razorpay Route settlements.
 *
 * Keeps bank account numbers and signatory credentials separate from the main
 * organizations table to prevent accidental data leaks in public queries.
 *
 * `bankAccountEncrypted` holds AES-256-GCM ciphertext (`iv:authTag:ciphertext`).
 * `bankAccountLast4` is stored plaintext for UI display (`•••• 5821`).
 */
export const organizationPayoutProfiles = pgTable(
	"organization_payout_profiles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Legal entity & Tax
		legalEntityName: varchar("legal_entity_name", { length: 150 }).notNull(),
		businessType: varchar("business_type", { length: 50 }).notNull(), // trust | society | section8 | ngo
		pan: varchar("pan", { length: 10 }).notNull(),

		// Bank Account (AES-256-GCM Encrypted at rest)
		bankAccountEncrypted: text("bank_account_encrypted").notNull(),
		bankAccountLast4: varchar("bank_account_last4", { length: 4 }).notNull(),
		ifsc: varchar("ifsc", { length: 11 }).notNull(),
		bankName: varchar("bank_name", { length: 100 }),
		bankBranch: varchar("bank_branch", { length: 100 }),
		accountHolderName: varchar("account_holder_name", {
			length: 120,
		}).notNull(),

		// Authorised Signatory / Primary Stakeholder
		signatoryName: varchar("signatory_name", { length: 100 }).notNull(),
		signatoryEmail: varchar("signatory_email", { length: 255 }).notNull(),
		signatoryPhone: varchar("signatory_phone", { length: 20 }).notNull(),
		signatoryDob: varchar("signatory_dob", { length: 10 }), // YYYY-MM-DD
		signatoryPan: varchar("signatory_pan", { length: 10 }),
		signatoryAddress: text("signatory_address"),

		// Razorpay Route identifiers & lifecycle
		razorpayAccountId: varchar("razorpay_account_id", { length: 50 }),
		razorpayStakeholderId: varchar("razorpay_stakeholder_id", { length: 50 }),
		razorpayStatus: razorpayOnboardingStatusEnum("razorpay_status")
			.notNull()
			.default("NOT_STARTED"),
		statusReason: text("status_reason"),
		requirementsDue: text("requirements_due"),

		// Automated verification checks
		isPennyDropVerified: boolean("is_penny_drop_verified")
			.notNull()
			.default(false),
		pennyDropRegisteredName: varchar("penny_drop_registered_name", {
			length: 150,
		}),

		activatedAt: timestamp("activated_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("org_payout_profiles_org_unique").on(table.organizationId),
		uniqueIndex("org_payout_profiles_rzp_acc_unique").on(
			table.razorpayAccountId,
		),
		index("org_payout_profiles_status_idx").on(table.razorpayStatus),
	],
);

export const organizationPayoutProfilesRelations = relations(
	organizationPayoutProfiles,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationPayoutProfiles.organizationId],
			references: [organizations.id],
		}),
	}),
);
