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
import { users } from "./users";

export const feedMediaTypeEnum = pgEnum("feed_media_type", ["IMAGE", "VIDEO"]);

/** A shared, chronological feed written by volunteers and organisations. */
export const feedPosts = pgTable(
	"feed_posts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		authorUserId: uuid("author_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Timestamp-based storage directory, separate from the database UUID. */
		mediaFolder: varchar("media_folder", { length: 32 }).notNull().unique(),
		text: text("text").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("feed_posts_created_at_idx").on(table.createdAt)],
);

export const feedPostMedia = pgTable(
	"feed_post_media",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		postId: uuid("post_id")
			.notNull()
			.references(() => feedPosts.id, { onDelete: "cascade" }),
		objectKey: text("object_key").notNull().unique(),
		mediaType: feedMediaTypeEnum("media_type").notNull(),
		mimeType: varchar("mime_type", { length: 100 }).notNull(),
		sortOrder: integer("sort_order").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("feed_post_media_post_sort_idx").on(table.postId, table.sortOrder),
	],
);

export const feedPostsRelations = relations(feedPosts, ({ one, many }) => ({
	author: one(users, {
		fields: [feedPosts.authorUserId],
		references: [users.id],
	}),
	media: many(feedPostMedia),
}));

export const feedPostMediaRelations = relations(feedPostMedia, ({ one }) => ({
	post: one(feedPosts, {
		fields: [feedPostMedia.postId],
		references: [feedPosts.id],
	}),
}));
