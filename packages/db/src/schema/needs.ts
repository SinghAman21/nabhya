import { relations } from "drizzle-orm";
import {
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

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * WANT  — the organization is requesting something (e.g. "200 blankets").
 * OFFER — the organization has surplus to give away (e.g. "40 school desks").
 */
export const needTypeEnum = pgEnum("need_type", ["WANT", "OFFER"]);

export const needStatusEnum = pgEnum("need_status", [
	"OPEN",
	"FULFILLED",
	"CLOSED",
]);

export const needUrgencyEnum = pgEnum("need_urgency", [
	"LOW",
	"MEDIUM",
	"HIGH",
]);

export const pledgeStatusEnum = pgEnum("pledge_status", [
	"PENDING",
	"ACCEPTED",
	"REJECTED",
	"COMPLETED",
	"CANCELLED",
]);

// ─── OrganizationNeed Table ──────────────────────────────────────────────────
export const organizationNeeds = pgTable(
	"organization_needs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		type: needTypeEnum("type").notNull(),
		title: varchar("title").notNull(),
		description: text("description").notNull(),

		// Quantity is optional — "volunteer tutors, as many as possible" is a
		// legitimate post. When present, fulfilledQuantity tracks progress and is
		// only mutated inside the pledge-review transaction.
		quantity: integer("quantity"),
		unit: varchar("unit"), // "blankets", "kg", "hours"
		fulfilledQuantity: integer("fulfilled_quantity").notNull().default(0),

		urgency: needUrgencyEnum("urgency").notNull().default("MEDIUM"),
		status: needStatusEnum("status").notNull().default("OPEN"),

		city: varchar("city"),
		state: varchar("state"),
		expiresAt: timestamp("expires_at"),

		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("organization_needs_organization_idx").on(table.organizationId),
		// Drives the public needs feed.
		index("organization_needs_status_type_idx").on(table.status, table.type),
		index("organization_needs_city_idx").on(table.city),
	],
);

// ─── NeedPledge Table ────────────────────────────────────────────────────────

/**
 * A user's response to a need. On a WANT this is "I will supply N of these";
 * on an OFFER it is "I would like to receive N of these".
 */
export const needPledges = pgTable(
	"need_pledges",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		needId: uuid("need_id")
			.notNull()
			.references(() => organizationNeeds.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		quantity: integer("quantity"),
		message: text("message"),
		status: pledgeStatusEnum("status").notNull().default("PENDING"),
		reviewNote: text("review_note"),
		reviewedBy: uuid("reviewed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("need_pledges_need_status_idx").on(table.needId, table.status),
		index("need_pledges_user_idx").on(table.userId),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const organizationNeedsRelations = relations(
	organizationNeeds,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [organizationNeeds.organizationId],
			references: [organizations.id],
		}),
		creator: one(users, {
			fields: [organizationNeeds.createdBy],
			references: [users.id],
		}),
		pledges: many(needPledges),
	}),
);

export const needPledgesRelations = relations(needPledges, ({ one }) => ({
	need: one(organizationNeeds, {
		fields: [needPledges.needId],
		references: [organizationNeeds.id],
	}),
	user: one(users, {
		fields: [needPledges.userId],
		references: [users.id],
	}),
	reviewer: one(users, {
		fields: [needPledges.reviewedBy],
		references: [users.id],
	}),
}));
