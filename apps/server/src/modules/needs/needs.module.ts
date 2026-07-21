import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { NeedsController } from "./needs.controller";
import { NeedsService } from "./needs.service";
import { OrgNeedsController } from "./org-needs.controller";

@Module({
	imports: [OrganizationsModule],
	controllers: [NeedsController, OrgNeedsController],
	providers: [NeedsService],
	exports: [NeedsService],
})
export class NeedsModule {}
