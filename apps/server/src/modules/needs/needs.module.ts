import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UploadsModule } from "../uploads/uploads.module";
import { NeedsController } from "./needs.controller";
import { NeedsService } from "./needs.service";
import { OrgNeedsController } from "./org-needs.controller";

@Module({
	imports: [OrganizationsModule, UploadsModule],
	controllers: [NeedsController, OrgNeedsController],
	providers: [NeedsService],
	exports: [NeedsService],
})
export class NeedsModule {}
