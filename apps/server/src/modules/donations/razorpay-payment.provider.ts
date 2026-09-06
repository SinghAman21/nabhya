import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
} from "./payment.types";

export interface RazorpayConfig {
	keyId: string;
	keySecret: string;
	webhookSecret: string;
}

/**
 * Razorpay adapter, used with the native checkout SDK (`react-native-razorpay`)
 * on the client — the client opens an in-app sheet with the order id + key id
 * this provider returns, it never navigates to a hosted page.
 *
 * Two things worth knowing:
 *
 * 1. Razorpay's Orders API takes an arbitrary integer amount in paise — no
 *    whole-rupee restriction.
 * 2. A new order must be created per payment attempt; reusing an order id after
 *    a failed attempt is rejected by Razorpay.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
	readonly name = "razorpay";
	private readonly logger = new Logger(RazorpayPaymentProvider.name);
	private readonly baseUrl = "https://api.razorpay.com/v1";

	constructor(private readonly config: RazorpayConfig) {}

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		const auth = Buffer.from(
			`${this.config.keyId}:${this.config.keySecret}`,
		).toString("base64");

		const response = await fetch(`${this.baseUrl}/orders`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				amount: input.amountMinor,
				currency: input.currency,
				// Donation ids are uuids (36 chars) — well within the 40-char limit.
				receipt: input.referenceId,
				notes: { referenceId: input.referenceId },
			}),
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			this.logger.error(
				`Razorpay order creation failed (${response.status}): ${detail.slice(0, 500)}`,
			);
			throw new BadRequestException(
				"Could not start the payment. Please try again.",
			);
		}

		const body = (await response.json()) as {
			id?: string;
			amount?: number;
			currency?: string;
		};

		if (!body.id) {
			throw new BadRequestException(
				"Payment provider did not return an order id.",
			);
		}

		return {
			providerCheckoutId: body.id,
			amountMinor: body.amount ?? input.amountMinor,
			currency: body.currency ?? input.currency,
			publicKeyId: this.config.keyId,
		};
	}

	parseWebhook(rawBody: string, headers: Record<string, string>): PaymentEvent {
		this.verifySignature(rawBody, headers);

		const event = JSON.parse(rawBody) as {
			event?: string;
			payload?: {
				payment?: {
					entity?: {
						id?: string;
						amount?: number;
						notes?: Record<string, string>;
						error_description?: string;
					};
				};
			};
		};

		const entity = event.payload?.payment?.entity ?? {};
		const referenceId = entity.notes?.referenceId ?? null;
		const providerPaymentId = entity.id ?? null;
		const amountMinor = entity.amount ?? null;

		switch (event.event) {
			case "payment.captured":
				return {
					kind: "SUCCEEDED",
					referenceId,
					providerPaymentId,
					amountMinor,
				};
			// TODO(payments): the exact failed-payment and refund event names below
			// were not confirmed against a live webhook at implementation time —
			// verify them (Razorpay dashboard → Webhooks → event log) during test-mode
			// QA and correct if different.
			case "payment.failed":
				return {
					kind: "FAILED",
					referenceId,
					providerPaymentId,
					amountMinor,
					failureReason: entity.error_description ?? null,
				};
			case "refund.processed":
				return {
					kind: "REFUNDED",
					referenceId,
					providerPaymentId,
					amountMinor,
				};
			default:
				// Razorpay sends more event types than we act on (e.g.
				// payment.authorized, when auto-capture is off); acknowledging them
				// keeps it from retrying deliveries we don't need.
				return { kind: "IGNORED", referenceId, providerPaymentId, amountMinor };
		}
	}

	/**
	 * Razorpay webhooks: HMAC-SHA256(rawBody, webhookSecret), hex digest, in the
	 * `X-Razorpay-Signature` header. Razorpay does not include a timestamp in
	 * the signature — there is no replay-window check possible here. Idempotency
	 * is instead enforced entirely downstream, by the PENDING-only guard and the
	 * unique index on `provider_payment_id` in DonationsService — this is
	 * deliberate, not an oversight.
	 */
	private verifySignature(rawBody: string, headers: Record<string, string>) {
		const signature = headers["x-razorpay-signature"];
		if (!signature) {
			throw new BadRequestException("Missing webhook signature");
		}

		const expected = createHmac("sha256", this.config.webhookSecret)
			.update(rawBody)
			.digest("hex");

		if (!safeEquals(signature, expected)) {
			throw new BadRequestException("Invalid webhook signature");
		}
	}
}

function safeEquals(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}
