import { randomUUID } from "node:crypto";
import type { db as dbType } from "@nabhya/db";
import { organizations } from "@nabhya/db/schema";
import type {
	CreateFeedMediaIntentsInput,
	UploadIntentInput,
} from "@nabhya/shared";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import {
	buildFeedMediaKey,
	buildStorageKey,
	FEED_MEDIA_BUCKET,
	FEED_MEDIA_PREFIX,
	MAX_UPLOAD_BYTES,
	parseStorageKey,
	STORAGE_TOKEN,
	type StorageProvider,
	type StoragePurpose,
} from "../../common/storage";
import type { AuthUser } from "../../common/types";

/** Purposes whose objects are scoped to an organization rather than a user. */
const ORG_SCOPED: StoragePurpose[] = [
	"ORG_DOCUMENT",
	"ORG_LOGO",
	"ORG_COVER",
	"EVENT_COVER",
	"FINANCIAL_REPORT",
];

@Injectable()
export class UploadsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	/**
	 * Issues a pre-signed upload URL.
	 *
	 * The key is derived server-side from the caller's identity — the client
	 * never proposes one — so a volunteer cannot obtain a ticket that writes
	 * into another organization's prefix.
	 */
	async createIntent(user: AuthUser, input: UploadIntentInput) {
		const purpose = input.purpose as StoragePurpose;
		const ownerId = await this.resolveOwnerId(user, purpose);
		const key = buildStorageKey({
			purpose,
			ownerId,
			fileName: input.fileName,
			createdAt: new Date(),
		});

		return this.storage.createUploadTicket({
			key,
			contentType: input.contentType,
		});
	}

	/**
	 * Confirms an upload actually landed and is within limits.
	 *
	 * A signed PUT cannot cap body size, so this is where an oversized object is
	 * caught. Callers run it before persisting a key against a document row.
	 */
	async assertUploaded(key: string): Promise<void> {
		const object = await this.storage.head(key);

		if (!object) {
			throw new BadRequestException(
				"That file was not uploaded. Please try again.",
			);
		}
		if (object.size > MAX_UPLOAD_BYTES) {
			await this.storage.delete(key);
			throw new BadRequestException("Files must be under 10 MB.");
		}
	}

	createEmptyFeedMediaFolder(): string {
		const timestamp = Date.now().toString().padStart(12, "0").slice(-12);
		return `${timestamp}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
	}

	async createFeedMediaIntents(
		user: AuthUser,
		files: CreateFeedMediaIntentsInput["files"],
	) {
		const mediaFolder = this.createEmptyFeedMediaFolder();
		const tickets = await Promise.all(
			files.map(async (file) => {
				const key = buildFeedMediaKey({
					ownerId: user.id,
					mediaFolder,
					fileName: file.fileName,
				});
				return this.storage.createUploadTicket({
					key,
					contentType: file.contentType,
				});
			}),
		);
		return { mediaFolder, tickets };
	}

	async assertFeedMediaKeys(
		user: AuthUser,
		mediaFolder: string,
		keys: string[],
	): Promise<void> {
		if (!/^\d{12}-[a-z0-9]{6}$/.test(mediaFolder))
			throw new BadRequestException("Malformed feed media folder");
		const prefix = `${FEED_MEDIA_BUCKET}/${FEED_MEDIA_PREFIX}/${user.id}/${mediaFolder}/`;
		if (keys.some((key) => !key.startsWith(prefix)))
			throw new ForbiddenException("You cannot use these media files.");
		await Promise.all(
			keys.map(async (key) => {
				const object = await this.storage.head(key);
				if (!object)
					throw new BadRequestException("That feed media was not uploaded.");
				if (object.size > 25 * 1024 * 1024) {
					await this.storage.delete(key);
					throw new BadRequestException("Feed media must be under 25 MB.");
				}
			}),
		);
	}

	/**
	 * Signed read URL, gated on the caller owning the object or being a
	 * superadmin. Ownership is read from the key itself, which always encodes
	 * the owning user or organization.
	 */
	async createDownloadUrl(user: AuthUser, key: string) {
		const parsed = parseStorageKey(key);
		if (!parsed) {
			throw new BadRequestException("Malformed file reference");
		}

		const isSuperadmin = user.roles.includes("superadmin");
		if (!isSuperadmin) {
			const ownerId = await this.resolveOwnerId(user, parsed.purpose);
			if (ownerId !== parsed.ownerId) {
				throw new ForbiddenException("You cannot access this file.");
			}
		}

		const object = await this.storage.head(key);
		if (!object) {
			throw new NotFoundException("File not found");
		}

		const expiresInSeconds = 10 * 60;
		return {
			url: await this.storage.createDownloadUrl(key, expiresInSeconds),
			expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
		};
	}

	/** Org-scoped objects belong to the caller's organization, others to them. */
	private async resolveOwnerId(
		user: AuthUser,
		purpose: StoragePurpose,
	): Promise<string> {
		if (!ORG_SCOPED.includes(purpose)) return user.id;

		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, user.id),
			columns: { id: true },
		});

		if (!organization) {
			throw new ForbiddenException(
				"Complete organization onboarding before uploading these files.",
			);
		}

		return organization.id;
	}
}
