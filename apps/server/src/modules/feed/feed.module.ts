import { Module } from "@nestjs/common";
import { UploadsModule } from "../uploads/uploads.module";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";

@Module({
	imports: [UploadsModule],
	controllers: [FeedController],
	providers: [FeedService],
})
export class FeedModule {}
