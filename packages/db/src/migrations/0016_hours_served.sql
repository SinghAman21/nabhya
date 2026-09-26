-- Hours a volunteer actually served at an event, entered by the NGO when it
-- marks attendance (issue #8). Null = the whole event: certificates and impact
-- totals fall back to the event duration, so existing rows need no backfill.
ALTER TABLE "event_applications" ADD COLUMN IF NOT EXISTS "hours_served" numeric(5, 1);
