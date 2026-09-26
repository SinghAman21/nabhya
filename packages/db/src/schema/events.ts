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
import { organizations } from "./organizations";
import { users } from "./users";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const eventStatusEnum = pgEnum("event_status", [
	"DRAFT",
	"PUBLISHED",
	"CANCELLED",
	"COMPLETED",
]);

export const applicationStatusEnum = pgEnum("application_status", [
	"PENDING",
	"ACCEPTED",
	"REJECTED",
	"WITHDRAWN",
]);

// ─── Event Table ─────────────────────────────────────────────────────────────
export const events = pgTable(
	"events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: varchar("title").notNull(),
		description: text("description").notNull(),
		coverImage: text("cover_image"),

		// Where
		venue: varchar("venue"),
		address: text("address"),
		city: varchar("city"),
		state: varchar("state"),
		// Optional coordinates powering "events near me". Distance is computed
		// with haversine in SQL rather than PostGIS - one dependency fewer, and
		// accurate enough at city scale.
		latitude: decimal("latitude"),
		longitude: decimal("longitude"),

		// When
		startAt: timestamp("start_at").notNull(),
		endAt: timestamp("end_at").notNull(),
		applicationDeadline: timestamp("application_deadline"),

		// Capacity - acceptedCount is denormalised so public listings avoid a
		// per-row aggregate; it is only ever mutated inside the application
		// review transaction.
		volunteersNeeded: integer("volunteers_needed").notNull().default(1),
		acceptedCount: integer("accepted_count").notNull().default(0),

		status: eventStatusEnum("status").notNull().default("DRAFT"),
		isUrgent: boolean("is_urgent").notNull().default(false),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("events_organization_idx").on(table.organizationId),
		// Drives the public feed: status filter + chronological ordering.
		index("events_status_start_idx").on(table.status, table.startAt),
		index("events_city_idx").on(table.city),
		index("events_urgent_start_idx").on(table.isUrgent, table.startAt),
	],
);

// ─── EventApplication Table ──────────────────────────────────────────────────
export const eventApplications = pgTable(
	"event_applications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		volunteerId: uuid("volunteer_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		status: applicationStatusEnum("status").notNull().default("PENDING"),
		message: text("message"),
		reviewNote: text("review_note"),
		reviewedBy: uuid("reviewed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at"),
		/**
		 * Set when the organization confirms the volunteer turned up. Gates
		 * certificate issuance - a certificate can never exist without it.
		 */
		attendedAt: timestamp("attended_at"),
		appliedAt: timestamp("applied_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		// One application per volunteer per event - the DB is the source of
		// truth for this, not an application-level check.
		uniqueIndex("event_applications_event_volunteer_unique").on(
			table.eventId,
			table.volunteerId,
		),
		index("event_applications_event_status_idx").on(
			table.eventId,
			table.status,
		),
		index("event_applications_volunteer_idx").on(table.volunteerId),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const eventsRelations = relations(events, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [events.organizationId],
		references: [organizations.id],
	}),
	creator: one(users, {
		fields: [events.createdBy],
		references: [users.id],
	}),
	applications: many(eventApplications),
}));

export const eventApplicationsRelations = relations(
	eventApplications,
	({ one }) => ({
		event: one(events, {
			fields: [eventApplications.eventId],
			references: [events.id],
		}),
		volunteer: one(users, {
			fields: [eventApplications.volunteerId],
			references: [users.id],
		}),
		reviewer: one(users, {
			fields: [eventApplications.reviewedBy],
			references: [users.id],
		}),
	}),
);
