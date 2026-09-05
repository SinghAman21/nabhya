import { relations, sql } from "drizzle-orm";
import {
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const postMediaTypeEnum = pgEnum("post_media_type", ["IMAGE", "VIDEO"]);
export const postTagEnum = pgEnum("post_tag", [
	"POST",
	"EVENT",
	"NEED",
	"ANNOUNCEMENT",
	"URGENT",
]);

/** A shared feed item written by volunteers and organisations. */
export const posts = pgTable(
	"posts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		authorUserId: uuid("author_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id").references(() => organizations.id, {
			onDelete: "set null",
		}),
		tag: postTagEnum("tag").notNull().default("POST"),
		city: varchar("city"),
		state: varchar("state"),
		latitude: decimal("latitude"),
		longitude: decimal("longitude"),
		/** Timestamp-based storage directory, separate from the database UUID. */
		mediaFolder: varchar("media_folder", { length: 32 }).notNull().unique(),
		text: text("text").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("posts_id_tag_unique").on(table.id, table.tag),
		index("posts_created_at_idx").on(table.createdAt),
		index("posts_organization_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		index("posts_tag_created_idx").on(table.tag, table.createdAt),
		index("posts_city_idx").on(table.city),
	],
);

export const postsMedia = pgTable(
	"posts_media",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		postId: uuid("post_id")
			.notNull()
			.references(() => posts.id, { onDelete: "cascade" }),
		objectKey: text("object_key").notNull().unique(),
		mediaType: postMediaTypeEnum("media_type").notNull(),
		mimeType: varchar("mime_type", { length: 100 }).notNull(),
		sortOrder: integer("sort_order").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("posts_media_post_sort_idx").on(table.postId, table.sortOrder),
	],
);

export const postsRelations = relations(posts, ({ one, many }) => ({
	author: one(users, {
		fields: [posts.authorUserId],
		references: [users.id],
	}),
	organization: one(organizations, {
		fields: [posts.organizationId],
		references: [organizations.id],
	}),
	media: many(postsMedia),
}));

export const postsMediaRelations = relations(postsMedia, ({ one }) => ({
	post: one(posts, {
		fields: [postsMedia.postId],
		references: [posts.id],
	}),
}));

export const postInteractionTypeEnum = pgEnum("post_interaction_type", [
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
		tag: postTagEnum("tag").notNull(),
		postId: uuid("post_id").notNull(),
		interactionType: postInteractionTypeEnum("interaction_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
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

export const postComments = pgTable(
	"post_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tag: postTagEnum("tag").notNull(),
		postId: uuid("post_id").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("post_comments_post_tag_created_idx").on(
			table.postId,
			table.tag,
			table.createdAt,
		),
		index("post_comments_user_idx").on(table.userId),
	],
);

export const postCommentsRelations = relations(postComments, ({ one }) => ({
	user: one(users, { fields: [postComments.userId], references: [users.id] }),
}));

// Backward-compatible exports for code that still imports the old symbol names.
export const feedPosts = posts;
export const feedPostMedia = postsMedia;
export const feedMediaTypeEnum = postMediaTypeEnum;
