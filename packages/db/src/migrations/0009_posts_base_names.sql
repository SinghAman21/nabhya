CREATE TYPE "public"."post_tag" AS ENUM('POST', 'EVENT', 'NEED', 'ANNOUNCEMENT', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."post_media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
ALTER TABLE "feed_post_media" DROP CONSTRAINT IF EXISTS "feed_post_media_post_id_feed_posts_id_fk";--> statement-breakpoint
ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_author_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "feed_interactions" DROP CONSTRAINT IF EXISTS "feed_interactions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "feed_comments" DROP CONSTRAINT IF EXISTS "feed_comments_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_post_media_post_sort_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_posts_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_posts_organization_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_posts_city_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_interactions_user_target_like_save_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_interactions_target_type_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_interactions_user_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_comments_target_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_comments_user_idx";--> statement-breakpoint
ALTER TABLE "feed_posts" RENAME TO "posts";--> statement-breakpoint
ALTER TABLE "feed_post_media" RENAME TO "posts_media";--> statement-breakpoint
ALTER TABLE "feed_interactions" RENAME TO "post_interactions";--> statement-breakpoint
ALTER TABLE "feed_comments" RENAME TO "post_comments";--> statement-breakpoint
ALTER TABLE "posts" RENAME CONSTRAINT "feed_posts_media_folder_unique" TO "posts_media_folder_unique";--> statement-breakpoint
ALTER TABLE "posts_media" RENAME CONSTRAINT "feed_post_media_object_key_unique" TO "posts_media_object_key_unique";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tag" "post_tag" DEFAULT 'POST' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts_media" ALTER COLUMN "media_type" TYPE "post_media_type" USING "media_type"::text::"post_media_type";--> statement-breakpoint
ALTER TABLE "post_interactions" RENAME COLUMN "target_id" TO "post_id";--> statement-breakpoint
ALTER TABLE "post_interactions" RENAME COLUMN "target_type" TO "tag";--> statement-breakpoint
ALTER TABLE "post_interactions" ALTER COLUMN "tag" TYPE "post_tag" USING "tag"::text::"post_tag";--> statement-breakpoint
ALTER TABLE "post_comments" RENAME COLUMN "target_id" TO "post_id";--> statement-breakpoint
ALTER TABLE "post_comments" RENAME COLUMN "target_type" TO "tag";--> statement-breakpoint
ALTER TABLE "post_comments" ALTER COLUMN "tag" TYPE "post_tag" USING "tag"::text::"post_tag";--> statement-breakpoint
DELETE FROM "post_interactions" WHERE "tag" <> 'POST';--> statement-breakpoint
DELETE FROM "post_comments" WHERE "tag" <> 'POST';--> statement-breakpoint
DELETE FROM "post_interactions" WHERE NOT EXISTS (SELECT 1 FROM "posts" WHERE "posts"."id" = "post_interactions"."post_id");--> statement-breakpoint
DELETE FROM "post_comments" WHERE NOT EXISTS (SELECT 1 FROM "posts" WHERE "posts"."id" = "post_comments"."post_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_media" ADD CONSTRAINT "posts_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_interactions" ADD CONSTRAINT "post_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_id_tag_unique" UNIQUE("id", "tag");--> statement-breakpoint
ALTER TABLE "post_interactions" ADD CONSTRAINT "post_interactions_post_tag_posts_fk" FOREIGN KEY ("post_id", "tag") REFERENCES "public"."posts"("id", "tag") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_tag_posts_fk" FOREIGN KEY ("post_id", "tag") REFERENCES "public"."posts"("id", "tag") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_media_post_sort_idx" ON "posts_media" USING btree ("post_id", "sort_order");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_organization_created_idx" ON "posts" USING btree ("organization_id", "created_at");--> statement-breakpoint
CREATE INDEX "posts_tag_created_idx" ON "posts" USING btree ("tag", "created_at");--> statement-breakpoint
CREATE INDEX "posts_city_idx" ON "posts" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "post_interactions_user_post_like_save_unique" ON "post_interactions" USING btree ("user_id", "post_id", "interaction_type") WHERE "post_interactions"."interaction_type" in ('LIKE', 'SAVE');--> statement-breakpoint
CREATE INDEX "post_interactions_post_tag_created_idx" ON "post_interactions" USING btree ("post_id", "tag", "created_at");--> statement-breakpoint
CREATE INDEX "post_interactions_user_created_idx" ON "post_interactions" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "post_comments_post_tag_created_idx" ON "post_comments" USING btree ("post_id", "tag", "created_at");--> statement-breakpoint
CREATE INDEX "post_comments_user_idx" ON "post_comments" USING btree ("user_id");--> statement-breakpoint
DROP TYPE "public"."feed_media_type";--> statement-breakpoint
DROP TYPE "public"."feed_item_type";