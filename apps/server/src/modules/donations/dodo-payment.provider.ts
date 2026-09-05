import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
} from "./payment.types";

export interface DodoConfig {
	apiKey: string;
	webhookSecret: string;
	productId: string;
	mode: "test" | "live";
}

/** Reject anything older than this to blunt replay attacks. */
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

/**
 * Dodo Payments adapter.
 *
 * Two things worth knowing:
 *
 * 1. Dodo is product-based — `POST /payments` requires a `product_cart`, not a
 *    free-form amount. Variable donations are expressed as N units of a
 *    ₹1 "donation" product, so `amountMinor` must be a whole number of rupees.
 *    Configure that product's id as DODO_DONATION_PRODUCT_ID.
 * 2. Webhooks follow the Standard Webhooks spec: the signed message is
 *    `{webhook-id}.{webhook-timestamp}.{raw body}`, HMAC-SHA256, base64.
 */
export class DodoPaymentProvider implements PaymentProvider {
	readonly name = "dodo";
	private readonly logger = new Logger(DodoPaymentProvider.name);
	private readonly baseUrl: string;

	constructor(private readonly config: DodoConfig) {
		this.baseUrl =
			config.mode === "live"
				? "https://live.dodopayments.com"
				: "https://test.dodopayments.com";
	}

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		// One unit == ₹1 (100 paise). Anything finer cannot be represented.
		if (input.amountMinor % 100 !== 0) {
			throw new BadRequestException(
				"Donations must be a whole number of rupees.",
			);
		}
		const quantity = input.amountMinor / 100;

		const response = await fetch(`${this.baseUrl}/payments`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				payment_link: true,
				product_cart: [{ product_id: this.config.productId, quantity }],
				customer: {
					name: input.donorName ?? "Anonymous donor",
					email: input.donorEmail ?? undefined,
				},
				billing: { country: "IN" },
				return_url: input.returnUrl,
				// Echoed back on the webhook — how we find our donation row again.
				metadata: { referenceId: input.referenceId },
			}),
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			this.logger.error(
				`Dodo checkout failed (${response.status}): ${detail.slice(0, 500)}`,
			);
			throw new BadRequestException(
				"Could not start the payment. Please try again.",
			);
		}

		const body = (await response.json()) as {
			payment_id?: string;
			payment_link?: string;
		};

		if (!body.payment_id || !body.payment_link) {
			throw new BadRequestException(
				"Payment provider did not return a checkout link.",
			);
		}

		return {
			providerCheckoutId: body.payment_id,
			checkoutUrl: body.payment_link,
		};
	}

	parseWebhook(rawBody: string, headers: Record<string, string>): PaymentEvent {
		this.verifySignature(rawBody, headers);

		const event = JSON.parse(rawBody) as {
			type?: string;
			data?: {
				payment_id?: string;
				total_amount?: number;
				metadata?: Record<string, string>;
				error_message?: string;
			};
		};

		const data = event.data ?? {};
		const referenceId = data.metadata?.referenceId ?? null;
		const providerPaymentId = data.payment_id ?? null;
		const amountMinor = data.total_amount ?? null;

		switch (event.type) {
			case "payment.succeeded":
				return {
					kind: "SUCCEEDED",
					referenceId,
					providerPaymentId,
					amountMinor,
				};
			case "payment.failed":
				return {
					kind: "FAILED",
					referenceId,
					providerPaymentId,
					amountMinor,
					failureReason: data.error_message ?? null,
				};
			case "refund.succeeded":
				return {
					kind: "REFUNDED",
					referenceId,
					providerPaymentId,
					amountMinor,
				};
			default:
				// Dodo sends far more event types than we act on; acknowledging
				// them keeps it from retrying events we simply don't care about.
				return {
					kind: "IGNORED",
					referenceId,
					providerPaymentId,
					amountMinor,
				};
		}
	}

	/** Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`, base64. */
	private verifySignature(rawBody: string, headers: Record<string, string>) {
		const id = headers["webhook-id"];
		const timestamp = headers["webhook-timestamp"];
		const signatureHeader = headers["webhook-signature"];

		if (!id || !timestamp || !signatureHeader) {
			throw new BadRequestException("Missing webhook signature headers");
		}

		const age = Math.abs(Date.now() / 1000 - Number(timestamp));
		if (!Number.isFinite(age) || age > MAX_WEBHOOK_AGE_SECONDS) {
			throw new BadRequestException("Webhook timestamp is outside the window");
		}

		const secret = this.config.webhookSecret.startsWith("whsec_")
			? this.config.webhookSecret.slice(6)
			: this.config.webhookSecret;

		const expected = createHmac("sha256", Buffer.from(secret, "base64"))
			.update(`${id}.${timestamp}.${rawBody}`)
			.digest("base64");

		// The header carries space-separated `v1,<sig>` entries; any match passes.
		const provided = signatureHeader
			.split(" ")
			.map((part) => part.split(",")[1] ?? "")
			.filter(Boolean);

		const matches = provided.some((candidate) =>
			safeEquals(candidate, expected),
		);
		if (!matches) {
			throw new BadRequestException("Invalid webhook signature");
		}
	}
}

function safeEquals(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	// timingSafeEqual throws on length mismatch, which itself leaks nothing here.
	return left.length === right.length && timingSafeEqual(left, right);
}
