import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
} from "./payment.types";

/**
 * Stand-in used when Dodo credentials are absent.
 *
 * Keeps the whole donation flow exercisable locally — a checkout is issued and
 * the webhook path can be driven by POSTing a plain JSON body — without any
 * signature. Refused in production by DonationsModule.
 */
export class StubPaymentProvider implements PaymentProvider {
	readonly name = "stub";
	private readonly logger = new Logger(StubPaymentProvider.name);

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		this.logger.warn(
			`Payment stub issued a checkout for donation ${input.referenceId} — no money will move.`,
		);
		return {
			providerCheckoutId: `stub_${randomUUID()}`,
			checkoutUrl: `https://payments.invalid/stub-checkout/${input.referenceId}`,
		};
	}

	parseWebhook(rawBody: string): PaymentEvent {
		const event = JSON.parse(rawBody) as {
			type?: string;
			referenceId?: string;
			paymentId?: string;
			amountMinor?: number;
		};

		return {
			kind: event.type === "payment.failed" ? "FAILED" : "SUCCEEDED",
			referenceId: event.referenceId ?? null,
			providerPaymentId: event.paymentId ?? `stub_${randomUUID()}`,
			amountMinor: event.amountMinor ?? null,
		};
	}
}
