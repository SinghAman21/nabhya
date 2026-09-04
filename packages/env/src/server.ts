import { config } from "dotenv";

// Load .env.local first (takes priority), then .env as fallback
config({ path: ".env.local" });
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

		// Dodo Payments. Optional for the same reason as R2: absent credentials
		// fall back to a stub so the donation flow stays testable locally, and
		// the stub is refused in production.
		DODO_API_KEY: z.string().min(1).optional(),
		DODO_WEBHOOK_SECRET: z.string().min(1).optional(),
		/**
		 * Dodo is product-based, so variable donations are modelled as N units
		 * of a ₹1 "donation" product. This is that product's id.
		 */
		DODO_DONATION_PRODUCT_ID: z.string().min(1).optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
