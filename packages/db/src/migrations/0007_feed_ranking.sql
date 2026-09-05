ALTER TABLE "users" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "city" varchar;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "state" varchar;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TYPE "public"."feed_item_type" AS ENUM('POST', 'EVENT', 'NEED', 'ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."feed_interaction_type" AS ENUM('LIKE', 'SAVE', 'SHARE', 'IMPRESSION');--> statement-breakpoint
CREATE TABLE "organization_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "feed_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "feed_item_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"interaction_type" "feed_interaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "feed_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "feed_item_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_interactions" ADD CONSTRAINT "feed_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_posts_organization_created_idx" ON "feed_posts" USING btree ("organization_id", "created_at");--> statement-breakpoint
CREATE INDEX "feed_posts_city_idx" ON "feed_posts" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_follows_user_organization_unique" ON "organization_follows" USING btree ("user_id", "organization_id");--> statement-breakpoint
CREATE INDEX "organization_follows_organization_idx" ON "organization_follows" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_interactions_user_target_like_save_unique" ON "feed_interactions" USING btree ("user_id", "target_type", "target_id", "interaction_type") WHERE "feed_interactions"."interaction_type" in ('LIKE', 'SAVE');--> statement-breakpoint
CREATE INDEX "feed_interactions_target_type_created_idx" ON "feed_interactions" USING btree ("target_type", "target_id", "created_at");--> statement-breakpoint
CREATE INDEX "feed_interactions_user_created_idx" ON "feed_interactions" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "feed_comments_target_created_idx" ON "feed_comments" USING btree ("target_type", "target_id", "created_at");--> statement-breakpoint
CREATE INDEX "feed_comments_user_idx" ON "feed_comments" USING btree ("user_id");