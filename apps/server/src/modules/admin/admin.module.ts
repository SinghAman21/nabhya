import { Module } from "@nestjs/common";
import { FeedModule } from "../feed/feed.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { FinanceService } from "./finance.service";

@Module({
	imports: [FeedModule],
	controllers: [AdminController],
	providers: [AdminService, FinanceService],
	exports: [AdminService],
})
export class AdminModule {}
