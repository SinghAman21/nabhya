import { relations } from "drizzle-orm";
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
export const orgStatusEnum = pgEnum("org_status", ["ACTIVE", "SUSPENDED"]);
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
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		// One organization per owner — enforced in the DB so a double-submitted
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
export const organizationAdmins = pgTable("organization_admins", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	designation: varchar("designation"),
	isOwner: boolean("is_owner").default(false),
	joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

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
		documents: many(organizationDocuments),
		events: many(events),
		needs: many(needs),
		organizationCategories: many(organizationCategories),
	}),
);

export const organizationAdminsRelations = relations(
	organizationAdmins,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationAdmins.organizationId],
			references: [organizations.id],
		}),
		user: one(users, {
			fields: [organizationAdmins.userId],
			references: [users.id],
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
