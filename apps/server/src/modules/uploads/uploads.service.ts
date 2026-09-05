import type { db as dbType } from "@nabhya/db";
import { organizationDocuments, organizations } from "@nabhya/db/schema";
import type {
	CreateFeedMediaIntentsInput,
	UploadIntentInput,
} from "@nabhya/shared";
import { MAX_FEED_MEDIA_BYTES, MAX_UPLOAD_BYTES } from "@nabhya/shared";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import {
	type AllowedContentType,
	buildFeedMediaKey,
	buildOrgVerificationKey,
	buildStorageKey,
	createFeedMediaFolder,
	parseStorageKey,
	STORAGE_TOKEN,
	type StorageProvider,
	type StoragePurpose,
} from "../../common/storage";
import type { AuthUser } from "../../common/types";

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

	async createIntent(user: AuthUser, input: UploadIntentInput) {
		const purpose = input.purpose as Exclude<StoragePurpose, "FEED_MEDIA">;
		if (purpose === "ORG_DOCUMENT") {
			if (!input.organizationDocumentType) {
				throw new BadRequestException(
					"Choose the verification document type before uploading.",
				);
			}
			const organization = await this.requireOwnedOrganization(user.id);
			return this.storage.createUploadTicket({
				key: buildOrgVerificationKey({
					organizationName: organization.organizationName,
					documentType: input.organizationDocumentType,
					fileName: input.fileName,
				}),
				contentType: input.contentType as AllowedContentType,
			});
		}

		const ownerId = await this.resolveOwnerId(user, purpose);
		return this.storage.createUploadTicket({
			key: buildStorageKey({ purpose, ownerId, fileName: input.fileName }),
			contentType: input.contentType as AllowedContentType,
		});
	}

	/** Allocates one timestamp folder for all media attached to a single post. */
	createEmptyFeedMediaFolder() {
		return createFeedMediaFolder();
	}

	async createFeedMediaIntents(
		user: AuthUser,
		files: CreateFeedMediaIntentsInput["files"],
	) {
		const mediaFolder = createFeedMediaFolder();
		const tickets = await Promise.all(
			files.map((file, index) =>
				this.storage.createUploadTicket({
					key: buildFeedMediaKey({
						folder: mediaFolder,
						ownerId: user.id,
						index,
						fileName: file.fileName,
					}),
					contentType: file.contentType,
				}),
			),
		);
		return { mediaFolder, tickets };
	}

	async assertUploaded(key: string): Promise<void> {
		await this.assertObject(
			key,
			MAX_UPLOAD_BYTES,
			"Files must be under 10 MB.",
		);
	}

	async assertFeedMediaKeys(
		user: AuthUser,
		mediaFolder: string,
		keys: string[],
	): Promise<void> {
		if (new Set(keys).size !== keys.length)
			throw new BadRequestException("Each feed media item must be unique.");
		const expectedPrefix = `feed_media/${mediaFolder}/${user.id}-`;
		for (const key of keys) {
			if (!key.startsWith(expectedPrefix)) {
				throw new ForbiddenException(
					"Feed media must be uploaded using your post upload ticket.",
				);
			}
			const object = await this.assertObject(
				key,
				MAX_FEED_MEDIA_BYTES,
				"Feed media must be under 25 MB.",
			);
			if (
				!object.contentType ||
				![
					"image/jpeg",
					"image/png",
					"image/webp",
					"video/mp4",
					"video/quicktime",
				].includes(object.contentType)
			) {
				await this.storage.delete(key);
				throw new BadRequestException(
					"Feed posts accept JPEG, PNG, WebP, MP4, and MOV media only.",
				);
			}
		}
	}

	async createDownloadUrl(user: AuthUser, key: string) {
		const parsed = parseStorageKey(key);
		if (!parsed || parsed.purpose === "FEED_MEDIA")
			throw new BadRequestException("Malformed file reference");
		if (!user.roles.includes("superadmin")) {
			if (parsed.purpose === "ORG_DOCUMENT") {
				const organization = await this.db.query.organizations.findFirst({
					where: eq(organizations.ownerUserId, user.id),
					columns: { id: true },
				});
				if (
					!organization ||
					!(await this.db.query.organizationDocuments.findFirst({
						where: and(
							eq(organizationDocuments.organizationId, organization.id),
							eq(organizationDocuments.documentKey, key),
						),
						columns: { id: true },
					}))
				)
					throw new ForbiddenException("You cannot access this file.");
			} else if (
				parsed.ownerId !== (await this.resolveOwnerId(user, parsed.purpose))
			) {
				throw new ForbiddenException("You cannot access this file.");
			}
		}
		const object = await this.storage.head(key);
		if (!object) throw new NotFoundException("File not found");
		const expiresInSeconds = 10 * 60;
		return {
			url: await this.storage.createDownloadUrl(key, expiresInSeconds),
			expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
		};
	}

	private async assertObject(
		key: string,
		maxSize: number,
		tooLargeMessage: string,
	) {
		const object = await this.storage.head(key);
		if (!object)
			throw new BadRequestException(
				"That file was not uploaded. Please try again.",
			);
		if (object.size > maxSize) {
			await this.storage.delete(key);
			throw new BadRequestException(tooLargeMessage);
		}
		return object;
	}

	private async resolveOwnerId(
		user: AuthUser,
		purpose: Exclude<StoragePurpose, "FEED_MEDIA">,
	): Promise<string> {
		if (!ORG_SCOPED.includes(purpose)) return user.id;
		return (await this.requireOwnedOrganization(user.id)).id;
	}

	private async requireOwnedOrganization(userId: string) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, userId),
			columns: { id: true, organizationName: true },
		});
		if (!organization)
			throw new ForbiddenException(
				"Complete organization onboarding before uploading these files.",
			);
		return organization;
	}
}
