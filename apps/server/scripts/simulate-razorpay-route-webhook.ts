/**
 * Fires a correctly-signed Razorpay Route webhook at the local server for:
 *
 * 1. Transfer lifecycle:
 *    pnpm --filter server exec tsx scripts/simulate-razorpay-route-webhook.ts transfer <donationId> [processed|failed]
 *
 * 2. Linked Account lifecycle:
 *    pnpm --filter server exec tsx scripts/simulate-razorpay-route-webhook.ts account <organizationId|accountId> [activated|needs_clarification|rejected|suspended]
 *
 * Lets you test end-to-end direct settlement state changes locally without
 * needing a webhook tunnel or a live Razorpay merchant test account.
 */
import { createHmac, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env" });

async function main() {
	const [command, targetId, subType] = process.argv.slice(2);

	if (
		!command ||
		!targetId ||
		(command !== "transfer" && command !== "account")
	) {
		console.log(`
Usage:
  # Simulate Route direct-settlement transfer event:
  pnpm --filter server exec tsx scripts/simulate-razorpay-route-webhook.ts transfer <donationId> [processed|failed]

  # Simulate Linked Account KYC status update event:
  pnpm --filter server exec tsx scripts/simulate-razorpay-route-webhook.ts account <orgId|accountId> [activated|needs_clarification|rejected|suspended]
`);
		process.exit(1);
	}

	const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "test_secret";
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();

	let body: string;
	let eventName: string;

	if (command === "transfer") {
		const action = subType === "failed" ? "failed" : "processed";
		eventName = `transfer.${action}`;

		const { rows } = await client.query(
			"select amount_minor, transfer_amount_minor, destination_account_id, transfer_status from donations where id = $1",
			[targetId],
		);

		const donation = rows[0];
		if (!donation) {
			console.error(`No donation found with id: ${targetId}`);
			await client.end();
			process.exit(1);
		}

		const transferId = `trf_sim_${randomUUID().slice(0, 12)}`;
		const recipientAccount =
			donation.destination_account_id ?? `acc_sim_${randomUUID().slice(0, 8)}`;
		const amount = donation.transfer_amount_minor ?? donation.amount_minor;

		console.log(
			`Simulating ${eventName} for donation ${targetId} (Transfer ID: ${transferId}, Amount: ${amount} paise)`,
		);

		body = JSON.stringify({
			entity: "event",
			event: eventName,
			payload: {
				transfer: {
					entity: {
						id: transferId,
						recipient: recipientAccount,
						amount: amount,
						currency: "INR",
						status: action,
						notes: { referenceId: targetId },
						...(action === "failed"
							? {
									error: {
										description:
											"Beneficiary bank account unroutable (Simulated)",
									},
								}
							: {}),
					},
				},
			},
		});
	} else {
		// Linked Account Event
		const action = subType || "activated";
		eventName = `account.${action}`;

		// Check if target is an organization ID or an account ID
		const { rows } = await client.query(
			"select razorpay_account_id from organization_payout_profiles where organization_id = $1 or razorpay_account_id = $1",
			[targetId],
		);

		const accountId = rows[0]?.razorpay_account_id ?? targetId;
		console.log(`Simulating ${eventName} for account ${accountId}`);

		body = JSON.stringify({
			entity: "event",
			event: eventName,
			account_id: accountId,
			payload: {
				account: {
					entity: {
						id: accountId,
						status: action,
						...(action === "needs_clarification" || action === "rejected"
							? { status_reason: "Document signatory PAN mismatch (Simulated)" }
							: {}),
					},
				},
			},
		});
	}

	await client.end();

	const signature = createHmac("sha256", webhookSecret)
		.update(body)
		.digest("hex");

	const targetUrl =
		process.env.API_URL ?? "http://localhost:3000/api/donations/webhook";
	console.log(`POSTing to ${targetUrl} with X-Razorpay-Signature...`);

	try {
		const res = await fetch(targetUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-razorpay-signature": signature,
			},
			body,
		});

		const text = await res.text();
		console.log(`Response [${res.status}]:`, text);
	} catch (err) {
		console.error(
			"Failed to deliver webhook to server:",
			err instanceof Error ? err.message : String(err),
		);
		console.log(
			"(Make sure the server is running on port 3000 via 'pnpm dev')",
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
