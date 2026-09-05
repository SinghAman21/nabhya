import type { FeedQuery } from "@nabhya/shared";
import { feedQuerySchema } from "@nabhya/shared";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentUser, OptionalAuth } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { FeedService } from "./feed.service";

/**
 * The volunteer home feed. Public so the same list can back SEO pages later;
 * a token personalises it ("For you", "Following", the follow state per card).
 */
@ApiTags("Feed")
@Controller("feed")
export class FeedController {
	constructor(@Inject(FeedService) private readonly feedService: FeedService) {}

	@OptionalAuth()
	@Get()
	@ApiOperation({
		summary: "Unified feed of needs, offers, events and NGO updates",
	})
	@ApiQuery({
		name: "tab",
		required: false,
		enum: ["for_you", "following", "trending", "urgent"],
	})
	@ApiQuery({ name: "categoryId", required: false })
	@ApiQuery({ name: "city", required: false })
	@ApiQuery({ name: "search", required: false })
	list(
		@Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
		@CurrentUser() user: AuthUser | undefined,
	) {
		return this.feedService.list(query, user?.id ?? null);
	}
}
