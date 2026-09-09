CREATE TYPE "public"."feed_item_type" AS ENUM('POST', 'EVENT', 'NEED', 'ANNOUNCEMENT');--> statement-breakpoint
ALTER TABLE "post_interactions" DROP CONSTRAINT IF EXISTS "post_interactions_post_tag_posts_fk";--> statement-breakpoint
ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_post_tag_posts_fk";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_id_tag_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "posts_tag_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "post_interactions_post_tag_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "post_interactions_user_post_like_save_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "post_comments_post_tag_created_idx";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "type" "feed_item_type" DEFAULT 'POST' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "posts" SET "type" = CASE WHEN "tag" = 'URGENT' THEN 'POST' ELSE "tag"::text::"feed_item_type" END, "is_urgent" = ("tag" = 'URGENT');--> statement-breakpoint
ALTER TABLE "post_interactions" ADD COLUMN "target_type" "feed_item_type" DEFAULT 'POST' NOT NULL;--> statement-breakpoint
UPDATE "post_interactions" SET "target_type" = CASE WHEN "tag" = 'URGENT' THEN 'POST' ELSE "tag"::text::"feed_item_type" END;--> statement-breakpoint
ALTER TABLE "post_comments" ADD COLUMN "target_type" "feed_item_type" DEFAULT 'POST' NOT NULL;--> statement-breakpoint
UPDATE "post_comments" SET "target_type" = CASE WHEN "tag" = 'URGENT' THEN 'POST' ELSE "tag"::text::"feed_item_type" END;--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "tag";--> statement-breakpoint
ALTER TABLE "post_interactions" DROP COLUMN "tag";--> statement-breakpoint
ALTER TABLE "post_comments" DROP COLUMN "tag";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "is_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_id_type_unique" UNIQUE("id", "type");--> statement-breakpoint
CREATE INDEX "posts_type_created_idx" ON "posts" USING btree ("type", "created_at");--> statement-breakpoint
CREATE INDEX "posts_urgent_created_idx" ON "posts" USING btree ("is_urgent", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_interactions_user_post_like_save_unique" ON "post_interactions" USING btree ("user_id", "target_type", "post_id", "interaction_type") WHERE "post_interactions"."interaction_type" in ('LIKE', 'SAVE');--> statement-breakpoint
CREATE INDEX "post_interactions_post_type_created_idx" ON "post_interactions" USING btree ("post_id", "target_type", "created_at");--> statement-breakpoint
CREATE INDEX "post_comments_post_type_created_idx" ON "post_comments" USING btree ("post_id", "target_type", "created_at");--> statement-breakpoint
CREATE INDEX "events_urgent_start_idx" ON "events" USING btree ("is_urgent", "start_at");--> statement-breakpoint
CREATE INDEX "announcements_urgent_published_idx" ON "announcements" USING btree ("is_urgent", "published_at");