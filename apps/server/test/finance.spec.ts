import { donations, financialReports } from "@nabhya/db/schema";
import {
	adminDonationFilterSchema,
	adminDonationLedgerResponseSchema,
	adminDonationQuerySchema,
	adminFinancialReportQuerySchema,
	exportFileResponseSchema,
	paginatedSchema,
} from "@nabhya/shared";
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
import { StubStorageProvider } from "../src/common/storage";
import { FinanceService } from "../src/modules/admin/finance.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("FinanceService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: FinanceService;
	let storage: StubStorageProvider;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		storage = new StubStorageProvider();
		service = new FinanceService(
			db as never,
			new AuditService(db as never),
			storage,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	async function ledger() {
		const ownerA = await createUser(db, { role: "organisation" });
		const ownerB = await createUser(db, { role: "organisation" });
		const orgA = await createOrganization(db, ownerA.id, {
			name: "Asha Trust",
		});
		const orgB = await createOrganization(db, ownerB.id, {
			name: "Bodhi Seva",
		});
		const donor = await createUser(db, {
			role: "volunteer",
			fullName: "Real Name",
		});

		await db.insert(donations).values([
			{
				organizationId: orgA.id,
				donorUserId: donor.id,
				donorName: "Real Name",
				donorEmail: donor.email,
				amountMinor: 100_000,
				status: "COMPLETED",
				isAnonymous: true,
				receiptNumber: "NBH-2610-AAAAAA",
				createdAt: new Date("2026-10-01T06:00:00Z"),
			},
			{
				organizationId: orgA.id,
				donorName: "Guest",
				donorEmail: "guest@example.com",
				amountMinor: 20_000,
				status: "PENDING",
				createdAt: new Date("2026-10-05T06:00:00Z"),
			},
			{
				organizationId: orgB.id,
				donorName: '=HYPERLINK("x")',
				donorEmail: "formula@example.com",
				amountMinor: 30_000,
				status: "FAILED",
				createdAt: new Date("2026-10-10T06:00:00Z"),
			},
			{
				organizationId: orgB.id,
				donorEmail: "refund@example.com",
				amountMinor: 40_000,
				status: "REFUNDED",
				createdAt: new Date("2026-10-12T06:00:00Z"),
			},
		]);

		return { orgA, orgB, donor };
	}

	it("lists every status by default, with totals over the whole filter", async () => {
		await ledger();

		const page = await service.listDonations(
			adminDonationQuerySchema.parse({ limit: 2 }),
		);

		expect(page.meta.total).toBe(4);
		// The ledger's runtime contract, after the JSON trip the client sees.
		expect(
			adminDonationLedgerResponseSchema.safeParse(
				JSON.parse(JSON.stringify(page)),
			).error,
		).toBeUndefined();
		expect(page.items).toHaveLength(2);
		// Totals are not just the visible page.
		expect(page.summary).toEqual({
			completedMinor: 100_000,
			completedCount: 1,
			pendingCount: 1,
			failedCount: 1,
			refundedMinor: 40_000,
			refundedCount: 1,
			donorCount: 4,
		});
	});

	it("shows the superadmin the real donor behind an anonymous gift", async () => {
		await ledger();
		const page = await service.listDonations(
			adminDonationQuerySchema.parse({ status: "COMPLETED" }),
		);
		expect(page.items[0]?.isAnonymous).toBe(true);
		expect(page.items[0]?.donorName).toBe("Real Name");
	});

	it("filters by NGO, IST date range and search", async () => {
		const { orgB } = await ledger();

		const byOrg = await service.listDonations(
			adminDonationQuerySchema.parse({ organizationId: orgB.id }),
		);
		expect(byOrg.items).toHaveLength(2);

		// 1-5 October inclusive, in India's calendar.
		const byDate = await service.listDonations(
			adminDonationQuerySchema.parse({ from: "2026-10-01", to: "2026-10-05" }),
		);
		expect(byDate.items).toHaveLength(2);

		const bySearch = await service.listDonations(
			adminDonationQuerySchema.parse({ search: "AAAAAA" }),
		);
		expect(bySearch.items).toHaveLength(1);
	});

	it("rejects a date range that ends before it starts", () => {
		expect(
			adminDonationQuerySchema.safeParse({
				from: "2026-10-05",
				to: "2026-10-01",
			}).success,
		).toBe(false);
	});

	it("exports the filtered ledger as guarded CSV, and audits it", async () => {
		await ledger();
		const admin = await createUser(db, { role: "superadmin" });
		const put = vi.spyOn(storage, "putObject");

		const file = await service.exportDonations(
			admin.id,
			adminDonationFilterSchema.parse({}),
		);

		expect(file.rowCount).toBe(4);
		expect(file.truncated).toBe(false);
		expect(file.fileName).toMatch(/^nabhya-donations-.*\.csv$/);
		expect(exportFileResponseSchema.safeParse(file).error).toBeUndefined();

		const stored = put.mock.calls[0]?.[0];
		put.mockRestore();
		const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
			stored?.body,
		);
		expect(csv.startsWith("﻿")).toBe(true);
		// A donor-typed formula is defused, not executed by a spreadsheet.
		expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
		expect(csv).toContain('"1000"');

		await vi.waitFor(async () => {
			const logs = await db.query.auditLogs.findMany({});
			expect(logs.some((log) => log.action === "DONATIONS_EXPORTED")).toBe(
				true,
			);
		});
	});

	it("lists financial reports across NGOs, newest year first", async () => {
		const { orgA, orgB } = await ledger();
		await db.insert(financialReports).values([
			{
				organizationId: orgA.id,
				title: "Annual report",
				financialYear: 2024,
				documentKey: "feed_media/financial-reports/a/2024.pdf",
			},
			{
				organizationId: orgB.id,
				type: "AUDITED_STATEMENT",
				title: "Audit",
				financialYear: 2025,
				documentKey: "feed_media/financial-reports/b/2025.pdf",
			},
		]);

		const all = await service.listFinancialReports(
			adminFinancialReportQuerySchema.parse({}),
		);
		expect(all.items.map((row) => row.financialYear)).toEqual([2025, 2024]);
		expect(
			paginatedSchema().safeParse(JSON.parse(JSON.stringify(all))).error,
		).toBeUndefined();
		expect(all.items[0]?.organization.organizationName).toBe("Bodhi Seva");

		const search = await service.listFinancialReports(
			adminFinancialReportQuerySchema.parse({ search: "asha" }),
		);
		expect(search.items).toHaveLength(1);
	});
});
