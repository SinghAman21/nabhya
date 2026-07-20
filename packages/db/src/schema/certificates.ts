import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { eventApplications, events } from "./events";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * A volunteering certificate.
 *
 * Issued against an accepted application that has been marked attended, so a
 * certificate can never exist for someone who did not turn up. The `code` is
 * the public handle: anyone can verify it without an account, which is what
 * makes the certificate meaningful to a third party.
 */
export const certificates = pgTable(
	"certificates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		applicationId: uuid("application_id")
			.notNull()
			.references(() => eventApplications.id, { onDelete: "cascade" }),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		volunteerId: uuid("volunteer_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		/** Short, human-quotable, unique. Printed on the PDF. */
		code: varchar("code").notNull().unique(),
		/** Object key of the rendered PDF; null until generation completes. */
		pdfKey: text("pdf_key"),

		/** Free text the organization adds, e.g. hours contributed. */
		note: text("note"),

		issuedBy: uuid("issued_by").references(() => users.id, {
			onDelete: "set null",
		}),
		issuedAt: timestamp("issued_at").defaultNow().notNull(),
		/** Set when revoked; a revoked code still resolves but reads as void. */
		revokedAt: timestamp("revoked_at"),
		revokedReason: text("revoked_reason"),
	},
	(table) => [
		// One certificate per application — re-issuing replaces the PDF rather
		// than minting a second code for the same participation.
		uniqueIndex("certificates_application_unique").on(table.applicationId),
		index("certificates_volunteer_idx").on(table.volunteerId),
		index("certificates_organization_idx").on(table.organizationId),
	],
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
	application: one(eventApplications, {
		fields: [certificates.applicationId],
		references: [eventApplications.id],
	}),
	event: one(events, {
		fields: [certificates.eventId],
		references: [events.id],
	}),
	volunteer: one(users, {
		fields: [certificates.volunteerId],
		references: [users.id],
	}),
	organization: one(organizations, {
		fields: [certificates.organizationId],
		references: [organizations.id],
	}),
}));
