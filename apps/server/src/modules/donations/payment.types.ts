export const PAYMENT_PROVIDER_TOKEN = "PAYMENT_PROVIDER";

export interface CheckoutRequest {
	/** Our donation id - echoed back on the webhook via metadata. */
	referenceId: string;
	amountMinor: number;
	currency: string;
	organizationName: string;
	donorName?: string | null;
	donorEmail?: string | null;
	returnUrl: string;
	/** Razorpay Route: linked account id of the receiving NGO. */
	destinationAccountId?: string | null;
	/** Transfer amount in paise. Defaults to full donation amount in v1. */
	transferAmountMinor?: number | null;
}

export interface CheckoutResult {
	/** Provider's handle for the session, stored for reconciliation. */
	providerCheckoutId: string;
	checkoutUrl?: string;
	amountMinor?: number;
	currency?: string;
	publicKeyId?: string;
}

export type PaymentEventKind =
	| "SUCCEEDED"
	| "FAILED"
	| "REFUNDED"
	| "TRANSFER_PROCESSED"
	| "TRANSFER_FAILED"
	| "ACCOUNT_UPDATED"
	| "IGNORED";

export interface PaymentEvent {
	kind: PaymentEventKind;
	/** Our donation id, recovered from provider metadata or transfer notes. */
	referenceId: string | null;
	providerPaymentId: string | null;
	amountMinor: number | null;
	failureReason?: string | null;
	/** Route transfer identifier (e.g. trf_xxx) */
	transferId?: string | null;
	/** Route destination linked account */
	destinationAccountId?: string | null;
	/** Razorpay account event name (e.g. account.activated) */
	accountEventType?: string | null;
	/** Razorpay linked account id */
	accountId?: string | null;
}

export interface RefundRequest {
	providerPaymentId: string;
	amountMinor?: number;
	reverseAll?: boolean;
	notes?: Record<string, string>;
}

export interface RefundResult {
	refundId: string;
	amountMinor: number;
	status: string;
}

export interface PaymentProvider {
	readonly name: string;
	createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
	/**
	 * Verifies authenticity and normalises the payload. Receives the *raw* body
	 * - re-serialising JSON would change bytes and break the signature.
	 */
	parseWebhook(rawBody: string, headers: Record<string, string>): PaymentEvent;
	refund?(input: RefundRequest): Promise<RefundResult>;
}
