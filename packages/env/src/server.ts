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
		/** Server-only credentials for minting Supabase Storage signed URLs. */
		SUPABASE_URL: z.string().url().optional(),
		SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
		/** Existing non-feed media (avatars, covers, certificates, etc.). */
		SUPABASE_DEFAULT_STORAGE_BUCKET: z.string().min(1).default("user_avatars"),

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
