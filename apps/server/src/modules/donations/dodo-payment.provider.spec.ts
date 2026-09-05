import { createHmac } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DodoPaymentProvider } from "./dodo-payment.provider";

const SECRET_BASE64 = Buffer.from("test-webhook-secret").toString("base64");

function makeProvider() {
	return new DodoPaymentProvider({
		apiKey: "test-key",
		webhookSecret: `whsec_${SECRET_BASE64}`,
		productId: "prod_donation",
		mode: "test",
	});
}

/** Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`, base64. */
function sign(id: string, timestamp: string, body: string) {
	return createHmac("sha256", Buffer.from(SECRET_BASE64, "base64"))
		.update(`${id}.${timestamp}.${body}`)
		.digest("base64");
}

function headersFor(body: string, overrides: Record<string, string> = {}) {
	const id = "msg_123";
	const timestamp = String(Math.floor(Date.now() / 1000));
	return {
		"webhook-id": id,
		"webhook-timestamp": timestamp,
		"webhook-signature": `v1,${sign(id, timestamp, body)}`,
		...overrides,
	};
}

describe("DodoPaymentProvider.parseWebhook", () => {
	const provider = makeProvider();

	it("accepts a correctly signed success event", () => {
		const body = JSON.stringify({
			type: "payment.succeeded",
			data: {
				payment_id: "pay_1",
				total_amount: 100_000,
				metadata: { referenceId: "donation-1" },
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
		const body = JSON.stringify({ type: "payment.succeeded", data: {} });
		const headers = headersFor(body);
		const tampered = JSON.stringify({
			type: "payment.succeeded",
			data: { total_amount: 999_999 },
		});

		expect(() => provider.parseWebhook(tampered, headers)).toThrow(
			BadRequestException,
		);
	});

	it("rejects a wrong signature", () => {
		const body = JSON.stringify({ type: "payment.succeeded", data: {} });
		expect(() =>
			provider.parseWebhook(
				body,
				headersFor(body, { "webhook-signature": "v1,not-a-real-signature" }),
			),
		).toThrow(BadRequestException);
	});

	it("rejects a stale timestamp, blunting replay attacks", () => {
		const body = JSON.stringify({ type: "payment.succeeded", data: {} });
		const id = "msg_old";
		const old = String(Math.floor(Date.now() / 1000) - 3600);

		expect(() =>
			provider.parseWebhook(body, {
				"webhook-id": id,
				"webhook-timestamp": old,
				"webhook-signature": `v1,${sign(id, old, body)}`,
			}),
		).toThrow(BadRequestException);
	});

	it("rejects missing signature headers", () => {
		const body = JSON.stringify({ type: "payment.succeeded", data: {} });
		expect(() => provider.parseWebhook(body, {})).toThrow(BadRequestException);
	});

	it("maps a failure event and carries the reason", () => {
		const body = JSON.stringify({
			type: "payment.failed",
			data: {
				payment_id: "pay_2",
				metadata: { referenceId: "donation-2" },
				error_message: "Card declined",
			},
		});

		const event = provider.parseWebhook(body, headersFor(body));
		expect(event.kind).toBe("FAILED");
		expect(event.failureReason).toBe("Card declined");
	});

	it("acknowledges unrelated event types instead of erroring", () => {
		// Dodo sends many event types; treating unknown ones as IGNORED stops it
		// retrying deliveries we simply do not act on.
		const body = JSON.stringify({
			type: "customer.updated",
			data: { payment_id: "pay_3" },
		});

		expect(provider.parseWebhook(body, headersFor(body)).kind).toBe("IGNORED");
	});
});

describe("DodoPaymentProvider.createCheckout", () => {
	it("refuses amounts that are not whole rupees", async () => {
		// Dodo is product-based: donations are N units of a ₹1 product, so
		// anything finer than a rupee cannot be represented.
		await expect(
			makeProvider().createCheckout({
				referenceId: "donation-1",
				amountMinor: 150,
				currency: "INR",
				organizationName: "Test NGO",
				returnUrl: "https://example.com/return",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
