import type { db as dbType } from "@nabhya/db";
import { posts, postsMedia, users } from "@nabhya/db/schema";
import type {
	CreateFeedMediaIntentsInput,
	CreateFeedPostInput,
	FeedQuery,
} from "@nabhya/shared";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { count, desc, eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { STORAGE_TOKEN, type StorageProvider } from "../../common/storage";
import type { AuthUser } from "../../common/types";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { OrganizationsService } from "../organizations/organizations.service";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class FeedService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
		@Inject(UploadsService) private readonly uploads: UploadsService,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
	) {}

	async createMediaIntents(user: AuthUser, input: CreateFeedMediaIntentsInput) {
		await this.organizationsService.requireVerifiedOrganization(user.id);
		return this.uploads.createFeedMediaIntents(user, input.files);
	}

	async create(user: AuthUser, input: CreateFeedPostInput) {
		const mediaFolder =
			input.mediaFolder ?? this.uploads.createEmptyFeedMediaFolder();
		await this.uploads.assertFeedMediaKeys(user, mediaFolder, input.mediaKeys);
		const organization =
			await this.organizationsService.requireVerifiedOrganization(user.id);
		const post = await this.db.transaction(async (tx) => {
			const created = takeFirstOrThrow(
				await tx
					.insert(posts)
					.values({
						authorUserId: user.id,
						organizationId: organization?.id,
						tag: input.tag,
						city: organization?.city,
						state: organization?.state,
						latitude: organization?.latitude,
						longitude: organization?.longitude,
						mediaFolder,
						text: input.text,
					})
					.returning(),
				"create feed post",
			);
			if (input.mediaKeys.length > 0) {
				await tx.insert(postsMedia).values(
					input.mediaKeys.map((objectKey, sortOrder) => ({
						postId: created.id,
						objectKey,
						mediaType: (objectKey.endsWith(".mp4") || objectKey.endsWith(".mov")
							? "VIDEO"
							: "IMAGE") as "VIDEO" | "IMAGE",
						mimeType: objectKey.endsWith(".mp4")
							? "video/mp4"
							: objectKey.endsWith(".mov")
								? "video/quicktime"
								: "image/*",
						sortOrder,
					})),
				);
			}
			return created;
		});
		void this.audit.record({
			performedBy: user.id,
			action: "CREATE_POST",
			entityName: "POST",
			entityId: post.id,
		});
		return this.getPost(post.id);
	}

	async list(query: FeedQuery) {
		const { limit, offset } = toOffset(query);
		const [postRows, [totals]] = await Promise.all([
			this.db
				.select({
					id: posts.id,
					tag: posts.tag,
					text: posts.text,
					createdAt: posts.createdAt,
					author: {
						id: users.id,
						fullName: users.fullName,
						profileImage: users.profileImage,
					},
				})
				.from(posts)
				.innerJoin(users, eq(posts.authorUserId, users.id))
				.orderBy(desc(posts.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(posts),
		]);
		return paginate(
			await Promise.all(postRows.map((post) => this.withMedia(post))),
			totals?.value ?? 0,
			query,
		);
	}

	async remove(user: AuthUser, postId: string) {
		const post = await this.db.query.posts.findFirst({
			where: eq(posts.id, postId),
			with: { media: true },
		});
		if (!post) throw new NotFoundException("Post not found");
		if (!user.roles.includes("superadmin") && post.authorUserId !== user.id) {
			throw new ForbiddenException("You can only delete your own posts.");
		}
		await this.db.delete(posts).where(eq(posts.id, postId));
		await Promise.all(
			post.media.map((media) => this.storage.delete(media.objectKey)),
		);
		void this.audit.record({
			performedBy: user.id,
			action: "DELETE_POST",
			entityName: "POST",
			entityId: postId,
		});
		return { deleted: true };
	}

	private async getPost(postId: string) {
		const post = await this.db
			.select({
				id: posts.id,
				tag: posts.tag,
				text: posts.text,
				createdAt: posts.createdAt,
				author: {
					id: users.id,
					fullName: users.fullName,
					profileImage: users.profileImage,
				},
			})
			.from(posts)
			.innerJoin(users, eq(posts.authorUserId, users.id))
			.where(eq(posts.id, postId))
			.then((rows) => rows[0]);
		if (!post) throw new NotFoundException("Post not found");
		return this.withMedia(post);
	}

	private async withMedia<T extends { id: string }>(post: T) {
		const media = await this.db
			.select()
			.from(postsMedia)
			.where(eq(postsMedia.postId, post.id))
			.orderBy(postsMedia.sortOrder);
		return {
			...post,
			media: await Promise.all(
				media.map(async (item) => ({
					id: item.id,
					type: item.mediaType,
					url: await this.storage.createDownloadUrl(item.objectKey),
					sortOrder: item.sortOrder,
				})),
			),
		};
	}
}
