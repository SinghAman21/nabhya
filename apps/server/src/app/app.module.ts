import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "../common/audit";
import { DatabaseModule } from "../common/database";
import { JwtGuard, RolesGuard } from "../common/guards";
import { StorageModule } from "../common/storage";
import { AdminModule } from "../modules/admin/admin.module";
import { CategoriesModule } from "../modules/categories/categories.module";
import { CertificatesModule } from "../modules/certificates/certificates.module";
import { DonationsModule } from "../modules/donations/donations.module";
import { EngagementModule } from "../modules/engagement/engagement.module";
import { EventsModule } from "../modules/events/events.module";
import { NeedsModule } from "../modules/needs/needs.module";
import { NotificationsModule } from "../modules/notifications/notifications.module";
import { OnboardingModule } from "../modules/onboarding/onboarding.module";
import { OrganizationsModule } from "../modules/organizations/organizations.module";
import { PublishingModule } from "../modules/publishing/publishing.module";
import { UploadsModule } from "../modules/uploads/uploads.module";
import { UsersModule } from "../modules/users/users.module";
import { AppController } from "./app.controller";

@Module({
	imports: [
		DatabaseModule, // global — provides db to the whole app
		AuditModule, // global — provides the activity trail writer
		StorageModule, // global — provides object storage (R2, or a dev stub)
		UploadsModule,
		UsersModule,
		OnboardingModule,
		OrganizationsModule,
		CategoriesModule,
		EventsModule,
		NeedsModule,
		NotificationsModule, // global — other modules emit through it
		EngagementModule,
		CertificatesModule,
		PublishingModule,
		DonationsModule,
		AdminModule,
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: JwtGuard,
		},
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
	],
	controllers: [AppController],
})
export class AppModule {}
