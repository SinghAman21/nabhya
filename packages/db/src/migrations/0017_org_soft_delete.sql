-- Soft delete for organizations. DELETED hides the NGO exactly as SUSPENDED
-- does and is reversible; nothing hard-deletes an organization, because
-- donations, certificates and the audit trail reference it.
ALTER TYPE "public"."org_status" ADD VALUE 'DELETED';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
