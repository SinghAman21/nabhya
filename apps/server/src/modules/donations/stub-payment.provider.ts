import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type {
	CheckoutRequest,
	CheckoutResult,
	PaymentEvent,
	PaymentProvider,
	RefundRequest,
	RefundResult,
} from "./payment.types";

/**
 * Stand-in used when Razorpay credentials are absent.
 *
 * Keeps the whole donation flow exercisable locally - a checkout is issued and
 * the webhook path can be driven by POSTing a plain JSON body - without any
 * signature. Refused in production by DonationsModule.
 */
export class StubPaymentProvider implements PaymentProvider {
	readonly name = "stub";
	private readonly logger = new Logger(StubPaymentProvider.name);

	async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
		this.logger.warn(
			`Payment stub issued a checkout for donation ${input.referenceId} - no money will move.` +
				(input.destinationAccountId
					? ` (Route transfer simulated to ${input.destinationAccountId})`
					: ""),
		);
		return {
			providerCheckoutId: `stub_${randomUUID()}`,
			checkoutUrl: `https://payments.invalid/stub-checkout/${input.referenceId}`,
		};
	}

	parseWebhook(rawBody: string): PaymentEvent {
		const event = JSON.parse(rawBody) as {
			type?: string;
			event?: string;
			referenceId?: string;
			paymentId?: string;
			amountMinor?: number;
			transferId?: string;
			accountId?: string;
			payload?: {
				payment?: {
					entity?: {
						id?: string;
						amount?: number;
						notes?: { referenceId?: string };
					};
				};
				transfer?: {
					entity?: {
						id?: string;
						amount?: number;
						recipient?: string;
						notes?: { referenceId?: string };
						error?: { description?: string };
					};
				};
				account?: {
					entity?: {
						id?: string;
					};
				};
			};
		};

		const entity = event.payload?.payment?.entity;
		const transferEntity = event.payload?.transfer?.entity;
		const eventName = event.event ?? event.type;

		if (eventName === "transfer.processed") {
			return {
				kind: "TRANSFER_PROCESSED",
				referenceId:
					event.referenceId ?? transferEntity?.notes?.referenceId ?? null,
				providerPaymentId: null,
				amountMinor: transferEntity?.amount ?? null,
				transferId:
					event.transferId ?? transferEntity?.id ?? `stub_trf_${randomUUID()}`,
			};
		}

		if (eventName === "transfer.failed") {
			return {
				kind: "TRANSFER_FAILED",
				referenceId:
					event.referenceId ?? transferEntity?.notes?.referenceId ?? null,
				providerPaymentId: null,
				amountMinor: transferEntity?.amount ?? null,
				transferId:
					event.transferId ?? transferEntity?.id ?? `stub_trf_${randomUUID()}`,
				failureReason:
					transferEntity?.error?.description ?? "Simulated transfer failure",
			};
		}

		if (eventName?.startsWith("account.")) {
			return {
				kind: "ACCOUNT_UPDATED",
				referenceId: null,
				providerPaymentId: null,
				amountMinor: null,
				accountEventType: eventName,
				accountId:
					event.accountId ??
					event.payload?.account?.entity?.id ??
					`acc_stub_${randomUUID()}`,
			};
		}

		return {
			kind:
				eventName === "payment.failed"
					? "FAILED"
					: eventName === "refund.processed"
						? "REFUNDED"
						: "SUCCEEDED",
			referenceId: event.referenceId ?? entity?.notes?.referenceId ?? null,
			providerPaymentId:
				event.paymentId ?? entity?.id ?? `stub_${randomUUID()}`,
			amountMinor: event.amountMinor ?? entity?.amount ?? null,
		};
	}

	async refund(input: RefundRequest): Promise<RefundResult> {
		this.logger.warn(
			`Payment stub issued a refund for payment ${input.providerPaymentId} - no money will move.`,
		);
		return {
			refundId: `stub_rfnd_${randomUUID()}`,
			amountMinor: input.amountMinor ?? 0,
			status: "processed",
		};
	}
}
