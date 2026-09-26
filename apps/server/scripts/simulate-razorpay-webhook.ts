/**
 * Fires a correctly-signed Razorpay `payment.captured` webhook at the local
 * server for a given donation id - lets you flip a donation PENDING ->
 * COMPLETED without needing a tunnel or a real Razorpay round-trip while
 * iterating on the frontend.
 *
 * Looks the donation's amount up from the database so the amount-match guard
 * in DonationsService never rejects it.
 *
 * Usage:
 *   pnpm --filter server exec tsx scripts/simulate-razorpay-webhook.ts <donationId> [event]
 *
 * `event` defaults to "payment.captured". Pass "payment.failed" to simulate a
 * decline instead.
 */
import { createHmac, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";

// Matches how the server itself loads env (packages/env/src/server.ts) -
// .env, not .env.local.
config({ path: ".env" });

async function main() {
	const [donationId, event = "payment.captured"] = process.argv.slice(2);
	if (!donationId) {
		console.error(
			"Usage: tsx scripts/simulate-razorpay-webhook.ts <donationId> [event]",
		);
		process.exit(1);
	}

	const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
	if (!webhookSecret) {
		console.error(
			"RAZORPAY_WEBHOOK_SECRET is not set - check apps/server/.env",
		);
		process.exit(1);
	}

	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	const { rows } = await client.query(
		"select amount_minor, status from donations where id = $1",
		[donationId],
	);
	await client.end();

	const donation = rows[0];
	if (!donation) {
		console.error(`No donation found with id ${donationId}`);
		process.exit(1);
	}
	if (donation.status !== "PENDING") {
		console.warn(
			`Donation is already ${donation.status} - the webhook's PENDING-only guard will no-op this.`,
		);
	}

	const body = JSON.stringify({
		event,
		payload: {
			payment: {
				entity: {
					id: `pay_sim_${randomUUID().slice(0, 12)}`,
					amount: donation.amount_minor,
					notes: { referenceId: donationId },
					...(event === "payment.failed"
						? { error_description: "Simulated decline for local testing" }
						: {}),
				},
			},
		},
	});

	const signature = createHmac("sha256", webhookSecret)
		.update(body)
		.digest("hex");

	const res = await fetch("http://localhost:3000/api/donations/webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-razorpay-signature": signature,
		},
		body,
	});

	console.log(res.status, await res.text());
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
