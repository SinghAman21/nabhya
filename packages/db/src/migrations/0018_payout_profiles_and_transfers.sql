CREATE TYPE "public"."razorpay_onboarding_status" AS ENUM('NOT_STARTED', 'SUBMITTED', 'UNDER_REVIEW', 'ACTIVATED', 'NEEDS_CLARIFICATION', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'PROCESSED', 'FAILED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "organization_payout_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_entity_name" varchar(150) NOT NULL,
	"business_type" varchar(50) NOT NULL,
	"pan" varchar(10) NOT NULL,
	"bank_account_encrypted" text NOT NULL,
	"bank_account_last4" varchar(4) NOT NULL,
	"ifsc" varchar(11) NOT NULL,
	"bank_name" varchar(100),
	"bank_branch" varchar(100),
	"account_holder_name" varchar(120) NOT NULL,
	"signatory_name" varchar(100) NOT NULL,
	"signatory_email" varchar(255) NOT NULL,
	"signatory_phone" varchar(20) NOT NULL,
	"signatory_dob" varchar(10),
	"signatory_pan" varchar(10),
	"signatory_address" text,
	"razorpay_account_id" varchar(50),
	"razorpay_stakeholder_id" varchar(50),
	"razorpay_status" "razorpay_onboarding_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"status_reason" text,
	"requirements_due" text,
	"is_penny_drop_verified" boolean DEFAULT false NOT NULL,
	"penny_drop_registered_name" varchar(150),
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_payout_profiles" ADD CONSTRAINT "organization_payout_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_payout_profiles_org_unique" ON "organization_payout_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_payout_profiles_rzp_acc_unique" ON "organization_payout_profiles" USING btree ("razorpay_account_id");--> statement-breakpoint
CREATE INDEX "org_payout_profiles_status_idx" ON "organization_payout_profiles" USING btree ("razorpay_status");--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "wants_80g" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "donor_pan" varchar(10);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "donor_address" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "platform_fee_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "transfer_amount_minor" integer;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "destination_account_id" varchar(50);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "razorpay_transfer_id" varchar(50);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "transfer_status" "transfer_status";--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "transfer_failure_reason" text;

