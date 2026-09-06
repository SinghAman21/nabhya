import type {
	PaginationQuery,
	ReplyToReviewInput,
	ReviewQuery,
	UpsertReviewInput,
} from "@nabhya/shared";
import {
	paginationQuerySchema,
	replyToReviewSchema,
	reviewQuerySchema,
	upsertReviewSchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { EngagementService } from "./engagement.service";

@ApiTags("Engagement")
@Controller()
export class EngagementController {
	constructor(
		@Inject(EngagementService)
		private readonly engagementService: EngagementService,
	) {}

	// ─── Bookmarks ───────────────────────────────────────────────────────────

	@Post("organizations/:id/bookmark")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Bookmark or un-bookmark an NGO (idempotent)" })
	toggleBookmark(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagementService.toggleBookmark(user.id, id);
	}

	@Post("organizations/:id/follow")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Follow an NGO (idempotent)" })
	follow(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagementService.follow(user.id, id);
	}

	@Delete("organizations/:id/follow")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Unfollow an NGO (idempotent)" })
	unfollow(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagementService.unfollow(user.id, id);
	}

	@Get("me/bookmarks")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The caller's bookmarked NGOs" })
	listBookmarks(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	) {
		return this.engagementService.listBookmarks(user.id, query);
	}

	// ─── Reviews ─────────────────────────────────────────────────────────────

	@Public()
	@Get("organizations/:id/reviews")
	@ApiOperation({ summary: "Reviews and rating summary for an NGO (public)" })
	listReviews(
		@Param("id", ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(reviewQuerySchema)) query: ReviewQuery,
	) {
		return this.engagementService.listReviews(id, query);
	}

	@Throttle({ strict: { limit: 10, ttl: 60_000 } })
	@Post("organizations/:id/reviews")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Leave or edit your review of an NGO" })
	upsertReview(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(upsertReviewSchema)) body: UpsertReviewInput,
	) {
		return this.engagementService.upsertReview(user.id, id, body);
	}

	@Delete("organizations/:id/reviews/me")
	@Roles("volunteer")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Delete your own review" })
	deleteMyReview(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagementService.deleteMyReview(user.id, id);
	}

	@Get("org/reviews")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Reviews left for the caller's organization" })
	listMyReviews(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(reviewQuerySchema)) query: ReviewQuery,
	) {
		return this.engagementService.listMyOrganizationReviews(user.id, query);
	}

	@Patch("org/reviews/:reviewId/reply")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Publicly reply to a review" })
	replyToReview(
		@CurrentUser() user: AuthUser,
		@Param("reviewId", ParseUUIDPipe) reviewId: string,
		@Body(new ZodValidationPipe(replyToReviewSchema)) body: ReplyToReviewInput,
	) {
		return this.engagementService.replyToReview(user.id, reviewId, body);
	}
}
