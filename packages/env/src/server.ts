import { config } from "dotenv";

// The server reads env from .env (not .env.local) — apps/native is the one
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
		SUPABASE_AUTH_JWKS_URL: z.string().url(),

		// Supabase Storage is the current bucket backend for uploads when the app
		// is pointed at a real project. The server uses the service-role key only
		// to mint short-lived signed URLs; clients never receive it.
		SUPABASE_URL: z.string().url().optional(),
		SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

		// Cloudflare R2 (S3-compatible). All optional: when unset the server
		// falls back to an in-memory stub so the app still boots and every
		// upload path stays exercisable without credentials. The stub refuses
		// to run in production — see StorageModule.
		R2_ACCOUNT_ID: z.string().min(1).optional(),
		R2_ACCESS_KEY_ID: z.string().min(1).optional(),
		R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		R2_BUCKET: z.string().min(1).optional(),
		/** Optional public base URL, for objects served without a signed link. */
		R2_PUBLIC_BASE_URL: z.string().url().optional(),

		// Razorpay. Optional for the same reason as R2: absent credentials fall
		// back to a stub so the donation flow stays testable locally, and the
		// stub is refused in production. The client opens Razorpay's native
		// checkout SDK with the order id + key id this produces.
		RAZORPAY_KEY_ID: z.string().min(1).optional(),
		RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
		RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
