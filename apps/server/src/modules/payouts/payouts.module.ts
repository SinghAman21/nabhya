import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";
import { RazorpayRouteService } from "./razorpay-route.service";

@Module({
	imports: [
		// OrganizationsModule exports OrganizationsService, used for the
		// `requireOrgByUser` helper in PayoutsService. We query organizations
		// directly via the DB token instead, so no import needed here - but
		// OrganizationsModule is imported for future cross-module reads.
		// NotificationsModule is global, but explicit import keeps deps visible.
	],
	controllers: [PayoutsController],
	providers: [PayoutsService, RazorpayRouteService],
	exports: [PayoutsService],
})
export class PayoutsModule {}
