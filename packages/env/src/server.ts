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
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		ACCESS_TOKEN_SECRET: z.string().min(32),
		REFRESH_TOKEN_SECRET: z.string().min(32),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
