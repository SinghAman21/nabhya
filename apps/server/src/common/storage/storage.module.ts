import { env } from "@nabhya/env/server";
import { Global, Logger, Module } from "@nestjs/common";
import { R2StorageProvider } from "./r2-storage.provider";
import { STORAGE_TOKEN, type StorageProvider } from "./storage.types";
import { StubStorageProvider } from "./stub-storage.provider";

const logger = new Logger("StorageModule");

function createProvider(): StorageProvider {
	const configured =
		env.R2_ACCOUNT_ID &&
		env.R2_ACCESS_KEY_ID &&
		env.R2_SECRET_ACCESS_KEY &&
		env.R2_BUCKET;

	if (configured) {
		logger.log(`Object storage: Cloudflare R2 (bucket ${env.R2_BUCKET})`);
		return new R2StorageProvider({
			accountId: env.R2_ACCOUNT_ID as string,
			accessKeyId: env.R2_ACCESS_KEY_ID as string,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
			bucket: env.R2_BUCKET as string,
		});
	}

	// Silently storing nothing in production would mean accepting verification
	// documents that vanish — fail loudly at boot instead.
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
				"R2_SECRET_ACCESS_KEY and R2_BUCKET before starting in production.",
		);
	}

	logger.warn(
		"Object storage: in-memory stub (no R2 credentials). Uploads are simulated " +
			"and discarded — set the R2_* variables in .env.local for real storage.",
	);
	return new StubStorageProvider();
}

@Global()
@Module({
	providers: [{ provide: STORAGE_TOKEN, useFactory: createProvider }],
	exports: [STORAGE_TOKEN],
})
export class StorageModule {}
