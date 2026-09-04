import type {
	CreateFeedMediaIntentsInput,
	CreateFeedPostInput,
	FeedQuery,
} from "@nabhya/shared";
import {
	createFeedMediaIntentsSchema,
	createFeedPostSchema,
	feedQuerySchema,
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
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { FeedService } from "./feed.service";

@ApiTags("Feed")
@Controller("feed")
export class FeedController {
	constructor(@Inject(FeedService) private readonly feed: FeedService) {}

	@Get()
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Shared volunteer and NGO feed" })
	list(@Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery) {
		return this.feed.list(query);
	}

	@Post("upload-intents")
	@Roles("volunteer", "organisation")
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
	@Roles("volunteer", "organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Publish a feed post" })
	create(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createFeedPostSchema))
		body: CreateFeedPostInput,
	) {
		return this.feed.create(user, body);
	}

	@Delete(":id")
	@Roles("volunteer", "organisation", "superadmin")
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
}
