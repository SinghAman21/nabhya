import { relations } from "drizzle-orm";
import {
	boolean,
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
import { organizations } from "./organizations";
import { users } from "./users";

export const donationStatusEnum = pgEnum("donation_status", [
	"PENDING",
	"COMPLETED",
	"FAILED",
	"REFUNDED",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
	"PENDING",
	"PROCESSED",
	"FAILED",
	"REVERSED",
]);

/**
 * A monetary donation to an organization.
 *
 * Money is never trusted from the client: a donation is created as PENDING with
 * a server-computed amount, and only the payment provider's webhook can move it
 * to COMPLETED. `providerPaymentId` is unique so a webhook replay cannot
 * double-count.
 *
 * Amounts are integer minor units (paise for INR) - never floats.
 */
export const donations = pgTable(
	"donations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		/** Null for a guest donation made without an account. */
		donorUserId: uuid("donor_user_id").references(() => users.id, {
			onDelete: "set null",
		}),

		amountMinor: integer("amount_minor").notNull(),
		currency: varchar("currency").notNull().default("INR"),

		status: donationStatusEnum("status").notNull().default("PENDING"),

		provider: varchar("provider").notNull().default("razorpay"),
		/** Provider's checkout/session handle, used to resume an abandoned flow. */
		providerCheckoutId: varchar("provider_checkout_id"),
		/** Provider's settled payment id. Unique - guards against webhook replay. */
		providerPaymentId: varchar("provider_payment_id"),

		/** Shown to the organization; hidden publicly when anonymous. */
		message: text("message"),
		isAnonymous: boolean("is_anonymous").notNull().default(false),

		/** Sequential-ish public receipt handle, issued on completion. */
		receiptNumber: varchar("receipt_number"),

		donorName: varchar("donor_name"),
		donorEmail: varchar("donor_email"),

		// 80G Tax Exemption & Form 10BD Compliance
		wants80G: boolean("wants_80g").notNull().default(false),
		donorPan: varchar("donor_pan", { length: 10 }),
		donorAddress: text("donor_address"),

		// Razorpay Route Direct Settlement Tracking
		platformFeeMinor: integer("platform_fee_minor").notNull().default(0),
		transferAmountMinor: integer("transfer_amount_minor"),
		destinationAccountId: varchar("destination_account_id", { length: 50 }),
		razorpayTransferId: varchar("razorpay_transfer_id", { length: 50 }),
		transferStatus: transferStatusEnum("transfer_status"),
		transferFailureReason: text("transfer_failure_reason"),

		completedAt: timestamp("completed_at"),
		failureReason: text("failure_reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("donations_provider_payment_unique").on(
			table.providerPaymentId,
		),
		uniqueIndex("donations_receipt_number_unique").on(table.receiptNumber),
		index("donations_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("donations_donor_idx").on(table.donorUserId),
	],
);

export const donationsRelations = relations(donations, ({ one }) => ({
	organization: one(organizations, {
		fields: [donations.organizationId],
		references: [organizations.id],
	}),
	donor: one(users, {
		fields: [donations.donorUserId],
		references: [users.id],
	}),
}));
