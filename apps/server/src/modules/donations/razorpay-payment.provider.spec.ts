import { createHmac } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";

const WEBHOOK_SECRET = "test-webhook-secret";

function makeProvider() {
	return new RazorpayPaymentProvider({
		keyId: "rzp_test_key",
		keySecret: "test-key-secret",
		webhookSecret: WEBHOOK_SECRET,
	});
}

/** Razorpay: HMAC-SHA256(rawBody, webhookSecret), hex digest. */
function sign(body: string) {
	return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function headersFor(body: string, overrides: Record<string, string> = {}) {
	return { "x-razorpay-signature": sign(body), ...overrides };
}

describe("RazorpayPaymentProvider.parseWebhook", () => {
	const provider = makeProvider();

	it("accepts a correctly signed captured event", () => {
		const body = JSON.stringify({
			event: "payment.captured",
			payload: {
				payment: {
					entity: {
						id: "pay_1",
						amount: 100_000,
						notes: { referenceId: "donation-1" },
					},
				},
			},
		});

		expect(provider.parseWebhook(body, headersFor(body))).toEqual({
			kind: "SUCCEEDED",
			referenceId: "donation-1",
			providerPaymentId: "pay_1",
			amountMinor: 100_000,
		});
	});

	it("rejects a tampered body", () => {
		const body = JSON.stringify({
			event: "payment.captured",
			payload: { payment: { entity: {} } },
		});
		const headers = headersFor(body);
		const tampered = JSON.stringify({
			event: "payment.captured",
			payload: { payment: { entity: { amount: 999_999 } } },
		});

		expect(() => provider.parseWebhook(tampered, headers)).toThrow(
			BadRequestException,
		);
	});

	it("rejects a wrong signature", () => {
		const body = JSON.stringify({
			event: "payment.captured",
			payload: { payment: { entity: {} } },
		});
		expect(() =>
			provider.parseWebhook(
				body,
				headersFor(body, { "x-razorpay-signature": "not-a-real-signature" }),
			),
		).toThrow(BadRequestException);
	});

	it("rejects a missing signature header", () => {
		const body = JSON.stringify({
			event: "payment.captured",
			payload: { payment: { entity: {} } },
		});
		expect(() => provider.parseWebhook(body, {})).toThrow(BadRequestException);
	});

	it("maps a failed-payment event and carries the reason", () => {
		const body = JSON.stringify({
			event: "payment.failed",
			payload: {
				payment: {
					entity: {
						id: "pay_2",
						notes: { referenceId: "donation-2" },
						error_description: "Card declined",
					},
				},
			},
		});

		const event = provider.parseWebhook(body, headersFor(body));
		expect(event.kind).toBe("FAILED");
		expect(event.failureReason).toBe("Card declined");
	});

	it("acknowledges unrelated event types instead of erroring", () => {
		// Razorpay sends more event types than we act on (e.g. payment.authorized
		// when auto-capture is off); treating unknown ones as IGNORED stops it
		// retrying deliveries we don't need.
		const body = JSON.stringify({
			event: "payment.authorized",
			payload: { payment: { entity: { id: "pay_3" } } },
		});

		expect(provider.parseWebhook(body, headersFor(body)).kind).toBe("IGNORED");
	});
});

describe("RazorpayPaymentProvider.createCheckout", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("does not restrict amounts to whole rupees, unlike Dodo's product-cart model", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: "order_1", amount: 12_345, currency: "INR" }),
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await makeProvider().createCheckout({
			referenceId: "donation-1",
			amountMinor: 12_345, // not a multiple of 100 — Dodo would reject this
			currency: "INR",
			organizationName: "Test NGO",
		});

		expect(result).toEqual({
			providerCheckoutId: "order_1",
			amountMinor: 12_345,
			currency: "INR",
			publicKeyId: "rzp_test_key",
		});
		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		const sentBody = JSON.parse(requestInit.body);
		expect(sentBody.amount).toBe(12_345);
	});

	it("throws when the provider rejects the order", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue({ ok: false, status: 400, text: async () => "" }),
		);

		await expect(
			makeProvider().createCheckout({
				referenceId: "donation-2",
				amountMinor: 100_000,
				currency: "INR",
				organizationName: "Test NGO",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
