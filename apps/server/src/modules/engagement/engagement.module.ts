import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { EngagementController } from "./engagement.controller";
import { EngagementService } from "./engagement.service";

@Module({
	imports: [OrganizationsModule],
	controllers: [EngagementController],
	providers: [EngagementService],
	exports: [EngagementService],
})
export class EngagementModule {}
