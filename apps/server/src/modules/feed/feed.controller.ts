import type {
	CreateFeedCommentInput,
	CreateFeedMediaIntentsInput,
	CreateFeedPostInput,
	FeedCommentsQuery,
	FeedQuery,
	FollowingFeedQuery,
	ForYouFeedQuery,
	SavedFeedQuery,
	TrendingFeedQuery,
} from "@nabhya/shared";
import {
	createFeedCommentSchema,
	createFeedMediaIntentsSchema,
	createFeedPostSchema,
	feedCommentsQuerySchema,
	feedQuerySchema,
	followingFeedQuerySchema,
	forYouFeedQuerySchema,
	postTargetSchema,
	savedFeedQuerySchema,
	trendingFeedQuerySchema,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, OptionalAuth, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { FeedService } from "./feed.service";
import { FeedEngagementService } from "./feed-engagement.service";
import { FeedRankingService } from "./feed-ranking.service";

@ApiTags("Feed")
@Controller("feed")
export class FeedController {
	constructor(
		@Inject(FeedService) private readonly feed: FeedService,
		@Inject(FeedRankingService) private readonly ranking: FeedRankingService,
		@Inject(FeedEngagementService)
		private readonly engagement: FeedEngagementService,
	) {}

	@Get()
	@Roles("organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Organization post feed" })
	list(@Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery) {
		return this.feed.list(query);
	}

	@OptionalAuth()
	@Get("for-you")
	@ApiOperation({
		summary: "Personalized NGO, event, need and announcement feed",
	})
	forYou(
		@CurrentUser() user: AuthUser | undefined,
		@Query(new ZodValidationPipe(forYouFeedQuerySchema)) query: ForYouFeedQuery,
	) {
		return this.ranking.forYou(user, query);
	}

	@OptionalAuth()
	@Get("trending")
	@ApiOperation({ summary: "Public feed ranked by recent meaningful activity" })
	trending(
		@CurrentUser() user: AuthUser | undefined,
		@Query(new ZodValidationPipe(trendingFeedQuerySchema))
		query: TrendingFeedQuery,
	) {
		return this.ranking.trending(user, query);
	}

	@Get("following")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Recent content from organizations the caller follows",
	})
	following(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(followingFeedQuerySchema))
		query: FollowingFeedQuery,
	) {
		return this.ranking.following(user, query);
	}

	@Get("saved")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Feed items the caller has saved" })
	saved(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(savedFeedQuerySchema)) query: SavedFeedQuery,
	) {
		return this.ranking.saved(user, query);
	}

	@Post("upload-intents")
	@Roles("organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Create up to four signed upload URLs for a new feed post",
	})
	createMediaIntents(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createFeedMediaIntentsSchema))
		body: CreateFeedMediaIntentsInput,
	) {
		return this.feed.createMediaIntents(user, body);
	}

	@Post()
	@Roles("organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Publish a feed post" })
	create(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createFeedPostSchema))
		body: CreateFeedPostInput,
	) {
		return this.feed.create(user, body);
	}

	@Post(":type/:id/like")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Like a feed item" })
	like(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.addInteraction(
			user.id,
			this.target(type, id),
			"LIKE",
		);
	}

	@Delete(":type/:id/like")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Remove a feed item like" })
	unlike(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.removeInteraction(
			user.id,
			this.target(type, id),
			"LIKE",
		);
	}

	@Post(":type/:id/save")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Save a feed item" })
	save(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.addInteraction(
			user.id,
			this.target(type, id),
			"SAVE",
		);
	}

	@Delete(":type/:id/save")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Remove a saved feed item" })
	unsave(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.removeInteraction(
			user.id,
			this.target(type, id),
			"SAVE",
		);
	}

	@Post(":type/:id/share")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Record a feed item share" })
	share(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.addInteraction(
			user.id,
			this.target(type, id),
			"SHARE",
		);
	}

	@Post(":type/:id/impression")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Record that a feed item was shown" })
	impression(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.engagement.addInteraction(
			user.id,
			this.target(type, id),
			"IMPRESSION",
		);
	}

	@OptionalAuth()
	@Get(":type/:id/comments")
	@ApiOperation({ summary: "List feed item comments" })
	comments(
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(feedCommentsQuerySchema))
		query: FeedCommentsQuery,
	) {
		return this.engagement.listComments(this.target(type, id), query);
	}

	@Post(":type/:id/comments")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Comment on a feed item" })
	comment(
		@CurrentUser() user: AuthUser,
		@Param("type") type: string,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(
			new ZodValidationPipe(
				createFeedCommentSchema.omit({ targetType: true, postId: true }),
			),
		)
		body: Omit<CreateFeedCommentInput, "targetType" | "postId">,
	) {
		return this.engagement.createComment(
			user.id,
			createFeedCommentSchema.parse({ ...body, ...this.target(type, id) }),
		);
	}

	@Delete("comments/:commentId")
	@Roles("volunteer", "organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Delete your comment, or moderate it as superadmin",
	})
	deleteComment(
		@CurrentUser() user: AuthUser,
		@Param("commentId", ParseUUIDPipe) commentId: string,
	) {
		return this.engagement.deleteComment(user, commentId);
	}

	@Delete(":id")
	@Roles("organisation", "superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Delete your own post, or moderate it as a superadmin",
	})
	remove(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.feed.remove(user, id);
	}

	private target(type: string, id: string) {
		return postTargetSchema.parse({
			targetType: type.toUpperCase(),
			postId: id,
		});
	}
}
