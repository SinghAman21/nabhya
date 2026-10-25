import type { db as dbType } from "@nabhya/db";
import { organizations, posts, postsMedia, users } from "@nabhya/db/schema";
import {
	type AdminOrgPostsQuery,
	type CreateFeedMediaIntentsInput,
	type CreateFeedPostInput,
	canTeamRole,
	type FeedQuery,
} from "@nabhya/shared";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	Optional,
} from "@nestjs/common";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { STORAGE_TOKEN, type StorageProvider } from "../../common/storage";
import type { AuthUser } from "../../common/types";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { OrganizationsService } from "../organizations/organizations.service";
import { UploadsService } from "../uploads/uploads.service";
import { FeedRankingService } from "./feed-ranking.service";

@Injectable()
export class FeedService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
		@Inject(UploadsService) private readonly uploads: UploadsService,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		// Optional so specs that build this service by hand need not supply it;
		// a new or deleted post must not wait out the ranked pool's cache.
		@Optional()
		@Inject(FeedRankingService)
		private readonly ranking?: FeedRankingService,
	) {}

	async createMediaIntents(user: AuthUser, input: CreateFeedMediaIntentsInput) {
		await this.organizationsService.requireOrgPermission(
			user.id,
			"content.publish",
		);
		await this.organizationsService.requireVerifiedOrganization(user.id);
		return this.uploads.createFeedMediaIntents(user, input.files);
	}

	async create(user: AuthUser, input: CreateFeedPostInput) {
		const mediaFolder =
			input.mediaFolder ?? this.uploads.createEmptyFeedMediaFolder();
		await this.uploads.assertFeedMediaKeys(user, mediaFolder, input.mediaKeys);
		// Needs, events and announcements all check `content.publish`; a post
		// only checked verification, so a viewer could publish as the NGO.
		await this.organizationsService.requireOrgPermission(
			user.id,
			"content.publish",
		);
		const organization =
			await this.organizationsService.requireVerifiedOrganization(user.id);
		const post = await this.db.transaction(async (tx) => {
			const created = takeFirstOrThrow(
				await tx
					.insert(posts)
					.values({
						authorUserId: user.id,
						organizationId: organization?.id,
						type: input.type,
						isUrgent: input.isUrgent,
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
		this.ranking?.invalidatePool();
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
					type: posts.type,
					isUrgent: posts.isUrgent,
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

	async listOrganizationPosts(
		organizationId: string,
		query: AdminOrgPostsQuery,
	) {
		const { limit, offset } = toOffset(query);
		const conditions: SQL[] = [eq(posts.organizationId, organizationId)];
		if (query.tag) conditions.push(eq(posts.type, query.tag));
		const where = and(...conditions);

		const [postRows, [totals]] = await Promise.all([
			this.db
				.select({
					id: posts.id,
					tag: posts.type,
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
				.where(where)
				.orderBy(desc(posts.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(posts).where(where),
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
		});
		if (!post) throw new NotFoundException("Post not found");
		if (
			!user.roles.includes("superadmin") &&
			post.authorUserId !== user.id &&
			!(await this.canModerateFor(user.id, post.organizationId))
		) {
			throw new ForbiddenException(
				"Only the author, or a teammate who can delete content, can remove this post.",
			);
		}
		const media = await this.db
			.select({ objectKey: postsMedia.objectKey })
			.from(postsMedia)
			.where(eq(postsMedia.postId, postId));
		await this.db.delete(posts).where(eq(posts.id, postId));
		this.ranking?.invalidatePool();
		await Promise.all(media.map((item) => this.storage.delete(item.objectKey)));
		void this.audit.record({
			performedBy: user.id,
			action: "DELETE_POST",
			entityName: "POST",
			entityId: postId,
		});
		return { deleted: true };
	}

	/**
	 * Whether this account may take down its organization's posts - the same
	 * `content.delete` that lets it delete the org's needs and events. A post
	 * outlives its author's place on the team, so author-only deletion left a
	 * departed member's posts undeletable by anyone but a superadmin.
	 */
	private async canModerateFor(
		userId: string,
		organizationId: string | null,
	): Promise<boolean> {
		if (!organizationId) return false;
		const membership =
			await this.organizationsService.getActiveMembership(userId);
		if (membership) {
			return (
				membership.organizationId === organizationId &&
				canTeamRole(membership.role, "content.delete")
			);
		}
		// Legacy owner with no membership row, as `requireOrgPermission` allows.
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: { ownerUserId: true },
		});
		return organization?.ownerUserId === userId;
	}

	private async getPost(postId: string) {
		const post = await this.db
			.select({
				id: posts.id,
				type: posts.type,
				isUrgent: posts.isUrgent,
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
