ALTER TYPE "public"."user_document_type" ADD VALUE 'PAN_CARD' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."user_document_type" ADD VALUE 'DRIVING_LICENSE' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."user_document_type" ADD VALUE 'VOTER_ID' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."user_document_type" ADD VALUE 'PASSPORT' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."user_document_type" ADD VALUE 'SELFIE' BEFORE 'OTHER';--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "metadata" jsonb;