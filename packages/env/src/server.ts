import { config } from "dotenv";

// The server reads env from .env (not .env.local) - apps/native is the one
// that uses .env.local, since Expo's own env loading prioritizes that file.
config({ path: ".env" });

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		DIRECT_URL: z.string().min(1),
		CORS_ORIGIN: z.string().min(1),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// Local k6 runs can raise the IP bucket without weakening production.
		// The throttler configuration additionally checks NODE_ENV.
		PERF_TEST_MODE: z.enum(["0", "1"]).default("0"),
		SUPABASE_AUTH_JWKS_URL: z.string().url(),

		// Supabase Storage is the current bucket backend for uploads when the app
		// is pointed at a real project. The server uses the service-role key only
		// to mint short-lived signed URLs; clients never receive it.
		// Optional: when unset the server falls back to an in-memory stub so the
		// app still boots and every upload path stays exercisable without
		// credentials. The stub refuses to run in production - see StorageModule.
		SUPABASE_URL: z.string().url().optional(),
		SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

		// Razorpay. Optional for the same reason as storage: absent credentials fall
		// back to a stub so the donation flow stays testable locally, and the
		// stub is refused in production. The client opens Razorpay's native
		// checkout SDK with the order id + key id this produces.
		RAZORPAY_KEY_ID: z.string().min(1).optional(),
		RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
		RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),

		// Transactional email - currently used for team invites. The sender is
		// env-driven so the verified Resend domain can be changed without code.
		RESEND_API_KEY: z.string().min(1).optional(),
		MAIL_FROM_EMAIL: z.email().default("noreply@graphex.me"),
		MAIL_FROM_NAME: z.string().min(1).default("Nabhya"),
		TEAM_INVITE_URL_BASE: z.string().url().optional(),

		// Field-level encryption for sensitive financial credentials (bank accounts).
		// Must be a 32-byte hex string (64 characters) used for AES-256-GCM.
		ENCRYPTION_MASTER_KEY: z
			.string()
			.regex(
				/^[0-9a-fA-F]{64}$/,
				"Must be a 64-character hex string (32 bytes)",
			)
			.default(
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
