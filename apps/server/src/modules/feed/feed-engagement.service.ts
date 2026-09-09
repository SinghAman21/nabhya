import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	events,
	needs,
	organizations,
	postComments,
	postInteractions,
	posts,
} from "@nabhya/db/schema";
import type {
	CreateFeedCommentInput,
	FeedCommentsQuery,
	PostTarget,
} from "@nabhya/shared";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import type { AuthUser } from "../../common/types";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";

@Injectable()
export class FeedEngagementService {
	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

	async addInteraction(
		userId: string,
		target: PostTarget,
		interactionType: "LIKE" | "SAVE" | "SHARE" | "IMPRESSION",
	) {
		await this.assertVisible(target);
		if (interactionType === "LIKE" || interactionType === "SAVE") {
			await this.db
				.insert(postInteractions)
				.values({
					userId,
					targetType: target.targetType,
					postId: target.postId,
					interactionType,
				})
				.onConflictDoNothing();
		} else {
			await this.db.insert(postInteractions).values({
				userId,
				targetType: target.targetType,
				postId: target.postId,
				interactionType,
			});
		}
		return { recorded: true };
	}

	async removeInteraction(
		userId: string,
		target: PostTarget,
		interactionType: "LIKE" | "SAVE",
	) {
		await this.db
			.delete(postInteractions)
			.where(
				and(
					eq(postInteractions.userId, userId),
					eq(postInteractions.targetType, target.targetType),
					eq(postInteractions.postId, target.postId),
					eq(postInteractions.interactionType, interactionType),
				),
			);
		return { deleted: true };
	}

	async createComment(userId: string, input: CreateFeedCommentInput) {
		await this.assertVisible(input);
		return takeFirstOrThrow(
			await this.db
				.insert(postComments)
				.values({
					userId,
					targetType: input.targetType,
					postId: input.postId,
					body: input.body,
				})
				.returning(),
			"create feed comment",
		);
	}

	async listComments(target: PostTarget, query: FeedCommentsQuery) {
		await this.assertVisible(target);
		const where = and(
			eq(postComments.targetType, target.targetType),
			eq(postComments.postId, target.postId),
		);
		const { limit, offset } = toOffset(query);
		const [items, [total]] = await Promise.all([
			this.db.query.postComments.findMany({
				where,
				with: {
					user: { columns: { id: true, fullName: true, profileImage: true } },
				},
				orderBy: desc(postComments.createdAt),
				limit,
				offset,
			}),
			this.db.select({ value: count() }).from(postComments).where(where),
		]);
		return paginate(items, total?.value ?? 0, query);
	}

	async deleteComment(user: AuthUser, commentId: string) {
		const comment = await this.db.query.postComments.findFirst({
			where: eq(postComments.id, commentId),
		});
		if (!comment) throw new NotFoundException("Comment not found");
		if (comment.userId !== user.id && !user.roles.includes("superadmin"))
			throw new ForbiddenException("You can only delete your own comments.");
		await this.db.delete(postComments).where(eq(postComments.id, commentId));
		return { deleted: true };
	}

	async assertVisible(target: PostTarget) {
		const visibleOrganization = async (
			organizationId: string | null | undefined,
		) => {
			if (!organizationId) return;
			const organization = await this.db.query.organizations.findFirst({
				where: and(
					eq(organizations.id, organizationId),
					eq(organizations.verificationStatus, "VERIFIED"),
					eq(organizations.status, "ACTIVE"),
				),
			});
			if (!organization) throw new NotFoundException("Feed item not found");
		};
		switch (target.targetType) {
			case "POST": {
				const post = await this.db.query.posts.findFirst({
					where: and(eq(posts.id, target.postId), eq(posts.type, "POST")),
				});
				if (!post) throw new NotFoundException("Feed item not found");
				return visibleOrganization(post.organizationId);
			}
			case "EVENT": {
				const event = await this.db.query.events.findFirst({
					where: and(
						eq(events.id, target.postId),
						eq(events.status, "PUBLISHED"),
					),
				});
				if (!event) throw new NotFoundException("Feed item not found");
				return visibleOrganization(event.organizationId);
			}
			case "NEED": {
				const need = await this.db.query.needs.findFirst({
					where: and(eq(needs.id, target.postId), eq(needs.status, "OPEN")),
				});
				if (!need) throw new NotFoundException("Feed item not found");
				return visibleOrganization(need.organizationId);
			}
			case "ANNOUNCEMENT": {
				const announcement = await this.db.query.announcements.findFirst({
					where: and(
						eq(announcements.id, target.postId),
						eq(announcements.status, "PUBLISHED"),
					),
				});
				if (!announcement) throw new NotFoundException("Feed item not found");
				return visibleOrganization(announcement.organizationId);
			}
		}
	}
}
