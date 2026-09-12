DROP INDEX IF EXISTS "posts_tag_created_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_id_tag_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "post_interactions_post_tag_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "post_interactions_post_type_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "post_interactions_user_post_like_save_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "post_comments_post_tag_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "post_comments_post_type_created_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "tag";--> statement-breakpoint
ALTER TABLE "post_interactions" DROP COLUMN IF EXISTS "tag";--> statement-breakpoint
ALTER TABLE "post_comments" DROP COLUMN IF EXISTS "tag";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "post_interactions_user_post_like_save_unique" ON "post_interactions" USING btree ("user_id", "target_type", "post_id", "interaction_type") WHERE "post_interactions"."interaction_type" in ('LIKE', 'SAVE');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_interactions_post_type_created_idx" ON "post_interactions" USING btree ("post_id", "target_type", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_comments_post_type_created_idx" ON "post_comments" USING btree ("post_id", "target_type", "created_at");--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_tag";
