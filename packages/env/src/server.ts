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
		NEON_AUTH_JWKS_URL: z.string().url(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
