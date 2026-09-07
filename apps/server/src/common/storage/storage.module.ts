import { env } from "@nabhya/env/server";
import { Global, Logger, Module } from "@nestjs/common";
import { STORAGE_TOKEN, type StorageProvider } from "./storage.types";
import { StubStorageProvider } from "./stub-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";

const logger = new Logger("StorageModule");

function createProvider(): StorageProvider {
	const supabaseConfigured = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
	if (supabaseConfigured) {
		logger.log(
			"Object storage: Supabase Storage (feed_media, ngo_verification)",
		);
		return new SupabaseStorageProvider({
			url: env.SUPABASE_URL as string,
			serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
		});
	}

	// Silently storing nothing in production would mean accepting verification
	// documents that vanish — fail loudly at boot instead.
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Object storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
				"before starting in production.",
		);
	}

	logger.warn(
		"Object storage: in-memory stub (no Supabase Storage credentials). Uploads are " +
			"simulated and discarded — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env " +
			"for real storage.",
	);
	return new StubStorageProvider();
}

@Global()
@Module({
	providers: [{ provide: STORAGE_TOKEN, useFactory: createProvider }],
	exports: [STORAGE_TOKEN],
})
export class StorageModule {}
