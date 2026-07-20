import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UploadsModule } from "../uploads/uploads.module";
import { ImpactService } from "./impact.service";
import { PublishingController } from "./publishing.controller";
import { PublishingService } from "./publishing.service";

@Module({
	imports: [OrganizationsModule, UploadsModule],
	controllers: [PublishingController],
	providers: [PublishingService, ImpactService],
	exports: [PublishingService, ImpactService],
})
export class PublishingModule {}
