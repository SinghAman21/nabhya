ALTER TABLE "users" RENAME COLUMN "neon_user_id" TO "auth_user_id";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_neon_user_id_unique" TO "users_auth_user_id_unique";
