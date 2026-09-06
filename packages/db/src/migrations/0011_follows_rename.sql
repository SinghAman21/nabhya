ALTER TABLE "organization_follows" RENAME TO "follows";--> statement-breakpoint
ALTER TABLE "follows" RENAME CONSTRAINT "organization_follows_pkey" TO "follows_pkey";--> statement-breakpoint
ALTER TABLE "follows" RENAME CONSTRAINT "organization_follows_user_id_users_id_fk" TO "follows_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "follows" RENAME CONSTRAINT "organization_follows_organization_id_organizations_id_fk" TO "follows_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER INDEX "organization_follows_user_organization_unique" RENAME TO "follows_user_organization_unique";--> statement-breakpoint
ALTER INDEX "organization_follows_organization_idx" RENAME TO "follows_organization_idx";--> statement-breakpoint