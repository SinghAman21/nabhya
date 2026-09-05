import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	events,
	feedComments,
	feedInteractions,
	feedPosts,
	organizationNeeds,
	organizations,
} from "@nabhya/db/schema";
import type {
	CreateFeedCommentInput,
	FeedCommentsQuery,
	FeedItemTarget,
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
		target: FeedItemTarget,
		interactionType: "LIKE" | "SAVE" | "SHARE" | "IMPRESSION",
	) {
		await this.assertVisible(target);
		if (interactionType === "LIKE" || interactionType === "SAVE") {
			await this.db
				.insert(feedInteractions)
				.values({
					userId,
					targetType: target.targetType,
					targetId: target.targetId,
					interactionType,
				})
				.onConflictDoNothing();
		} else {
			await this.db.insert(feedInteractions).values({
				userId,
				targetType: target.targetType,
				targetId: target.targetId,
				interactionType,
			});
		}
		return { recorded: true };
	}

	async removeInteraction(
		userId: string,
		target: FeedItemTarget,
		interactionType: "LIKE" | "SAVE",
	) {
		await this.db
			.delete(feedInteractions)
			.where(
				and(
					eq(feedInteractions.userId, userId),
					eq(feedInteractions.targetType, target.targetType),
					eq(feedInteractions.targetId, target.targetId),
					eq(feedInteractions.interactionType, interactionType),
				),
			);
		return { deleted: true };
	}

	async createComment(userId: string, input: CreateFeedCommentInput) {
		await this.assertVisible(input);
		return takeFirstOrThrow(
			await this.db
				.insert(feedComments)
				.values({
					userId,
					targetType: input.targetType,
					targetId: input.targetId,
					body: input.body,
				})
				.returning(),
			"create feed comment",
		);
	}

	async listComments(target: FeedItemTarget, query: FeedCommentsQuery) {
		await this.assertVisible(target);
		const where = and(
			eq(feedComments.targetType, target.targetType),
			eq(feedComments.targetId, target.targetId),
		);
		const { limit, offset } = toOffset(query);
		const [items, [total]] = await Promise.all([
			this.db.query.feedComments.findMany({
				where,
				with: {
					user: { columns: { id: true, fullName: true, profileImage: true } },
				},
				orderBy: desc(feedComments.createdAt),
				limit,
				offset,
			}),
			this.db.select({ value: count() }).from(feedComments).where(where),
		]);
		return paginate(items, total?.value ?? 0, query);
	}

	async deleteComment(user: AuthUser, commentId: string) {
		const comment = await this.db.query.feedComments.findFirst({
			where: eq(feedComments.id, commentId),
		});
		if (!comment) throw new NotFoundException("Comment not found");
		if (comment.userId !== user.id && !user.roles.includes("superadmin"))
			throw new ForbiddenException("You can only delete your own comments.");
		await this.db.delete(feedComments).where(eq(feedComments.id, commentId));
		return { deleted: true };
	}

	async assertVisible(target: FeedItemTarget) {
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
		if (target.targetType === "POST") {
			const post = await this.db.query.feedPosts.findFirst({
				where: eq(feedPosts.id, target.targetId),
			});
			if (!post) throw new NotFoundException("Feed item not found");
			return visibleOrganization(post.organizationId);
		}
		if (target.targetType === "EVENT") {
			const item = await this.db.query.events.findFirst({
				where: and(
					eq(events.id, target.targetId),
					eq(events.status, "PUBLISHED"),
				),
			});
			if (!item) throw new NotFoundException("Feed item not found");
			return visibleOrganization(item.organizationId);
		}
		if (target.targetType === "NEED") {
			const item = await this.db.query.organizationNeeds.findFirst({
				where: and(
					eq(organizationNeeds.id, target.targetId),
					eq(organizationNeeds.status, "OPEN"),
				),
			});
			if (!item) throw new NotFoundException("Feed item not found");
			return visibleOrganization(item.organizationId);
		}
		const item = await this.db.query.announcements.findFirst({
			where: and(
				eq(announcements.id, target.targetId),
				eq(announcements.status, "PUBLISHED"),
			),
		});
		if (!item) throw new NotFoundException("Feed item not found");
		return visibleOrganization(item.organizationId);
	}
}
