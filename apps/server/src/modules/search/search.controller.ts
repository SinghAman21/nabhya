import type { SearchQuery } from "@nabhya/shared";
import { searchQuerySchema } from "@nabhya/shared";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentUser, OptionalAuth } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { SearchService } from "./search.service";

@ApiTags("Search")
@Controller("search")
export class SearchController {
	constructor(
		@Inject(SearchService) private readonly searchService: SearchService,
	) {}

	@OptionalAuth()
	@Get()
	@ApiOperation({ summary: "Search NGOs and feed content" })
	@ApiQuery({ name: "search", required: true })
	@ApiQuery({
		name: "scope",
		required: false,
		enum: ["all", "ngos", "need", "event", "story", "post"],
	})
	search(
		@CurrentUser() user: AuthUser | undefined,
		@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
	) {
		return this.searchService.search(user, query);
	}
}
