import type { SearchQuery } from "@nabhya/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/types";
import { paginate } from "../../common/utils";
import { FeedRankingService } from "../feed/feed-ranking.service";
import { OrganizationsService } from "../organizations/organizations.service";

@Injectable()
export class SearchService {
	constructor(
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		@Inject(FeedRankingService)
		private readonly feedRankingService: FeedRankingService,
	) {}

	async search(user: AuthUser | undefined, query: SearchQuery) {
		const showOrganizations = query.scope === "all" || query.scope === "ngos";
		const showFeed = query.scope !== "ngos";
		const pagination = { page: query.page, limit: query.limit };
		const feedQuery = {
			page: query.page,
			limit: query.limit,
			search: query.search,
			...(query.scope === "need"
				? { kind: "NEED" as const }
				: query.scope === "event"
					? { kind: "EVENT" as const }
					: query.scope === "story"
						? { kind: "ANNOUNCEMENT" as const }
						: query.scope === "post"
							? { kind: "POST" as const }
							: {}),
		};

		const [organizations, feed] = await Promise.all([
			showOrganizations
				? this.organizationsService.listPublic({
						...pagination,
						search: query.search,
					})
				: Promise.resolve(paginate([], 0, pagination)),
			showFeed
				? this.feedRankingService.forYou(user, feedQuery)
				: Promise.resolve(paginate([], 0, pagination)),
		]);

		return { organizations, feed };
	}
}
