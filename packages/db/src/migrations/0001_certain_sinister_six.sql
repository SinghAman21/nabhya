CREATE TYPE "public"."announcement_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."financial_report_type" AS ENUM('ANNUAL_REPORT', 'AUDITED_STATEMENT', 'FCRA_RETURN', 'UTILISATION_CERTIFICATE', 'OTHER');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"body" text NOT NULL,
	"cover_image_key" text,
	"status" "announcement_status" DEFAULT 'PUBLISHED' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "financial_report_type" DEFAULT 'ANNUAL_REPORT' NOT NULL,
	"title" varchar NOT NULL,
	"financial_year" integer NOT NULL,
	"document_key" text NOT NULL,
	"notes" text,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_org_published_idx" ON "announcements" USING btree ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "financial_reports_org_year_idx" ON "financial_reports" USING btree ("organization_id","financial_year");