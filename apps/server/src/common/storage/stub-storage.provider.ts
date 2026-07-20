import { Logger } from "@nestjs/common";
import type {
	AllowedContentType,
	StorageProvider,
	StoredObject,
	UploadTicket,
} from "./storage.types";

/**
 * In-memory stand-in used when R2 credentials are absent.
 *
 * Every upload path stays exercisable without credentials — the ticket is
 * issued, the key is recorded, and HEAD succeeds — so document flows can be
 * developed and tested end to end locally. Nothing is persisted, so a restart
 * loses everything, and StorageModule refuses to select this in production.
 */
export class StubStorageProvider implements StorageProvider {
	readonly name = "stub" as const;
	private readonly logger = new Logger(StubStorageProvider.name);
	private readonly objects = new Map<string, StoredObject>();

	async createUploadTicket(input: {
		key: string;
		contentType: AllowedContentType;
	}): Promise<UploadTicket> {
		// Recorded immediately: there is no real endpoint for the client to PUT
		// to, so the object is treated as present the moment it is issued.
		this.objects.set(input.key, {
			key: input.key,
			size: 1,
			contentType: input.contentType,
		});

		this.logger.warn(
			`Storage stub issued a ticket for ${input.key} — nothing will actually be stored.`,
		);

		return {
			key: input.key,
			url: `https://storage.invalid/stub-upload/${encodeURIComponent(input.key)}`,
			headers: { "Content-Type": input.contentType },
			expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
		};
	}

	async createDownloadUrl(key: string): Promise<string> {
		return `https://storage.invalid/stub-download/${encodeURIComponent(key)}`;
	}

	async head(key: string): Promise<StoredObject | null> {
		return this.objects.get(key) ?? null;
	}

	async delete(key: string): Promise<void> {
		this.objects.delete(key);
	}

	async putObject(input: {
		key: string;
		body: Uint8Array;
		contentType: string;
	}): Promise<void> {
		this.objects.set(input.key, {
			key: input.key,
			size: input.body.byteLength,
			contentType: input.contentType,
		});
	}
}
