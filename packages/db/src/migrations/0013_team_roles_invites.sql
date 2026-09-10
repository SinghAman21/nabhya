CREATE TYPE "public"."team_role" AS ENUM('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('ACTIVE', 'SUSPENDED', 'LEFT', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."team_invite_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."ownership_transfer_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'TEAM_INVITE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'TEAM_INVITE_ACCEPTED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'TEAM_ROLE_CHANGED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'TEAM_REMOVED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'OWNERSHIP_TRANSFERRED';--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "role" "team_role" DEFAULT 'MEMBER' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "status" "team_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "invited_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "left_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "organization_admins" SET "role" = CASE WHEN coalesce("is_owner", false) THEN 'OWNER'::"team_role" ELSE 'ADMIN'::"team_role" END, "status" = 'ACTIVE'::"team_status";--> statement-breakpoint
ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "team_role" NOT NULL,
	"designation" varchar(80),
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"status" "team_invite_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"revoked_at" timestamp,
	"resent_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "organization_ownership_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_member_id" uuid NOT NULL,
	"to_member_id" uuid NOT NULL,
	"requested_by" uuid,
	"confirmed_by" uuid,
	"token_hash" text NOT NULL,
	"status" "ownership_transfer_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_from_member_id_organization_admins_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."organization_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_to_member_id_organization_admins_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."organization_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_admins_active_member_unique" ON "organization_admins" USING btree ("organization_id", "user_id") WHERE "organization_admins"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "organization_admins_one_active_owner_per_org" ON "organization_admins" USING btree ("organization_id") WHERE "organization_admins"."role" = 'OWNER' and "organization_admins"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "organization_admins_one_active_owner_per_user" ON "organization_admins" USING btree ("user_id") WHERE "organization_admins"."role" = 'OWNER' and "organization_admins"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "organization_admins_organization_status_idx" ON "organization_admins" USING btree ("organization_id", "status");--> statement-breakpoint
CREATE INDEX "organization_admins_user_status_idx" ON "organization_admins" USING btree ("user_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invites_token_hash_unique" ON "team_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invites_pending_email_per_org_unique" ON "team_invites" USING btree ("organization_id", "email") WHERE "team_invites"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "team_invites_organization_status_idx" ON "team_invites" USING btree ("organization_id", "status");--> statement-breakpoint
CREATE INDEX "team_invites_email_status_idx" ON "team_invites" USING btree ("email", "status");--> statement-breakpoint
CREATE INDEX "team_invites_expires_at_idx" ON "team_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_ownership_transfers_token_hash_unique" ON "organization_ownership_transfers" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_ownership_transfers_pending_org_unique" ON "organization_ownership_transfers" USING btree ("organization_id") WHERE "organization_ownership_transfers"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "organization_ownership_transfers_to_member_idx" ON "organization_ownership_transfers" USING btree ("to_member_id");