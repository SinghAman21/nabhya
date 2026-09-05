CREATE TYPE "public"."feed_media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TABLE "feed_post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"media_type" "feed_media_type" NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_post_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "feed_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"media_folder" varchar(32) NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_posts_media_folder_unique" UNIQUE("media_folder")
);
--> statement-breakpoint
ALTER TABLE "feed_post_media" ADD CONSTRAINT "feed_post_media_post_id_feed_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_post_media_post_sort_idx" ON "feed_post_media" USING btree ("post_id","sort_order");--> statement-breakpoint
CREATE INDEX "feed_posts_created_at_idx" ON "feed_posts" USING btree ("created_at");