import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// ─── Announcements ───────────────────────────────────────────────────────────

export const announcementStatusEnum = pgEnum("announcement_status", [
	"DRAFT",
	"PUBLISHED",
]);

/**
 * Public updates from an organization — "we distributed 400 blankets", "our
 * next drive is in Pune". Shown on the org's profile and pushed as a
 * notification to everyone who bookmarked them.
 */
export const announcements = pgTable(
	"announcements",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: varchar("title").notNull(),
		body: text("body").notNull(),
		coverImageKey: text("cover_image_key"),
		status: announcementStatusEnum("status").notNull().default("PUBLISHED"),
		/** Kept at the top of the org's profile until unpinned. */
		isPinned: boolean("is_pinned").notNull().default(false),
		publishedAt: timestamp("published_at").defaultNow(),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("announcements_org_published_idx").on(
			table.organizationId,
			table.publishedAt,
		),
		index("announcements_status_idx").on(table.status),
	],
);

// ─── Financial reports ───────────────────────────────────────────────────────

export const financialReportTypeEnum = pgEnum("financial_report_type", [
	"ANNUAL_REPORT",
	"AUDITED_STATEMENT",
	"FCRA_RETURN",
	"UTILISATION_CERTIFICATE",
	"OTHER",
]);

/**
 * Transparency documents an NGO publishes voluntarily — annual reports, audited
 * statements, FCRA returns.
 *
 * Distinct from `organization_documents`, which are private verification
 * artefacts reviewed by a superadmin. These are public by design: they are the
 * evidence a donor uses to decide whether to trust the organization.
 */
export const financialReports = pgTable(
	"financial_reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		type: financialReportTypeEnum("type").notNull().default("ANNUAL_REPORT"),
		title: varchar("title").notNull(),
		/** Indian financial year the document covers, e.g. 2025 for FY2025-26. */
		financialYear: integer("financial_year").notNull(),
		documentKey: text("document_key").notNull(),
		notes: text("notes"),
		uploadedBy: uuid("uploaded_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("financial_reports_org_year_idx").on(
			table.organizationId,
			table.financialYear,
		),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const announcementsRelations = relations(announcements, ({ one }) => ({
	organization: one(organizations, {
		fields: [announcements.organizationId],
		references: [organizations.id],
	}),
	author: one(users, {
		fields: [announcements.createdBy],
		references: [users.id],
	}),
}));

export const financialReportsRelations = relations(
	financialReports,
	({ one }) => ({
		organization: one(organizations, {
			fields: [financialReports.organizationId],
			references: [organizations.id],
		}),
	}),
);
