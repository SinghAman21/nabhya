import { events } from "@nabhya/db/schema";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { EventsService } from "../src/modules/events/events.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	authUserFor,
	createApplication,
	createEvent,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("EventsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: EventsService;
	let organizationsService: OrganizationsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());

		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		// UploadsService is only used on the document path, which these tests
		// never reach.
		organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		service = new EventsService(
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

	describe("public feed", () => {
		it("hides events from unverified organizations", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});
			await createEvent(db, org.id, { status: "PUBLISHED" });

			const result = await service.listPublic({
				page: 1,
				limit: 20,
				when: "upcoming",
			});

			expect(result.items).toHaveLength(0);
			// The count must agree with the filter, not just the page.
			expect(result.meta.total).toBe(0);
		});

		it("hides events from suspended organizations", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				status: "SUSPENDED",
			});
			await createEvent(db, org.id, { status: "PUBLISHED" });

			const result = await service.listPublic({
				page: 1,
				limit: 20,
				when: "upcoming",
			});
			expect(result.items).toHaveLength(0);
		});

		it("hides drafts but shows published events", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await createEvent(db, org.id, { status: "DRAFT", title: "Draft" });
			await createEvent(db, org.id, { status: "PUBLISHED", title: "Live" });

			const result = await service.listPublic({
				page: 1,
				limit: 20,
				when: "upcoming",
			});

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.title).toBe("Live");
		});
	});

	describe("applying", () => {
		it("rejects a second application from the same volunteer", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.apply(volunteer.id, event.id, {});

			await expect(
				service.apply(volunteer.id, event.id, {}),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("lets a volunteer re-apply after withdrawing, reusing the row", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.apply(volunteer.id, event.id, {});
			await service.withdraw(volunteer.id, event.id);
			const reapplied = await service.apply(volunteer.id, event.id, {});

			expect(reapplied?.status).toBe("PENDING");

			// Reusing the row is what keeps the unique index satisfied.
			const applications = await db.query.eventApplications.findMany({});
			expect(applications).toHaveLength(1);
		});

		it("refuses applications once the event is full", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { volunteersNeeded: 1 });
			const orgAuth = authUserFor(owner, ["organisation"]);

			const first = await createUser(db, { role: "volunteer" });
			const application = await service.apply(first.id, event.id, {});
			await service.reviewApplication(
				orgAuth.id,
				event.id,
				(application as { id: string }).id,
				{ status: "ACCEPTED" },
			);

			const second = await createUser(db, { role: "volunteer" });
			await expect(
				service.apply(second.id, event.id, {}),
			).rejects.toBeInstanceOf(ConflictException);
		});
	});

	describe("reviewing applications", () => {
		it("increments acceptedCount and refuses to overfill", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { volunteersNeeded: 1 });

			const a = await createUser(db, { role: "volunteer" });
			const b = await createUser(db, { role: "volunteer" });
			const appA = await createApplication(db, event.id, a.id);
			const appB = await createApplication(db, event.id, b.id);

			await service.reviewApplication(owner.id, event.id, appA.id, {
				status: "ACCEPTED",
			});

			const afterFirst = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(afterFirst?.acceptedCount).toBe(1);

			// The capacity re-check happens inside the transaction against a
			// locked row, so the second acceptance must fail rather than overfill.
			await expect(
				service.reviewApplication(owner.id, event.id, appB.id, {
					status: "ACCEPTED",
				}),
			).rejects.toBeInstanceOf(ConflictException);

			const afterSecond = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(afterSecond?.acceptedCount).toBe(1);
		});

		it("decrements acceptedCount when an acceptance is reversed", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { volunteersNeeded: 3 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const application = await createApplication(db, event.id, volunteer.id);

			await service.reviewApplication(owner.id, event.id, application.id, {
				status: "ACCEPTED",
			});
			await service.reviewApplication(owner.id, event.id, application.id, {
				status: "REJECTED",
			});

			const after = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(after?.acceptedCount).toBe(0);
		});

		it("frees the seat when an accepted volunteer withdraws", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { volunteersNeeded: 2 });
			const volunteer = await createUser(db, { role: "volunteer" });
			const application = await createApplication(db, event.id, volunteer.id);

			await service.reviewApplication(owner.id, event.id, application.id, {
				status: "ACCEPTED",
			});
			await service.withdraw(volunteer.id, event.id);

			const after = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(after?.acceptedCount).toBe(0);
		});

		it("stops one organization reviewing another's applicants", async () => {
			const ownerA = await createUser(db, { role: "organisation" });
			const orgA = await createOrganization(db, ownerA.id);
			const event = await createEvent(db, orgA.id);
			const volunteer = await createUser(db, { role: "volunteer" });
			const application = await createApplication(db, event.id, volunteer.id);

			const ownerB = await createUser(db, { role: "organisation" });
			await createOrganization(db, ownerB.id);

			await expect(
				service.reviewApplication(ownerB.id, event.id, application.id, {
					status: "ACCEPTED",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("publishing", () => {
		it("blocks an unverified organization from publishing", async () => {
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			await expect(
				service.create(owner.id, {
					title: "Beach cleanup",
					description: "A description long enough to satisfy validation.",
					city: "Mumbai",
					state: "Maharashtra",
					startAt: new Date(Date.now() + 86_400_000),
					endAt: new Date(Date.now() + 90_000_000),
					volunteersNeeded: 5,
					status: "PUBLISHED",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("allows an unverified organization to save a draft", async () => {
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			const event = await service.create(owner.id, {
				title: "Beach cleanup",
				description: "A description long enough to satisfy validation.",
				city: "Mumbai",
				state: "Maharashtra",
				startAt: new Date(Date.now() + 86_400_000),
				endAt: new Date(Date.now() + 90_000_000),
				volunteersNeeded: 5,
				status: "DRAFT",
			});

			expect(event.status).toBe("DRAFT");
		});
	});

	describe("deleting", () => {
		it("cancels rather than deletes once volunteers are accepted", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });
			const application = await createApplication(db, event.id, volunteer.id);

			await service.reviewApplication(owner.id, event.id, application.id, {
				status: "ACCEPTED",
			});

			const result = await service.remove(owner.id, event.id);

			expect(result.deleted).toBe(false);
			expect(result.event?.status).toBe("CANCELLED");

			const still = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(still).toBeDefined();
		});

		it("deletes outright when nobody has been accepted", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);

			const result = await service.remove(owner.id, event.id);

			expect(result.deleted).toBe(true);
			const gone = await db.query.events.findFirst({
				where: eq(events.id, event.id),
			});
			expect(gone).toBeUndefined();
		});
	});
});

describe("EventsService — correlated counts", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: EventsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		service = new EventsService(
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

	it("reports the real number of applicants awaiting review", async () => {
		// This drives the "N awaiting review" badge on the NGO events screen.
		// A correlated subquery with unqualified columns silently resolves to the
		// wrong table and returns 0 forever, which reads as "nothing to do".
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		const event = await createEvent(db, org.id);

		for (let i = 0; i < 3; i++) {
			const volunteer = await createUser(db, { role: "volunteer" });
			await createApplication(db, event.id, volunteer.id, {
				status: "PENDING",
			});
		}
		const accepted = await createUser(db, { role: "volunteer" });
		await createApplication(db, event.id, accepted.id, { status: "ACCEPTED" });

		const result = await service.listForMyOrganization(owner.id, {
			page: 1,
			limit: 20,
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.pendingApplications).toBe(3);
	});
});
