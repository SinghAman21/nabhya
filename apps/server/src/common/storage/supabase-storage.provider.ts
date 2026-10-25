import { Logger } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
	AllowedContentType,
	StorageProvider,
	StoredObject,
	UploadTicket,
} from "./storage.types";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;
/** A cached signed link is reused only while it has this long left. */
const SIGNED_URL_MIN_LIFE_MS = 3 * 60 * 1000;
const SIGNED_URL_CACHE_MAX = 5000;

export interface SupabaseStorageConfig {
	url: string;
	serviceRoleKey: string;
}

/**
 * Private Supabase Storage adapter. The service-role key is used only here to
 * mint narrowly scoped, short-lived URLs; it is never returned to a client.
 */
export class SupabaseStorageProvider implements StorageProvider {
	readonly name = "supabase" as const;
	private readonly client: SupabaseClient;
	private readonly url: string;
	private readonly logger = new Logger(SupabaseStorageProvider.name);

	constructor(config: SupabaseStorageConfig) {
		this.url = config.url;
		this.client = createClient(config.url, config.serviceRoleKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
	}

	async createUploadTicket(input: {
		key: string;
		contentType: AllowedContentType;
	}): Promise<UploadTicket> {
		const { bucket, path } = splitKey(input.key);
		const { data, error } = await this.client.storage
			.from(bucket)
			.createSignedUploadUrl(path, { upsert: false });
		if (error || !data)
			throw new Error(`Could not create upload URL: ${error?.message}`);

		return {
			key: input.key,
			url: new URL(data.signedUrl, this.url).toString(),
			headers: {
				"Content-Type": input.contentType,
				"x-upsert": "false",
			},
			expiresAt: new Date(
				Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
			).toISOString(),
		};
	}

	/**
	 * Signed links, reused while they have plenty of life left. Every list
	 * endpoint signs each logo, cover and photo it returns - one Supabase round
	 * trip apiece - and the same few hundred images appear on every request.
	 * A link is handed out again only with at least SIGNED_URL_MIN_LIFE_MS to
	 * run, so a client never receives one about to expire. Bounded: cleared
	 * wholesale past SIGNED_URL_CACHE_MAX entries, which costs one re-sign each.
	 */
	private readonly signedUrls = new Map<
		string,
		{ url: string; expiresAt: number }
	>();

	async createDownloadUrl(
		key: string,
		expiresInSeconds = DOWNLOAD_URL_TTL_SECONDS,
	) {
		if (key.startsWith("http://") || key.startsWith("https://")) return key;
		const cacheKey = `${expiresInSeconds}:${key}`;
		const cached = this.signedUrls.get(cacheKey);
		if (cached && cached.expiresAt - Date.now() > SIGNED_URL_MIN_LIFE_MS) {
			return cached.url;
		}
		const { bucket, path } = splitKey(key);
		const { data, error } = await this.client.storage
			.from(bucket)
			.createSignedUrl(path, expiresInSeconds);
		if (error || !data)
			throw new Error(`Could not create download URL: ${error?.message}`);
		const url = new URL(data.signedUrl, this.url).toString();
		if (this.signedUrls.size >= SIGNED_URL_CACHE_MAX) this.signedUrls.clear();
		this.signedUrls.set(cacheKey, {
			url,
			expiresAt: Date.now() + expiresInSeconds * 1000,
		});
		return url;
	}

	async head(key: string): Promise<StoredObject | null> {
		const { bucket, path } = splitKey(key);
		const { data, error } = await this.client.storage.from(bucket).info(path);
		if (error) {
			if (error.statusCode === "404") return null;
			throw new Error(`Could not inspect uploaded file: ${error.message}`);
		}
		// `size` is typed optional by the SDK but should always be present for a
		// real object; treat a missing size as "not inspectable" rather than
		// defaulting to 0, which would silently bypass the caller's size cap.
		if (!data || data.size === undefined) return null;
		return {
			key,
			size: data.size,
			contentType: data.metadata?.mimetype ?? null,
		};
	}

	async delete(key: string): Promise<void> {
		try {
			const { bucket, path } = splitKey(key);
			const { error } = await this.client.storage.from(bucket).remove([path]);
			if (error) throw error;
		} catch (error) {
			this.logger.warn(
				`Failed to delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async putObject(input: {
		key: string;
		body: Uint8Array;
		contentType: string;
	}): Promise<void> {
		const { bucket, path } = splitKey(input.key);
		const { error } = await this.client.storage
			.from(bucket)
			.upload(path, input.body, {
				contentType: input.contentType,
				upsert: false,
			});
		if (error)
			throw new Error(`Could not store generated file: ${error.message}`);
	}
}

function splitKey(key: string): { bucket: string; path: string } {
	const [bucket, ...segments] = key.split("/");
	const path = segments.join("/");
	if (!bucket || !path)
		throw new Error(`Malformed Supabase Storage key: ${key}`);
	return { bucket, path };
}
