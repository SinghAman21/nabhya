import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Logger } from "@nestjs/common";
import type {
	AllowedContentType,
	StorageProvider,
	StoredObject,
	UploadTicket,
} from "./storage.types";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

export interface R2Config {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

/**
 * Cloudflare R2 via its S3-compatible API.
 *
 * Uploads go straight from the device to R2 with a pre-signed PUT, so document
 * bytes never pass through this server. The signature pins Content-Type, which
 * means a URL issued for a PDF cannot be reused to upload something else.
 * Size cannot be pinned on a signed PUT, so it is verified with a HEAD once the
 * client confirms the upload.
 */
export class R2StorageProvider implements StorageProvider {
	readonly name = "r2" as const;
	private readonly logger = new Logger(R2StorageProvider.name);
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor(config: R2Config) {
		this.bucket = config.bucket;
		this.client = new S3Client({
			region: "auto",
			endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});
	}

	async createUploadTicket(input: {
		key: string;
		contentType: AllowedContentType;
	}): Promise<UploadTicket> {
		const url = await getSignedUrl(
			this.client,
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: input.key,
				ContentType: input.contentType,
			}),
			{ expiresIn: UPLOAD_URL_TTL_SECONDS },
		);

		return {
			key: input.key,
			url,
			headers: { "Content-Type": input.contentType },
			expiresAt: new Date(
				Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
			).toISOString(),
		};
	}

	createDownloadUrl(key: string, expiresInSeconds = DOWNLOAD_URL_TTL_SECONDS) {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
			{ expiresIn: expiresInSeconds },
		);
	}

	async head(key: string): Promise<StoredObject | null> {
		try {
			const result = await this.client.send(
				new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
			);
			return {
				key,
				size: result.ContentLength ?? 0,
				contentType: result.ContentType ?? null,
			};
		} catch (error) {
			if (isNotFound(error)) return null;
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await this.client.send(
				new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
			);
		} catch (error) {
			// Deleting is always best-effort cleanup — never fail the business
			// action because an orphaned object could not be removed.
			this.logger.warn(
				`Failed to delete ${key}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async putObject(input: {
		key: string;
		body: Uint8Array;
		contentType: string;
	}): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: input.key,
				Body: input.body,
				ContentType: input.contentType,
			}),
		);
	}
}

function isNotFound(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as {
		name?: string;
		$metadata?: { httpStatusCode?: number };
	};
	return (
		candidate.name === "NotFound" ||
		candidate.name === "NoSuchKey" ||
		candidate.$metadata?.httpStatusCode === 404
	);
}
