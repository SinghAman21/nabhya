import { donations } from "@nabhya/db/schema";
import {
	donationCheckoutResponseSchema,
	donationReceiptResponseSchema,
	exportFileResponseSchema,
	orgDonationExportSchema,
	orgDonationQuerySchema,
	signedUrlResponseSchema,
} from "@nabhya/shared";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { AuditService } from "../src/common/audit";
import type {
	DonationReceiptEmailInput,
	MailService,
} from "../src/common/mail";
import { StubStorageProvider } from "../src/common/storage";
import { DonationsService } from "../src/modules/donations/donations.service";
import { StubPaymentProvider } from "../src/modules/donations/stub-payment.provider";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("DonationsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: DonationsService;
	let storage: StubStorageProvider;
	const sentReceipts: DonationReceiptEmailInput[] = [];
	const mail = {
		sendTeamInvite: async () => {},
		sendDonationReceipt: async (input: DonationReceiptEmailInput) => {
			sentReceipts.push(input);
		},
	} as unknown as MailService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		const organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		storage = new StubStorageProvider();
		service = new DonationsService(
			db as never,
			audit,
			new StubPaymentProvider(),
			notifications,
			organizationsService,
			storage,
			mail,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
		sentReceipts.length = 0;
	});

	/** Drives a checkout to COMPLETED the only way production can: a webhook. */
	async function settle(donationId: string, amountMinor: number) {
		await service.handleWebhook(
			JSON.stringify({
				event: "payment.captured",
				payload: {
					payment: {
						entity: {
							id: `pay_${donationId.slice(0, 8)}`,
							amount: amountMinor,
							notes: { referenceId: donationId },
						},
					},
				},
			}),
			{},
		);
	}

	describe("receipts", () => {
		it("emails the receipt PDF to a guest donor once the payment lands", async () => {
			const org = await verifiedOrg();
			const checkout = await service.createCheckout(
				{
					organizationId: org.id,
					amountMinor: 150_000,
					isAnonymous: false,
					donorName: "Guest Giver",
					donorEmail: "guest@example.com",
				},
				null,
			);

			await settle(checkout.donationId, 150_000);

			await vi.waitFor(() => expect(sentReceipts).toHaveLength(1));
			const sent = sentReceipts[0];
			expect(sent?.to).toBe("guest@example.com");
			expect(sent?.amount).toBe("INR 1,500.00");
			expect(sent?.receiptNumber).toMatch(/^NBH-/);
			// A real PDF, not an empty buffer.
			expect(
				Buffer.from(sent?.pdf ?? [])
					.subarray(0, 5)
					.toString(),
			).toBe("%PDF-");
		});

		it("does not email a receipt for a failed payment", async () => {
			const org = await verifiedOrg();
			const donor = await createUser(db, { role: "volunteer" });
			const checkout = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: donor.id, email: donor.email, name: donor.fullName },
			);
			await service.handleWebhook(
				JSON.stringify({
					event: "payment.failed",
					payload: {
						payment: {
							entity: { notes: { referenceId: checkout.donationId } },
						},
					},
				}),
				{},
			);

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(sentReceipts).toHaveLength(0);
		});

		it("hands the donor a signed link to the stored PDF", async () => {
			const org = await verifiedOrg();
			const donor = await createUser(db, { role: "volunteer" });
			const checkout = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: donor.id, email: donor.email, name: donor.fullName },
			);
			await settle(checkout.donationId, 100_000);

			const wire = (value: unknown) => JSON.parse(JSON.stringify(value));
			expect(
				donationCheckoutResponseSchema.safeParse(wire(checkout)).error,
			).toBeUndefined();
			expect(
				donationReceiptResponseSchema.safeParse(
					wire(await service.getReceipt(donor.id, checkout.donationId)),
				).error,
			).toBeUndefined();

			const pdfLink = await service.getReceiptPdfUrl(
				donor.id,
				checkout.donationId,
			);
			expect(signedUrlResponseSchema.safeParse(pdfLink).error).toBeUndefined();
			const { url } = pdfLink;
			expect(decodeURIComponent(url)).toContain(
				`receipts/${checkout.donationId}/`,
			);
		});

		it("refuses the receipt to anyone but the donor", async () => {
			const org = await verifiedOrg();
			const donor = await createUser(db, { role: "volunteer" });
			const stranger = await createUser(db, { role: "volunteer" });
			const checkout = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: donor.id, email: donor.email, name: donor.fullName },
			);
			await settle(checkout.donationId, 100_000);

			await expect(
				service.getReceiptPdfUrl(stranger.id, checkout.donationId),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("has no receipt while the payment is pending", async () => {
			const org = await verifiedOrg();
			const donor = await createUser(db, { role: "volunteer" });
			const checkout = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: donor.id, email: donor.email, name: donor.fullName },
			);

			await expect(
				service.getReceiptPdfUrl(donor.id, checkout.donationId),
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe("the NGO's CSV export", () => {
		it("exports settled donations, hiding anonymous donors and every email", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const named = await createUser(db, {
				role: "volunteer",
				fullName: "Named Donor",
			});
			const hidden = await createUser(db, {
				role: "volunteer",
				fullName: "Secret Donor",
			});

			const a = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: named.id, email: named.email, name: named.fullName },
			);
			const b = await service.createCheckout(
				{ organizationId: org.id, amountMinor: 50_000, isAnonymous: true },
				{ id: hidden.id, email: hidden.email, name: hidden.fullName },
			);
			// Left pending: not in a default export.
			await service.createCheckout(
				{ organizationId: org.id, amountMinor: 70_000, isAnonymous: false },
				{ id: named.id, email: named.email, name: named.fullName },
			);
			await settle(a.donationId, 100_000);
			await settle(b.donationId, 50_000);

			const put = vi.spyOn(storage, "putObject");
			const file = await service.exportForMyOrganization(
				owner.id,
				orgDonationExportSchema.parse({}),
			);
			expect(file.rowCount).toBe(2);
			expect(file.truncated).toBe(false);
			expect(exportFileResponseSchema.safeParse(file).error).toBeUndefined();

			const stored = put.mock.calls.find(([input]) =>
				input.key.includes("/exports/"),
			)?.[0];
			put.mockRestore();
			expect(stored?.contentType).toBe("text/csv");
			const csv = new TextDecoder().decode(stored?.body);
			expect(csv).toContain("Named Donor");
			expect(csv).toContain('"Anonymous"');
			expect(csv).not.toContain("Secret Donor");
			expect(csv).not.toContain(named.email);
		});
	});

	async function verifiedOrg() {
		const owner = await createUser(db, { role: "organisation" });
		return createOrganization(db, owner.id);
	}

	it("creates the donation as PENDING, never as paid", async () => {
		const org = await verifiedOrg();
		const donor = await createUser(db, { role: "volunteer" });

		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);

		const row = await db.query.donations.findFirst({
			where: eq(donations.id, checkout.donationId),
		});
		expect(row?.status).toBe("PENDING");
		expect(row?.amountMinor).toBe(100_000);
	});

	it("refuses donations to an unverified organization", async () => {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id, {
			verificationStatus: "PENDING",
		});
		const donor = await createUser(db, { role: "volunteer" });

		await expect(
			service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				{ id: donor.id, email: donor.email, name: donor.fullName },
			),
		).rejects.toThrow();
	});

	it("requires an email from a guest donor", async () => {
		const org = await verifiedOrg();

		await expect(
			service.createCheckout(
				{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
				null,
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("completes only through a webhook, and issues a receipt", async () => {
		const org = await verifiedOrg();
		const donor = await createUser(db, { role: "volunteer" });

		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 250_000, isAnonymous: false },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);

		await service.handleWebhook(
			JSON.stringify({
				event: "payment.captured",
				payload: {
					payment: {
						entity: {
							id: "pay_test_1",
							amount: 250_000,
							notes: { referenceId: checkout.donationId },
						},
					},
				},
			}),
			{},
		);

		const row = await db.query.donations.findFirst({
			where: eq(donations.id, checkout.donationId),
		});
		expect(row?.status).toBe("COMPLETED");
		expect(row?.receiptNumber).toMatch(/^NBH-/);
		expect(row?.completedAt).toBeTruthy();
	});

	it("ignores a replayed webhook rather than double-counting", async () => {
		const org = await verifiedOrg();
		const donor = await createUser(db, { role: "volunteer" });
		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);

		const payload = JSON.stringify({
			event: "payment.captured",
			payload: {
				payment: {
					entity: {
						id: "pay_test_2",
						amount: 100_000,
						notes: { referenceId: checkout.donationId },
					},
				},
			},
		});

		await service.handleWebhook(payload, {});
		const second = await service.handleWebhook(payload, {});

		expect(second).toEqual({ handled: true, duplicate: true });

		const stats = await service.getStats(org.id);
		expect(stats.totalMinor).toBe(100_000);
		expect(stats.completedCount).toBe(1);
	});

	it("rejects a webhook whose amount disagrees with the record", async () => {
		const org = await verifiedOrg();
		const donor = await createUser(db, { role: "volunteer" });
		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);

		await expect(
			service.handleWebhook(
				JSON.stringify({
					event: "payment.captured",
					payload: {
						payment: {
							entity: {
								id: "pay_test_3",
								amount: 1_000_000, // ten times the real amount
								notes: { referenceId: checkout.donationId },
							},
						},
					},
				}),
				{},
			),
		).rejects.toBeInstanceOf(BadRequestException);

		const row = await db.query.donations.findFirst({
			where: eq(donations.id, checkout.donationId),
		});
		expect(row?.status).toBe("PENDING");
	});

	it("hides the donor name from the organization when anonymous", async () => {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		const donor = await createUser(db, {
			role: "volunteer",
			fullName: "Aditi Sharma",
		});

		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 100_000, isAnonymous: true },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);
		await service.handleWebhook(
			JSON.stringify({
				event: "payment.captured",
				payload: {
					payment: {
						entity: {
							id: "pay_test_4",
							amount: 100_000,
							notes: { referenceId: checkout.donationId },
						},
					},
				},
			}),
			{},
		);

		const listed = await service.listForMyOrganization(
			owner.id,
			orgDonationQuerySchema.parse({ page: 1, limit: 20 }),
		);

		expect(listed.items).toHaveLength(1);
		// Anonymity is applied in SQL, so it cannot be bypassed by the client.
		expect(listed.items[0]?.donorName).toBeNull();
	});

	it("excludes failed donations from the totals", async () => {
		const org = await verifiedOrg();
		const donor = await createUser(db, { role: "volunteer" });
		const checkout = await service.createCheckout(
			{ organizationId: org.id, amountMinor: 100_000, isAnonymous: false },
			{ id: donor.id, email: donor.email, name: donor.fullName },
		);

		await service.handleWebhook(
			JSON.stringify({
				event: "payment.failed",
				payload: {
					payment: {
						entity: {
							id: "pay_test_5",
							notes: { referenceId: checkout.donationId },
						},
					},
				},
			}),
			{},
		);

		const stats = await service.getStats(org.id);
		expect(stats.totalMinor).toBe(0);
		expect(stats.completedCount).toBe(0);
	});

	/**
	 * Sorting what an NGO has received. Rows are inserted as settled directly:
	 * the webhook path is covered above, and these are about the ORDER BY.
	 */
	describe("sorting the organisation's list", () => {
		async function received(
			organizationId: string,
			gifts: Array<{
				amountMinor: number;
				donorName?: string;
				isAnonymous?: boolean;
				createdAt?: Date;
			}>,
		) {
			for (const gift of gifts) {
				await db.insert(donations).values({
					organizationId,
					amountMinor: gift.amountMinor,
					status: "COMPLETED",
					donorName: gift.donorName ?? null,
					isAnonymous: gift.isAnonymous ?? false,
					...(gift.createdAt ? { createdAt: gift.createdAt } : {}),
				});
			}
		}

		const list = (userId: string, input: Record<string, unknown>) =>
			service.listForMyOrganization(
				userId,
				orgDonationQuerySchema.parse(input),
			);

		it("keeps the old order (newest first) when no sort is sent", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const hour = 3_600_000;
			await received(org.id, [
				{ amountMinor: 1_000, createdAt: new Date(Date.now() - 2 * hour) },
				{ amountMinor: 2_000, createdAt: new Date(Date.now() - hour) },
			]);

			const result = await list(owner.id, {});
			expect(result.items.map((d) => d.amountMinor)).toEqual([2_000, 1_000]);
		});

		it("orders by amount in both directions", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await received(org.id, [
				{ amountMinor: 5_000 },
				{ amountMinor: 1_000 },
				{ amountMinor: 9_000 },
			]);

			const up = await list(owner.id, { sort: "amount", dir: "asc" });
			expect(up.items.map((d) => d.amountMinor)).toEqual([1_000, 5_000, 9_000]);
			const down = await list(owner.id, { sort: "amount", dir: "desc" });
			expect(down.items.map((d) => d.amountMinor)).toEqual([
				9_000, 5_000, 1_000,
			]);
		});

		it("sorts an anonymous gift by the name shown, not the one hidden", async () => {
			// Ordered by the raw column, "Aarav" would sort first and its row's
			// position would give away the name the response blanks out.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await received(org.id, [
				{ amountMinor: 1_000, donorName: "Meera" },
				{ amountMinor: 2_000, donorName: "Aarav", isAnonymous: true },
				{ amountMinor: 3_000, donorName: "Zoya" },
			]);

			const result = await list(owner.id, { sort: "donor", dir: "asc" });
			// Postgres puts NULLs last ascending.
			expect(result.items.map((d) => d.donorName)).toEqual([
				"Meera",
				"Zoya",
				null,
			]);
		});

		it("pages deterministically when every row shares the sort key", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await received(
				org.id,
				Array.from({ length: 6 }, () => ({ amountMinor: 1_000 })),
			);

			const page = (n: number) =>
				list(owner.id, { sort: "amount", dir: "asc", page: n, limit: 3 });
			const ids = [...(await page(1)).items, ...(await page(2)).items].map(
				(d) => d.id,
			);
			expect(new Set(ids).size).toBe(6);
		});
	});
});
