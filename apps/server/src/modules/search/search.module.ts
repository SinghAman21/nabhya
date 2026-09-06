import { Module } from "@nestjs/common";
import { FeedModule } from "../feed/feed.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
	imports: [OrganizationsModule, FeedModule],
	controllers: [SearchController],
	providers: [SearchService],
})
export class SearchModule {}
