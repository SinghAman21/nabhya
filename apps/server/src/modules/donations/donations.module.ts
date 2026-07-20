import { env } from "@nabhya/env/server";
import { Logger, Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DodoPaymentProvider } from "./dodo-payment.provider";
import { DonationsController } from "./donations.controller";
import { DonationsService } from "./donations.service";
import { PAYMENT_PROVIDER_TOKEN, type PaymentProvider } from "./payment.types";
import { StubPaymentProvider } from "./stub-payment.provider";

const logger = new Logger("DonationsModule");

function createPaymentProvider(): PaymentProvider {
	const configured =
		env.DODO_API_KEY && env.DODO_WEBHOOK_SECRET && env.DODO_DONATION_PRODUCT_ID;

	if (configured) {
		const mode = env.NODE_ENV === "production" ? "live" : "test";
		logger.log(`Payments: Dodo Payments (${mode} mode)`);
		return new DodoPaymentProvider({
			apiKey: env.DODO_API_KEY as string,
			webhookSecret: env.DODO_WEBHOOK_SECRET as string,
			productId: env.DODO_DONATION_PRODUCT_ID as string,
			mode,
		});
	}

	// Accepting donations that silently go nowhere would be taking money for
	// nothing — refuse to start rather than pretend.
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Payments are not configured. Set DODO_API_KEY, DODO_WEBHOOK_SECRET " +
				"and DODO_DONATION_PRODUCT_ID before starting in production.",
		);
	}

	logger.warn(
		"Payments: stub provider (no Dodo credentials). Checkouts are simulated " +
			"and no money moves — set the DODO_* variables in .env.local.",
	);
	return new StubPaymentProvider();
}

@Module({
	imports: [OrganizationsModule],
	controllers: [DonationsController],
	providers: [
		DonationsService,
		{ provide: PAYMENT_PROVIDER_TOKEN, useFactory: createPaymentProvider },
	],
	exports: [DonationsService],
})
export class DonationsModule {}
