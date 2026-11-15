import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "../common/audit";
import { DatabaseModule } from "../common/database";
import { JwtGuard, RolesGuard } from "../common/guards";
import { throttlerConfig } from "../common/guards/throttler.config";
import { MailModule } from "../common/mail";
import { StorageModule } from "../common/storage";
import { AdminModule } from "../modules/admin/admin.module";
import { CategoriesModule } from "../modules/categories/categories.module";
import { CertificatesModule } from "../modules/certificates/certificates.module";
import { DonationsModule } from "../modules/donations/donations.module";
import { EngagementModule } from "../modules/engagement/engagement.module";
import { EventsModule } from "../modules/events/events.module";
import { FeedModule } from "../modules/feed/feed.module";
import { NeedsModule } from "../modules/needs/needs.module";
import { NotificationsModule } from "../modules/notifications/notifications.module";
import { OnboardingModule } from "../modules/onboarding/onboarding.module";
import { OrganizationsModule } from "../modules/organizations/organizations.module";
import { PayoutsModule } from "../modules/payouts/payouts.module";
import { PublishingModule } from "../modules/publishing/publishing.module";
import { SearchModule } from "../modules/search/search.module";
import { UploadsModule } from "../modules/uploads/uploads.module";
import { UsersModule } from "../modules/users/users.module";
import { AppController } from "./app.controller";

@Module({
	imports: [
		ThrottlerModule.forRoot(throttlerConfig),
		DatabaseModule, // global - provides db to the whole app
		AuditModule, // global - provides the activity trail writer
		StorageModule, // global - provides object storage (Supabase Storage, or a dev stub)
		MailModule, // global - sends transactional email through Resend when configured
		UploadsModule,
		UsersModule,
		OnboardingModule,
		OrganizationsModule,
		CategoriesModule,
		EventsModule,
		FeedModule,
		NeedsModule,
		NotificationsModule, // global - other modules emit through it
		EngagementModule,
		CertificatesModule,
		PublishingModule,
		SearchModule,
		DonationsModule,
		AdminModule,
		PayoutsModule,
	],
	providers: [
		// Order matters - guards run top to bottom. Rate limiting comes first so
		// a flood is rejected before it costs a JWT verification and two queries.
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
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
