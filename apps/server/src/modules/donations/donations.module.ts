import { env } from "@nabhya/env/server";
import { Logger, Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DonationsController } from "./donations.controller";
import { DonationsService } from "./donations.service";
import { PAYMENT_PROVIDER_TOKEN, type PaymentProvider } from "./payment.types";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";
import { StubPaymentProvider } from "./stub-payment.provider";

const logger = new Logger("DonationsModule");

function createPaymentProvider(): PaymentProvider {
	const configured =
		env.RAZORPAY_KEY_ID &&
		env.RAZORPAY_KEY_SECRET &&
		env.RAZORPAY_WEBHOOK_SECRET;

	if (configured) {
		const mode = env.NODE_ENV === "production" ? "live" : "test";
		logger.log(`Payments: Razorpay (${mode} mode)`);
		return new RazorpayPaymentProvider({
			keyId: env.RAZORPAY_KEY_ID as string,
			keySecret: env.RAZORPAY_KEY_SECRET as string,
			webhookSecret: env.RAZORPAY_WEBHOOK_SECRET as string,
		});
	}

	// Accepting donations that silently go nowhere would be taking money for
	// nothing — refuse to start rather than pretend.
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Payments are not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET " +
				"and RAZORPAY_WEBHOOK_SECRET before starting in production.",
		);
	}

	logger.warn(
		"Payments: stub provider (no Razorpay credentials). Checkouts are " +
			"simulated and no money moves — set the RAZORPAY_* variables in .env.",
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
