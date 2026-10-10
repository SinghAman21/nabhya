import { donations } from "@nabhya/db/schema";
import { orgDonationQuerySchema } from "@nabhya/shared";
import { BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
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

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		const organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		service = new DonationsService(
			db as never,
			audit,
			new StubPaymentProvider(),
			notifications,
			organizationsService,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
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
