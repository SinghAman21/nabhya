export const PAYMENT_PROVIDER_TOKEN = "PAYMENT_PROVIDER";

export interface CheckoutRequest {
	/** Our donation id — echoed back on the webhook via metadata. */
	referenceId: string;
	amountMinor: number;
	currency: string;
	organizationName: string;
	donorName?: string | null;
	donorEmail?: string | null;
	returnUrl: string;
}

export interface CheckoutResult {
	/** Provider's handle for the session, stored for reconciliation. */
	providerCheckoutId: string;
	checkoutUrl: string;
}

export type PaymentEventKind = "SUCCEEDED" | "FAILED" | "REFUNDED" | "IGNORED";

export interface PaymentEvent {
	kind: PaymentEventKind;
	/** Our donation id, recovered from provider metadata. */
	referenceId: string | null;
	providerPaymentId: string | null;
	amountMinor: number | null;
	failureReason?: string | null;
}

export interface PaymentProvider {
	readonly name: string;
	createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
	/**
	 * Verifies authenticity and normalises the payload. Receives the *raw* body
	 * — re-serialising JSON would change bytes and break the signature.
	 */
	parseWebhook(rawBody: string, headers: Record<string, string>): PaymentEvent;
}
