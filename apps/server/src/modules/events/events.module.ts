import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UploadsModule } from "../uploads/uploads.module";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { OrgEventsController } from "./org-events.controller";

@Module({
	imports: [OrganizationsModule, UploadsModule],
	controllers: [EventsController, OrgEventsController],
	providers: [EventsService],
	exports: [EventsService],
})
export class EventsModule {}
