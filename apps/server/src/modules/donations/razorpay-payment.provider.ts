import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
	RefundRequest,
	RefundResult,
} from "./payment.types";

export interface RazorpayConfig {
	keyId: string;
	keySecret: string;
	webhookSecret: string;
}

/**
 * Razorpay adapter, used with the native checkout SDK (`react-native-razorpay`)
 * on the client - the client opens an in-app sheet with the order id + key id
 * this provider returns, it never navigates to a hosted page.
 *
 * Route Direct Settlement:
 * When `destinationAccountId` is supplied, an order-level `transfers` block is
 * attached, directing Razorpay to settle funds directly into the linked account
 * upon successful payment capture.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
	readonly name = "razorpay";
	private readonly logger = new Logger(RazorpayPaymentProvider.name);
	private readonly baseUrl = "https://api.razorpay.com/v1";

	constructor(private readonly config: RazorpayConfig) {}

	private get authHeader(): string {
		return `Basic ${Buffer.from(
			`${this.config.keyId}:${this.config.keySecret}`,
		).toString("base64")}`;
	}

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		const payload: Record<string, unknown> = {
			amount: input.amountMinor,
			currency: input.currency,
			// Donation ids are uuids (36 chars) - well within the 40-char limit.
			receipt: input.referenceId,
			notes: { referenceId: input.referenceId },
		};

		// Razorpay Route direct-settlement transfer instruction
		if (input.destinationAccountId) {
			payload.transfers = [
				{
					account: input.destinationAccountId,
					amount: input.transferAmountMinor ?? input.amountMinor,
					currency: input.currency,
					notes: {
						referenceId: input.referenceId,
					},
					on_hold: 0,
				},
			];
		}

		const response = await fetch(`${this.baseUrl}/orders`, {
			method: "POST",
			headers: {
				Authorization: this.authHeader,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
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
			account_id?: string;
			payload?: {
				payment?: {
					entity?: {
						id?: string;
						amount?: number;
						notes?: Record<string, string>;
						error_description?: string;
					};
				};
				transfer?: {
					entity?: {
						id?: string;
						amount?: number;
						recipient?: string;
						payment_id?: string;
						notes?: Record<string, string>;
						error?: { description?: string };
					};
				};
				account?: {
					entity?: {
						id?: string;
						status?: string;
					};
				};
			};
		};

		const paymentEntity = event.payload?.payment?.entity ?? {};
		const transferEntity = event.payload?.transfer?.entity ?? {};
		const eventName = event.event ?? "";

		// ─── Transfer Events (Route) ─────────────────────────────────────────────
		if (eventName === "transfer.processed") {
			return {
				kind: "TRANSFER_PROCESSED",
				referenceId:
					transferEntity.notes?.referenceId ??
					transferEntity.notes?.donationId ??
					null,
				providerPaymentId: transferEntity.payment_id ?? null,
				amountMinor: transferEntity.amount ?? null,
				transferId: transferEntity.id ?? null,
				destinationAccountId: transferEntity.recipient ?? null,
			};
		}

		if (eventName === "transfer.failed") {
			return {
				kind: "TRANSFER_FAILED",
				referenceId:
					transferEntity.notes?.referenceId ??
					transferEntity.notes?.donationId ??
					null,
				providerPaymentId: transferEntity.payment_id ?? null,
				amountMinor: transferEntity.amount ?? null,
				transferId: transferEntity.id ?? null,
				destinationAccountId: transferEntity.recipient ?? null,
				failureReason:
					transferEntity.error?.description ?? "Transfer failed at bank",
			};
		}

		// ─── Linked Account Events (Route) ───────────────────────────────────────
		if (eventName.startsWith("account.")) {
			return {
				kind: "ACCOUNT_UPDATED",
				referenceId: null,
				providerPaymentId: null,
				amountMinor: null,
				accountEventType: eventName,
				accountId:
					event.payload?.account?.entity?.id ?? event.account_id ?? null,
			};
		}

		// ─── Payment Events ──────────────────────────────────────────────────────
		const referenceId = paymentEntity.notes?.referenceId ?? null;
		const providerPaymentId = paymentEntity.id ?? null;
		const amountMinor = paymentEntity.amount ?? null;

		switch (eventName) {
			case "payment.captured":
			case "order.paid":
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
					failureReason: paymentEntity.error_description ?? null,
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

	async refund(input: RefundRequest): Promise<RefundResult> {
		const payload: Record<string, unknown> = {};
		if (input.amountMinor) payload.amount = input.amountMinor;
		if (input.reverseAll) payload.reverse_all = 1;
		if (input.notes) payload.notes = input.notes;

		const response = await fetch(
			`${this.baseUrl}/payments/${input.providerPaymentId}/refund`,
			{
				method: "POST",
				headers: {
					Authorization: this.authHeader,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			},
		);

		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			this.logger.error(
				`Razorpay refund failed (${response.status}): ${detail.slice(0, 500)}`,
			);
			throw new BadRequestException(
				"Refund request failed with payment provider.",
			);
		}

		const body = (await response.json()) as {
			id?: string;
			amount?: number;
			status?: string;
		};
		if (!body.id) {
			throw new BadRequestException(
				"Payment provider did not return a refund id.",
			);
		}

		return {
			refundId: body.id,
			amountMinor: body.amount ?? input.amountMinor ?? 0,
			status: body.status ?? "processed",
		};
	}

	/**
	 * Razorpay webhooks: HMAC-SHA256(rawBody, webhookSecret), hex digest, in the
	 * `X-Razorpay-Signature` header.
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
