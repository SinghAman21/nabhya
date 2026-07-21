import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
	controllers: [OrganizationsController],
	providers: [OrganizationsService],
	// Exported so the events, needs and onboarding modules can resolve and
	// authorize the caller's organization without duplicating the check.
	exports: [OrganizationsService],
})
export class OrganizationsModule {}
