import type { db as dbType } from "@nabhya/db";
import {
	bookmarks,
	follows,
	organizations,
	reviews,
	users,
} from "@nabhya/db/schema";
import type {
	OrgReviewQuery,
	PaginationQuery,
	ReplyToReviewInput,
	ReviewQuery,
	ReviewSummary,
	UpsertReviewInput,
} from "@nabhya/shared";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, avg, count, desc, eq, isNull, type SQL, sql } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";

@Injectable()
export class EngagementService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
	) {}

	// ─── Bookmarks ───────────────────────────────────────────────────────────

	/** Idempotent toggle; the unique index makes double taps harmless. */
	async toggleBookmark(userId: string, organizationId: string) {
		const existing = await this.db.query.bookmarks.findFirst({
			where: and(
				eq(bookmarks.userId, userId),
				eq(bookmarks.organizationId, organizationId),
			),
		});

		if (existing) {
			await this.db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
			return { bookmarked: false };
		}

		// Confirms the organization is publicly visible before bookmarking it.
		await this.organizationsService.getPublicById(organizationId);

		await this.db
			.insert(bookmarks)
			.values({ userId, organizationId })
			.onConflictDoNothing();

		return { bookmarked: true };
	}

	/** The NGOs the caller follows, newest first - the Following page (#7). */
	async listFollowing(userId: string, query: PaginationQuery) {
		const where = eq(follows.userId, userId);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: follows.id,
					createdAt: follows.createdAt,
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
						city: organizations.city,
						state: organizations.state,
						description: organizations.description,
					},
				})
				.from(follows)
				.innerJoin(organizations, eq(follows.organizationId, organizations.id))
				.where(where)
				.orderBy(desc(follows.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(follows).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async listBookmarks(userId: string, query: PaginationQuery) {
		const where = eq(bookmarks.userId, userId);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: bookmarks.id,
					createdAt: bookmarks.createdAt,
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
						city: organizations.city,
						state: organizations.state,
						description: organizations.description,
					},
				})
				.from(bookmarks)
				.innerJoin(
					organizations,
					eq(bookmarks.organizationId, organizations.id),
				)
				.where(where)
				.orderBy(desc(bookmarks.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(bookmarks).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/** Idempotent follow mutation used by the feed's Following lens. */
	async follow(userId: string, organizationId: string) {
		await this.organizationsService.getPublicById(organizationId);
		await this.db
			.insert(follows)
			.values({ userId, organizationId })
			.onConflictDoNothing();

		return { following: true };
	}

	/** Idempotent unfollow mutation used by the feed's Following lens. */
	async unfollow(userId: string, organizationId: string) {
		await this.db
			.delete(follows)
			.where(
				and(
					eq(follows.userId, userId),
					eq(follows.organizationId, organizationId),
				),
			);

		return { following: false };
	}

	// ─── Reviews ─────────────────────────────────────────────────────────────

	/**
	 * Create or edit the caller's review. One per person per organization, so a
	 * second submission updates the first rather than stacking.
	 */
	async upsertReview(
		userId: string,
		organizationId: string,
		input: UpsertReviewInput,
	) {
		const organization =
			await this.organizationsService.getPublicById(organizationId);

		// Reviewing your own NGO would let an owner inflate their own rating.
		if (organization.ownerUserId === userId) {
			throw new ForbiddenException("You cannot review your own organization.");
		}

		const existing = await this.db.query.reviews.findFirst({
			where: and(
				eq(reviews.organizationId, organizationId),
				eq(reviews.userId, userId),
			),
		});

		if (existing) {
			const [updated] = await this.db
				.update(reviews)
				.set({
					rating: input.rating,
					body: input.body ?? null,
					updatedAt: new Date(),
				})
				.where(eq(reviews.id, existing.id))
				.returning();
			return updated;
		}

		const review = takeFirstOrThrow(
			await this.db
				.insert(reviews)
				.values({
					organizationId,
					userId,
					rating: input.rating,
					body: input.body ?? null,
				})
				.returning(),
			"create review",
		);

		void this.notifications.notify({
			userId: organization.ownerUserId,
			type: "NEW_REVIEW",
			title: `New ${input.rating}-star review`,
			body: input.body ?? undefined,
			entityName: "REVIEW",
			entityId: review.id,
		});

		void this.audit.record({
			performedBy: userId,
			action: "CREATE_REVIEW",
			entityName: "REVIEW",
			entityId: review.id,
			newValue: { organizationId, rating: input.rating },
		});

		return review;
	}

	async deleteMyReview(userId: string, organizationId: string) {
		const existing = await this.db.query.reviews.findFirst({
			where: and(
				eq(reviews.organizationId, organizationId),
				eq(reviews.userId, userId),
			),
		});

		if (!existing)
			throw new NotFoundException("You have not reviewed this NGO.");

		await this.db.delete(reviews).where(eq(reviews.id, existing.id));
		return { deleted: true };
	}

	/** The organization's public response to a review it received. */
	async replyToReview(
		userId: string,
		reviewId: string,
		input: ReplyToReviewInput,
	) {
		// A reply is published on the NGO's public page under its name, so it
		// takes the same permission as any other public content - without it a
		// viewer could answer a volunteer's review on the organisation's behalf.
		await this.organizationsService.requireOrgPermission(
			userId,
			"content.publish",
		);
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const review = await this.db.query.reviews.findFirst({
			where: eq(reviews.id, reviewId),
		});

		if (!review) throw new NotFoundException("Review not found");
		if (review.organizationId !== organization.id) {
			throw new ForbiddenException("That review is for another organization.");
		}

		const [updated] = await this.db
			.update(reviews)
			.set({ reply: input.reply, repliedAt: new Date(), updatedAt: new Date() })
			.where(eq(reviews.id, reviewId))
			.returning();

		void this.notifications.notify({
			userId: review.userId,
			type: "NEW_REVIEW",
			title: `${organization.organizationName} replied to your review`,
			body: input.reply,
			entityName: "REVIEW",
			entityId: reviewId,
		});

		return updated;
	}

	async listReviews(organizationId: string, query: ReviewQuery) {
		await this.organizationsService.assertPubliclyVisible(organizationId);
		return this.queryReviews(organizationId, query);
	}

	async getMyReview(userId: string, organizationId: string) {
		await this.organizationsService.assertPubliclyVisible(organizationId);
		const review = await this.db.query.reviews.findFirst({
			where: and(
				eq(reviews.organizationId, organizationId),
				eq(reviews.userId, userId),
			),
			columns: { id: true, rating: true, body: true },
		});
		return review ?? null;
	}

	private async queryReviews(
		organizationId: string,
		query: PaginationQuery,
		filter?: SQL,
	) {
		const where = and(eq(reviews.organizationId, organizationId), filter);
		const { limit, offset } = toOffset(query);

		const [items, [totals], summary] = await Promise.all([
			this.db
				.select({
					id: reviews.id,
					rating: reviews.rating,
					body: reviews.body,
					reply: reviews.reply,
					repliedAt: reviews.repliedAt,
					createdAt: reviews.createdAt,
					user: {
						id: users.id,
						fullName: users.fullName,
						profileImage: users.profileImage,
					},
				})
				.from(reviews)
				.innerJoin(users, eq(reviews.userId, users.id))
				.where(where)
				.orderBy(desc(reviews.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(reviews).where(where),
			this.getReviewSummary(organizationId),
		]);

		return { ...paginate(items, totals?.value ?? 0, query), summary };
	}

	/** Average plus the 1–5 distribution, in a single scan. */
	async getReviewSummary(organizationId: string): Promise<ReviewSummary> {
		const [row] = await this.db
			.select({
				average: avg(reviews.rating),
				total: count(),
				one: sql<number>`count(*) filter (where ${reviews.rating} = 1)::int`,
				two: sql<number>`count(*) filter (where ${reviews.rating} = 2)::int`,
				three: sql<number>`count(*) filter (where ${reviews.rating} = 3)::int`,
				four: sql<number>`count(*) filter (where ${reviews.rating} = 4)::int`,
				five: sql<number>`count(*) filter (where ${reviews.rating} = 5)::int`,
			})
			.from(reviews)
			.where(eq(reviews.organizationId, organizationId));

		return {
			average: row?.average ? Number(row.average) : 0,
			count: row?.total ?? 0,
			distribution: {
				"1": row?.one ?? 0,
				"2": row?.two ?? 0,
				"3": row?.three ?? 0,
				"4": row?.four ?? 0,
				"5": row?.five ?? 0,
			},
		};
	}

	/**
	 * Reviews left for the caller's own organization, for the NGO screen.
	 *
	 * Not `listReviews`: that one asserts the org is publicly visible, which is
	 * right for a stranger and wrong here - an NGO under review or suspended
	 * got a 404 on its own Reviews tab. `awaitingReplyCount` is the whole
	 * org's, so the header can say "3 awaiting" without paging to the end.
	 */
	async listMyOrganizationReviews(userId: string, query: OrgReviewQuery) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);
		const [page, [awaiting]] = await Promise.all([
			this.queryReviews(
				organization.id,
				query,
				query.awaitingReply ? isNull(reviews.reply) : undefined,
			),
			this.db
				.select({ value: count() })
				.from(reviews)
				.where(
					and(
						eq(reviews.organizationId, organization.id),
						isNull(reviews.reply),
					),
				),
		]);
		return { ...page, awaitingReplyCount: awaiting?.value ?? 0 };
	}
}
