import { needs } from "@nabhya/db/schema";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
} from "@nestjs/common";
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
import { NeedsService } from "../src/modules/needs/needs.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	createNeed,
	createOrganization,
	createPledge,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("NeedsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: NeedsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		const organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		service = new NeedsService(
			db as never,
			audit,
			organizationsService,
			notifications,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	describe("pledging", () => {
		it("tells the NGO that someone offered to help", async () => {
			// NEW_PLEDGE existed and was never sent.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 10 });
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.pledge(volunteer.id, need.id, { quantity: 2 });

			await vi.waitFor(async () => {
				const sent = await db.query.notifications.findFirst({});
				expect(sent?.type).toBe("NEW_PLEDGE");
			});
			const sent = await db.query.notifications.findFirst({});
			expect(sent?.userId).toBe(owner.id);
			expect(sent?.entityId).toBe(need.id);
		});

		it("requires a quantity when the need specifies one", async () => {
			// This is the bug that made fulfilment permanently read "0 of 100":
			// a pledge with no quantity advances the counter by zero.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });

			await expect(
				service.pledge(volunteer.id, need.id, {}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("allows an open-ended pledge when the need has no quantity", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: null });
			const volunteer = await createUser(db, { role: "volunteer" });

			const pledge = await service.pledge(volunteer.id, need.id, {});
			expect(pledge?.status).toBe("PENDING");
		});

		it("refuses pledges to a closed need", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { status: "CLOSED" });
			const volunteer = await createUser(db, { role: "volunteer" });

			await expect(
				service.pledge(volunteer.id, need.id, { quantity: 5 }),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("refuses a second pledge from the same person", async () => {
			// Backed by need_pledges_need_user_unique - without it a double-tap
			// inserts two PENDING rows and both inflate fulfilledQuantity on accept.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.pledge(volunteer.id, need.id, { quantity: 10 });
			await expect(
				service.pledge(volunteer.id, need.id, { quantity: 10 }),
			).rejects.toBeInstanceOf(ConflictException);

			// The DB is truncated per test, so this is the one need's pledges.
			const rows = await db.query.needPledges.findMany({});
			expect(rows).toHaveLength(1);
		});

		it("hides needs from unverified organizations", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});
			await createNeed(db, org.id);

			const result = await service.listPublic({ page: 1, limit: 20 });
			expect(result.items).toHaveLength(0);
		});
	});

	describe("listing pledges", () => {
		it("filters by status on the server, with a matching total", async () => {
			// The sheet filtered page 1 locally, so pending pledges past the
			// twentieth never appeared under "Pending".
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			for (let i = 0; i < 3; i++) {
				const volunteer = await createUser(db, { role: "volunteer" });
				await createPledge(db, need.id, volunteer.id, {
					status: i === 0 ? "ACCEPTED" : "PENDING",
				});
			}

			const pending = await service.listPledges(owner.id, need.id, {
				page: 1,
				limit: 1,
				status: "PENDING",
			});
			expect(pending.items).toHaveLength(1);
			expect(pending.items[0]?.status).toBe("PENDING");
			expect(pending.meta.total).toBe(2);
		});
	});

	describe("fulfilment accounting", () => {
		it("advances fulfilledQuantity by the pledged amount on acceptance", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id, {
				quantity: 30,
			});

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "ACCEPTED",
			});

			const after = await db.query.needs.findFirst({
				where: eq(needs.id, need.id),
			});
			expect(after?.fulfilledQuantity).toBe(30);
			expect(after?.status).toBe("OPEN");
		});

		it("auto-closes the need once the target is met", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 50 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id, {
				quantity: 50,
			});

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "ACCEPTED",
			});

			const after = await db.query.needs.findFirst({
				where: eq(needs.id, need.id),
			});
			expect(after?.fulfilledQuantity).toBe(50);
			expect(after?.status).toBe("FULFILLED");
		});

		it("reverses the amount when an acceptance is later rejected", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id, {
				quantity: 40,
			});

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "ACCEPTED",
			});
			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "REJECTED",
			});

			const after = await db.query.needs.findFirst({
				where: eq(needs.id, need.id),
			});
			expect(after?.fulfilledQuantity).toBe(0);
		});

		it("keeps a manually CLOSED need closed when a pledge is rejected", async () => {
			// Rejecting a pledge drops fulfilledQuantity below target; that must not
			// resurrect a need the organiser had deliberately closed back to OPEN.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id, {
				quantity: 40,
			});

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "ACCEPTED",
			});
			await db
				.update(needs)
				.set({ status: "CLOSED" })
				.where(eq(needs.id, need.id));

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "REJECTED",
			});

			const after = await db.query.needs.findFirst({
				where: eq(needs.id, need.id),
			});
			expect(after?.fulfilledQuantity).toBe(0);
			expect(after?.status).toBe("CLOSED");
		});

		it("does not double-count when accepted then completed", async () => {
			// ACCEPTED and COMPLETED are both "committed" - moving between them
			// must not add the quantity a second time.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id, { quantity: 100 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id, {
				quantity: 25,
			});

			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "ACCEPTED",
			});
			await service.reviewPledge(owner.id, need.id, pledge.id, {
				status: "COMPLETED",
			});

			const after = await db.query.needs.findFirst({
				where: eq(needs.id, need.id),
			});
			expect(after?.fulfilledQuantity).toBe(25);
		});

		it("stops one organization reviewing another's pledges", async () => {
			const ownerA = await createUser(db, { role: "organisation" });
			const orgA = await createOrganization(db, ownerA.id);
			const need = await createNeed(db, orgA.id);
			const volunteer = await createUser(db, { role: "volunteer" });
			const pledge = await createPledge(db, need.id, volunteer.id);

			const ownerB = await createUser(db, { role: "organisation" });
			await createOrganization(db, ownerB.id);

			await expect(
				service.reviewPledge(ownerB.id, need.id, pledge.id, {
					status: "ACCEPTED",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("deleting", () => {
		it("closes rather than deletes once a pledge is accepted", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const need = await createNeed(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });
			await createPledge(db, need.id, volunteer.id, { status: "ACCEPTED" });

			const result = await service.remove(owner.id, need.id);

			expect(result.deleted).toBe(false);
			expect(result.need?.status).toBe("CLOSED");
		});
	});
});

describe("NeedsService - correlated counts", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: NeedsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		service = new NeedsService(
			db as never,
			audit,
			new OrganizationsService(db as never, audit, null as never),
			new NotificationsService(db as never),
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	it("reports the real number of pledges awaiting review", async () => {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		const need = await createNeed(db, org.id);

		for (let i = 0; i < 2; i++) {
			const volunteer = await createUser(db, { role: "volunteer" });
			await createPledge(db, need.id, volunteer.id, { status: "PENDING" });
		}
		const accepted = await createUser(db, { role: "volunteer" });
		await createPledge(db, need.id, accepted.id, { status: "ACCEPTED" });

		const result = await service.listForMyOrganization(owner.id, {
			page: 1,
			limit: 20,
		});

		expect(result.items[0]?.pendingPledges).toBe(2);
	});
});
