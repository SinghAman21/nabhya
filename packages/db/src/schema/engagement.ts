import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
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
import { posts, postTagEnum } from "./feed";
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
		reply: text("reply"),
		repliedAt: timestamp("replied_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
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

// ─── Post interactions ───────────────────────────────────────────────────────
export const feedInteractionTypeEnum = pgEnum("feed_interaction_type", [
	"LIKE",
	"SAVE",
	"SHARE",
	"IMPRESSION",
]);

export const postInteractions = pgTable(
	"post_interactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		postId: uuid("post_id").notNull(),
		tag: postTagEnum("tag").notNull(),
		interactionType: feedInteractionTypeEnum("interaction_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.postId, table.tag],
			foreignColumns: [posts.id, posts.tag],
			name: "post_interactions_post_tag_posts_fk",
		}).onDelete("cascade"),
		uniqueIndex("post_interactions_user_post_like_save_unique")
			.on(table.userId, table.postId, table.interactionType)
			.where(sql`${table.interactionType} in ('LIKE', 'SAVE')`),
		index("post_interactions_post_tag_created_idx").on(
			table.postId,
			table.tag,
			table.createdAt,
		),
		index("post_interactions_user_created_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

// ─── Post comments ───────────────────────────────────────────────────────────
export const postComments = pgTable(
	"post_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		postId: uuid("post_id").notNull(),
		tag: postTagEnum("tag").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.postId, table.tag],
			foreignColumns: [posts.id, posts.tag],
			name: "post_comments_post_tag_posts_fk",
		}).onDelete("cascade"),
		index("post_comments_post_tag_created_idx").on(
			table.postId,
			table.tag,
			table.createdAt,
		),
		index("post_comments_user_idx").on(table.userId),
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
		entityName: varchar("entity_name"),
		entityId: uuid("entity_id"),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
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

export const postInteractionsRelations = relations(
	postInteractions,
	({ one }) => ({
		user: one(users, {
			fields: [postInteractions.userId],
			references: [users.id],
		}),
		post: one(posts, {
			fields: [postInteractions.postId],
			references: [posts.id],
		}),
	}),
);

export const postCommentsRelations = relations(postComments, ({ one }) => ({
	user: one(users, {
		fields: [postComments.userId],
		references: [users.id],
	}),
	post: one(posts, {
		fields: [postComments.postId],
		references: [posts.id],
	}),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// Backward-compatible exports for code that still imports the old symbol names.
export const feedItemTypeEnum = postTagEnum;
export const feedInteractions = postInteractions;
export const feedInteractionsRelations = postInteractionsRelations;
export const feedComments = postComments;
export const feedCommentsRelations = postCommentsRelations;
