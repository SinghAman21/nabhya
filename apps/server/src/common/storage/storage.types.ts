export const STORAGE_TOKEN = "OBJECT_STORAGE";

/** Where an object lives, which decides its key prefix and access rules. */
export type StoragePurpose =
	| "ORG_DOCUMENT"
	| "USER_DOCUMENT"
	| "ORG_LOGO"
	| "ORG_COVER"
	| "AVATAR"
	| "EVENT_COVER"
	| "FINANCIAL_REPORT"
	| "CERTIFICATE";

/**
 * Content types we accept. Anything outside this list is rejected before a
 * signed URL is handed out — the signature pins Content-Type, so a client
 * cannot upload something else with a URL issued for a PDF.
 */
export const ALLOWED_CONTENT_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
	"video/mp4",
	"video/quicktime",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** 10 MB. Verified server-side after upload, since a signed PUT cannot cap size. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadTicket {
	/** Object key to persist. Never store a signed URL — they expire. */
	key: string;
	/** Pre-signed URL the client PUTs the file body to. */
	url: string;
	/** Headers the client must send verbatim, or the signature won't match. */
	headers: Record<string, string>;
	expiresAt: string;
}

export interface StoredObject {
	key: string;
	size: number;
	contentType: string | null;
}

export interface StorageProvider {
	/** Issues a short-lived upload URL for a key the caller has been granted. */
	createUploadTicket(input: {
		key: string;
		contentType: AllowedContentType;
	}): Promise<UploadTicket>;

	/**
	 * Short-lived read URL. Documents are private — nothing is served from a
	 * public bucket URL.
	 */
	createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

	/** Returns null when the object does not exist. */
	head(key: string): Promise<StoredObject | null>;

	delete(key: string): Promise<void>;

	/** Uploads bytes directly — used for server-generated files like PDFs. */
	putObject(input: {
		key: string;
		body: Uint8Array;
		contentType: string;
	}): Promise<void>;

	/** Identifies the backing implementation, for health checks and logging. */
	readonly name: "stub" | "supabase";
}
