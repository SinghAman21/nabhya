ALTER TABLE "organization_needs" RENAME TO "needs";--> statement-breakpoint
ALTER TABLE "needs" RENAME CONSTRAINT "organization_needs_pkey" TO "needs_pkey";--> statement-breakpoint
ALTER TABLE "needs" RENAME CONSTRAINT "organization_needs_organization_id_organizations_id_fk" TO "needs_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "needs" RENAME CONSTRAINT "organization_needs_created_by_users_id_fk" TO "needs_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "need_pledges" RENAME CONSTRAINT "need_pledges_need_id_organization_needs_id_fk" TO "need_pledges_need_id_needs_id_fk";--> statement-breakpoint
ALTER INDEX "organization_needs_organization_idx" RENAME TO "needs_organization_idx";--> statement-breakpoint
ALTER INDEX "organization_needs_status_type_idx" RENAME TO "needs_status_type_idx";--> statement-breakpoint
ALTER INDEX "organization_needs_city_idx" RENAME TO "needs_city_idx";--> statement-breakpoint