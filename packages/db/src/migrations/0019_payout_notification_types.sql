-- Migration 0019: Add payout notification types to notification_type enum
-- Hand-written because drizzle-kit cannot add enum values non-interactively.
-- PostgreSQL requires ALTER TYPE ... ADD VALUE which is committed outside a
-- transaction block, so each ADD VALUE is on its own statement.

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_ACTIVATED';

--> statement-breakpoint

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_ONBOARDING_FAILED';
