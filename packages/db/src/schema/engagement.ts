import { relations, sql } from "drizzle-orm";
import {
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

// ─── Bookmarks ───────────────────────────────────────────────────────────────
export const bookmarks = pgTable(
	"bookmarks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// Bookmarking is idempotent — the unique index is what makes the toggle
		// safe against double taps.
		uniqueIndex("bookmarks_user_organization_unique").on(
			table.userId,
			table.organizationId,
		),
		index("bookmarks_user_idx").on(table.userId),
	],
);

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviews = pgTable(
	"reviews",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		rating: integer("rating").notNull(),
		body: text("body"),
		/** The organization's public response, shown beneath the review. */
		reply: text("reply"),
		repliedAt: timestamp("replied_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		// One review per person per organization; editing updates it in place.
		uniqueIndex("reviews_organization_user_unique").on(
			table.organizationId,
			table.userId,
		),
		index("reviews_organization_idx").on(table.organizationId),
	],
);

// ─── Organization follows ────────────────────────────────────────────────────

export const organizationFollows = pgTable(
	"organization_follows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("organization_follows_user_organization_unique").on(
			table.userId,
			table.organizationId,
		),
		index("organization_follows_organization_idx").on(table.organizationId),
	],
);

// ─── Feed interactions ───────────────────────────────────────────────────────

export const feedItemTypeEnum = pgEnum("feed_item_type", [
	"POST",
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
]);

export const feedInteractionTypeEnum = pgEnum("feed_interaction_type", [
	"LIKE",
	"SAVE",
	"SHARE",
	"IMPRESSION",
]);

/**
 * A polymorphic engagement record for every item that may appear in the feed.
 * `targetId` intentionally has no foreign key because it can reference four tables.
 */
export const feedInteractions = pgTable(
	"feed_interactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetType: feedItemTypeEnum("target_type").notNull(),
		targetId: uuid("target_id").notNull(),
		interactionType: feedInteractionTypeEnum("interaction_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// LIKE and SAVE are idempotent. SHARE and IMPRESSION intentionally retain
		// every occurrence for analytics.
		uniqueIndex("feed_interactions_user_target_like_save_unique")
			.on(table.userId, table.targetType, table.targetId, table.interactionType)
			.where(sql`${table.interactionType} in ('LIKE', 'SAVE')`),
		index("feed_interactions_target_type_created_idx").on(
			table.targetType,
			table.targetId,
			table.createdAt,
		),
		index("feed_interactions_user_created_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

// ─── Feed comments ───────────────────────────────────────────────────────────

/** Comments on any item that can appear in the feed. */
export const feedComments = pgTable(
	"feed_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetType: feedItemTypeEnum("target_type").notNull(),
		targetId: uuid("target_id").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("feed_comments_target_created_idx").on(
			table.targetType,
			table.targetId,
			table.createdAt,
		),
		index("feed_comments_user_idx").on(table.userId),
	],
);

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationTypeEnum = pgEnum("notification_type", [
	"APPLICATION_ACCEPTED",
	"APPLICATION_REJECTED",
	"NEW_APPLICATION",
	"PLEDGE_ACCEPTED",
	"PLEDGE_REJECTED",
	"NEW_PLEDGE",
	"ORG_VERIFIED",
	"ORG_REJECTED",
	"DOCUMENT_VERIFIED",
	"DOCUMENT_REJECTED",
	"CERTIFICATE_ISSUED",
	"DONATION_RECEIVED",
	"NEW_REVIEW",
	"BROADCAST",
]);

/**
 * In-app notifications, one row per recipient.
 *
 * A broadcast fans out into a row per user rather than being a single record
 * with a join table — it keeps read state and the unread count a plain query
 * on this one table.
 */
export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: notificationTypeEnum("type").notNull(),
		title: varchar("title").notNull(),
		body: text("body"),
		/** What this is about, so the client can deep-link. */
		entityName: varchar("entity_name"),
		entityId: uuid("entity_id"),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// Drives both the inbox and the unread badge.
		index("notifications_user_created_idx").on(table.userId, table.createdAt),
		index("notifications_user_read_idx").on(table.userId, table.readAt),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
	user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
	organization: one(organizations, {
		fields: [bookmarks.organizationId],
		references: [organizations.id],
	}),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
	user: one(users, { fields: [reviews.userId], references: [users.id] }),
	organization: one(organizations, {
		fields: [reviews.organizationId],
		references: [organizations.id],
	}),
}));

export const organizationFollowsRelations = relations(
	organizationFollows,
	({ one }) => ({
		user: one(users, {
			fields: [organizationFollows.userId],
			references: [users.id],
		}),
		organization: one(organizations, {
			fields: [organizationFollows.organizationId],
			references: [organizations.id],
		}),
	}),
);

export const feedInteractionsRelations = relations(
	feedInteractions,
	({ one }) => ({
		user: one(users, {
			fields: [feedInteractions.userId],
			references: [users.id],
		}),
	}),
);

export const feedCommentsRelations = relations(feedComments, ({ one }) => ({
	user: one(users, {
		fields: [feedComments.userId],
		references: [users.id],
	}),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
