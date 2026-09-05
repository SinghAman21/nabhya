import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UploadsModule } from "../uploads/uploads.module";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";
import { FeedEngagementService } from "./feed-engagement.service";
import { FeedRankingService } from "./feed-ranking.service";

@Module({
	imports: [UploadsModule, OrganizationsModule],
	controllers: [FeedController],
	providers: [FeedService, FeedRankingService, FeedEngagementService],
})
export class FeedModule {}
