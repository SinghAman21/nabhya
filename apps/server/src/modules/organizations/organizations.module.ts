import { Module } from "@nestjs/common";
import { UploadsModule } from "../uploads/uploads.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
	imports: [UploadsModule],
	controllers: [OrganizationsController],
	providers: [OrganizationsService],
	// Exported so the events, needs and onboarding modules can resolve and
	// authorize the caller's organization without duplicating the check.
	exports: [OrganizationsService],
})
export class OrganizationsModule {}
