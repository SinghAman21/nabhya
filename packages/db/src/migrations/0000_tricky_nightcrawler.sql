CREATE TYPE "public"."donation_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'NEW_APPLICATION', 'PLEDGE_ACCEPTED', 'PLEDGE_REJECTED', 'NEW_PLEDGE', 'ORG_VERIFIED', 'ORG_REJECTED', 'DOCUMENT_VERIFIED', 'DOCUMENT_REJECTED', 'CERTIFICATE_ISSUED', 'DONATION_RECEIVED', 'NEW_REVIEW', 'BROADCAST');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('OPEN', 'FULFILLED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."need_type" AS ENUM('WANT', 'OFFER');--> statement-breakpoint
CREATE TYPE "public"."need_urgency" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."pledge_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."doc_verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('NGO_REGISTRATION_CERTIFICATE', 'PAN_CARD', '80G_CERTIFICATE', '12A_CERTIFICATE', 'GST_CERTIFICATE', 'BANK_ACCOUNT_PROOF', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('TRUST', 'SOCIETY', 'SECTION_8', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."org_verification_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_doc_verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_document_type" AS ENUM('AADHAR_CARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performed_by" uuid,
	"action" varchar NOT NULL,
	"entity_name" varchar,
	"entity_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar NOT NULL,
	"pdf_key" text,
	"note" text,
	"issued_by" uuid,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	CONSTRAINT "certificates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"donor_user_id" uuid,
	"amount_minor" integer NOT NULL,
	"currency" varchar DEFAULT 'INR' NOT NULL,
	"status" "donation_status" DEFAULT 'PENDING' NOT NULL,
	"provider" varchar DEFAULT 'dodo' NOT NULL,
	"provider_checkout_id" varchar,
	"provider_payment_id" varchar,
	"message" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"receipt_number" varchar,
	"donor_name" varchar,
	"donor_email" varchar,
	"completed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar NOT NULL,
	"body" text,
	"entity_name" varchar,
	"entity_id" uuid,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"reply" text,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"attended_at" timestamp,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"cover_image" text,
	"venue" varchar,
	"address" text,
	"city" varchar,
	"state" varchar,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"application_deadline" timestamp,
	"volunteers_needed" integer DEFAULT 1 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "need_pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"quantity" integer,
	"message" text,
	"status" "pledge_status" DEFAULT 'PENDING' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "need_type" NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" integer,
	"unit" varchar,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	"urgency" "need_urgency" DEFAULT 'MEDIUM' NOT NULL,
	"status" "need_status" DEFAULT 'OPEN' NOT NULL,
	"city" varchar,
	"state" varchar,
	"expires_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"designation" varchar,
	"is_owner" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_key" text NOT NULL,
	"verification_status" "doc_verification_status" DEFAULT 'PENDING',
	"remarks" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"organization_name" varchar NOT NULL,
	"org_type" "org_type",
	"registration_number" varchar,
	"email" varchar,
	"phone" varchar,
	"description" text,
	"mission" text,
	"vision" text,
	"website" varchar,
	"logo" text,
	"cover_image" text,
	"address" text,
	"city" varchar,
	"state" varchar,
	"pincode" varchar,
	"latitude" numeric,
	"longitude" numeric,
	"team_size" integer,
	"founding_year" integer,
	"verification_status" "org_verification_status" DEFAULT 'PENDING',
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"status" "org_status" DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type" "user_document_type" NOT NULL,
	"document_key" text NOT NULL,
	"verification_status" "user_doc_verification_status" DEFAULT 'PENDING',
	"remarks" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"neon_user_id" varchar,
	"full_name" varchar,
	"email" varchar NOT NULL,
	"phone" varchar,
	"profile_image" text,
	"bio" text,
	"city" varchar,
	"state" varchar,
	"email_verified" boolean DEFAULT false,
	"verification_status" "verification_status" DEFAULT 'PENDING',
	"status" "user_status" DEFAULT 'ACTIVE',
	"suspended_reason" text,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_neon_user_id_unique" UNIQUE("neon_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_categories" ADD CONSTRAINT "organization_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_categories" ADD CONSTRAINT "organization_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_application_id_event_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."event_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_volunteer_id_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_user_id_users_id_fk" FOREIGN KEY ("donor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_applications" ADD CONSTRAINT "event_applications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_applications" ADD CONSTRAINT "event_applications_volunteer_id_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_applications" ADD CONSTRAINT "event_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_pledges" ADD CONSTRAINT "need_pledges_need_id_organization_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."organization_needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_pledges" ADD CONSTRAINT "need_pledges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_pledges" ADD CONSTRAINT "need_pledges_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_needs" ADD CONSTRAINT "organization_needs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_needs" ADD CONSTRAINT "organization_needs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_categories_org_category_unique" ON "organization_categories" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_categories_user_category_unique" ON "user_categories" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_application_unique" ON "certificates" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "certificates_volunteer_idx" ON "certificates" USING btree ("volunteer_id");--> statement-breakpoint
CREATE INDEX "certificates_organization_idx" ON "certificates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_provider_payment_unique" ON "donations" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_receipt_number_unique" ON "donations" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "donations_organization_status_idx" ON "donations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_organization_unique" ON "bookmarks" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_organization_user_unique" ON "reviews" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "reviews_organization_idx" ON "reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_applications_event_volunteer_unique" ON "event_applications" USING btree ("event_id","volunteer_id");--> statement-breakpoint
CREATE INDEX "event_applications_event_status_idx" ON "event_applications" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_applications_volunteer_idx" ON "event_applications" USING btree ("volunteer_id");--> statement-breakpoint
CREATE INDEX "events_organization_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "events_status_start_idx" ON "events" USING btree ("status","start_at");--> statement-breakpoint
CREATE INDEX "events_city_idx" ON "events" USING btree ("city");--> statement-breakpoint
CREATE INDEX "need_pledges_need_status_idx" ON "need_pledges" USING btree ("need_id","status");--> statement-breakpoint
CREATE INDEX "need_pledges_user_idx" ON "need_pledges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_needs_organization_idx" ON "organization_needs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_needs_status_type_idx" ON "organization_needs" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "organization_needs_city_idx" ON "organization_needs" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_owner_unique" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "organizations_verification_status_idx" ON "organizations" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "organizations_city_idx" ON "organizations" USING btree ("city");