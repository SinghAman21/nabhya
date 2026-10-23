import { randomUUID } from "node:crypto";
import type { db as dbType } from "@nabhya/db";
import {
	financialReports,
	organizationAdmins,
	organizations,
} from "@nabhya/db/schema";
import type {
	CreateFeedMediaIntentsInput,
	UploadIntentInput,
} from "@nabhya/shared";
import { canTeamRole, type OrgPermissionAction } from "@nabhya/shared";
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
	"NEED_COVER",
	"ANNOUNCEMENT_COVER",
	"FINANCIAL_REPORT",
];

/** A public file still has to be attached to a currently public NGO record. */
const PUBLIC_ORG_FILE_PURPOSES: StoragePurpose[] = [
	"ORG_LOGO",
	"ORG_COVER",
	"FINANCIAL_REPORT",
];

const ORG_UPLOAD_PERMISSION: Partial<
	Record<StoragePurpose, OrgPermissionAction>
> = {
	ORG_DOCUMENT: "org.edit",
	ORG_LOGO: "org.edit",
	ORG_COVER: "org.edit",
	NEED_COVER: "content.publish",
	ANNOUNCEMENT_COVER: "content.publish",
	FINANCIAL_REPORT: "reports.manage",
};

@Injectable()
export class UploadsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	/**
	 * Issues a pre-signed upload URL.
	 *
	 * The key is derived server-side from the caller's identity - the client
	 * never proposes one - so a volunteer cannot obtain a ticket that writes
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
	async assertUploaded(
		key: string,
		expected: { purpose: StoragePurpose; ownerId: string },
	): Promise<void> {
		const parsed = parseStorageKey(key);
		if (
			!parsed ||
			parsed.purpose !== expected.purpose ||
			parsed.ownerId !== expected.ownerId
		) {
			throw new ForbiddenException("You cannot attach this file.");
		}

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
	async createDownloadUrl(user: AuthUser | undefined, key: string) {
		const parsed = parseStorageKey(key);
		if (!parsed) {
			throw new BadRequestException("Malformed file reference");
		}
		if (user?.roles.includes("superadmin")) {
			return this.signDownloadUrl(key);
		}

		if (PUBLIC_ORG_FILE_PURPOSES.includes(parsed.purpose)) {
			if (
				user &&
				(await this.canReadPrivateOrganizationFile(user, key, parsed))
			) {
				return this.signDownloadUrl(key);
			}
			await this.assertPublicOrganizationFile(key, parsed);
		} else {
			if (!user) {
				throw new ForbiddenException("Sign in to access this file.");
			}

			const ownerId = await this.resolveOwnerId(user, parsed.purpose);
			if (ownerId !== parsed.ownerId) {
				throw new ForbiddenException("You cannot access this file.");
			}
		}

		return this.signDownloadUrl(key);
	}

	/**
	 * Lets an authorized org member preview an attached file before publication
	 * or after the NGO leaves the public directory. Public callers still go
	 * through the verified + active check below.
	 */
	private async canReadPrivateOrganizationFile(
		user: AuthUser,
		key: string,
		parsed: { purpose: StoragePurpose; ownerId: string },
	): Promise<boolean> {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, parsed.ownerId),
			columns: {
				id: true,
				ownerUserId: true,
				logo: true,
				coverImage: true,
			},
		});
		if (!organization) return false;

		let attached = false;
		if (parsed.purpose === "ORG_LOGO") attached = organization.logo === key;
		if (parsed.purpose === "ORG_COVER")
			attached = organization.coverImage === key;
		if (parsed.purpose === "FINANCIAL_REPORT") {
			const report = await this.db.query.financialReports.findFirst({
				where: and(
					eq(financialReports.organizationId, organization.id),
					eq(financialReports.documentKey, key),
				),
				columns: { id: true },
			});
			attached = !!report;
		}
		if (!attached) return false;
		if (organization.ownerUserId === user.id) return true;

		const membership = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.organizationId, organization.id),
				eq(organizationAdmins.userId, user.id),
				eq(organizationAdmins.status, "ACTIVE"),
			),
			columns: { role: true, isOwner: true },
		});
		const requiredPermission = ORG_UPLOAD_PERMISSION[parsed.purpose];
		return !!(
			membership &&
			requiredPermission &&
			canTeamRole(
				membership.isOwner ? "OWNER" : membership.role,
				requiredPermission,
			)
		);
	}

	private async signDownloadUrl(key: string) {
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

	private async assertPublicOrganizationFile(
		key: string,
		parsed: { purpose: StoragePurpose; ownerId: string },
	) {
		const organization = await this.db.query.organizations.findFirst({
			where: and(
				eq(organizations.id, parsed.ownerId),
				eq(organizations.status, "ACTIVE"),
				eq(organizations.verificationStatus, "VERIFIED"),
			),
			columns: { id: true, logo: true, coverImage: true },
		});
		if (!organization) throw new NotFoundException("File not found");

		if (parsed.purpose === "ORG_LOGO" && organization.logo === key) return;
		if (parsed.purpose === "ORG_COVER" && organization.coverImage === key)
			return;
		if (parsed.purpose === "FINANCIAL_REPORT") {
			const report = await this.db.query.financialReports.findFirst({
				where: and(
					eq(financialReports.organizationId, organization.id),
					eq(financialReports.documentKey, key),
				),
				columns: { id: true },
			});
			if (report) return;
		}

		throw new NotFoundException("File not found");
	}

	/** Org-scoped objects belong to the caller's organization, others to them. */
	private async resolveOwnerId(
		user: AuthUser,
		purpose: StoragePurpose,
	): Promise<string> {
		if (!ORG_SCOPED.includes(purpose)) return user.id;

		const membership = await this.db.query.organizationAdmins.findFirst({
			where: and(
				eq(organizationAdmins.userId, user.id),
				eq(organizationAdmins.status, "ACTIVE"),
			),
			with: { organization: true },
		});

		const organization =
			membership?.organization ??
			(await this.db.query.organizations.findFirst({
				where: eq(organizations.ownerUserId, user.id),
			}));

		if (organization?.status !== "ACTIVE") {
			throw new ForbiddenException(
				"Complete organization onboarding before uploading these files.",
			);
		}

		const requiredPermission = ORG_UPLOAD_PERMISSION[purpose];
		const role = membership?.isOwner ? "OWNER" : (membership?.role ?? "OWNER");
		if (
			role === "VIEWER" &&
			(purpose === "EVENT_COVER" || purpose === "ANNOUNCEMENT_COVER")
		) {
			throw new ForbiddenException(
				"Viewers cannot upload organization content.",
			);
		}
		if (requiredPermission) {
			if (!canTeamRole(role, requiredPermission)) {
				throw new ForbiddenException(
					"You do not have permission to upload this organization file.",
				);
			}
		}

		return organization.id;
	}
}
