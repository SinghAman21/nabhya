import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
} from "./payment.types";

/**
 * Stand-in used when Razorpay credentials are absent.
 *
 * Keeps the whole donation flow exercisable locally — a checkout is issued and
 * the webhook path can be driven by POSTing a JSON body shaped like Razorpay's
 * real webhook payload — without a real signature. Refused in production by
 * DonationsModule.
 */
export class StubPaymentProvider implements PaymentProvider {
	readonly name = "stub";
	private readonly logger = new Logger(StubPaymentProvider.name);

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		this.logger.warn(
			`Payment stub issued a checkout for donation ${input.referenceId} — no money will move.`,
		);
		return {
			providerCheckoutId: `order_stub_${randomUUID()}`,
			amountMinor: input.amountMinor,
			currency: input.currency,
			publicKeyId: "rzp_test_stub",
		};
	}

	parseWebhook(rawBody: string): PaymentEvent {
		const event = JSON.parse(rawBody) as {
			event?: string;
			payload?: {
				payment?: {
					entity?: {
						id?: string;
						amount?: number;
						notes?: { referenceId?: string };
					};
				};
			};
		};

		const entity = event.payload?.payment?.entity ?? {};
		return {
			kind: event.event === "payment.failed" ? "FAILED" : "SUCCEEDED",
			referenceId: entity.notes?.referenceId ?? null,
			providerPaymentId: entity.id ?? `pay_stub_${randomUUID()}`,
			amountMinor: entity.amount ?? null,
		};
	}
}
