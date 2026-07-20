import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ImpactService } from "../src/modules/publishing/impact.service";
import {
	createApplication,
	createEvent,
	createNeed,
	createOrganization,
	createPledge,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

const HOURS = 3_600_000;

describe("ImpactService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: ImpactService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new ImpactService(db as never);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	/** Event of an exact duration, so hour arithmetic is checkable. */
	async function eventOfHours(organizationId: string, hours: number) {
		const startAt = new Date(Date.now() - 30 * 24 * HOURS);
		return createEvent(db, organizationId, {
			startAt,
			endAt: new Date(startAt.getTime() + hours * HOURS),
		});
	}

	describe("volunteer impact", () => {
		it("returns zeroes for someone who has done nothing", async () => {
			const volunteer = await createUser(db, { role: "volunteer" });
			const impact = await service.getVolunteerImpact(volunteer.id);

			expect(impact.eventsAttended).toBe(0);
			expect(impact.hoursContributed).toBe(0);
			// Must be 0 rather than NaN — this is divided by application count.
			expect(impact.acceptanceRate).toBe(0);
			expect(impact.firstVolunteeredAt).toBeNull();
		});

		it("sums hours only from events actually attended", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			const attended = await eventOfHours(org.id, 4);
			const acceptedButAbsent = await eventOfHours(org.id, 100);

			await createApplication(db, attended.id, volunteer.id, {
				status: "ACCEPTED",
				attendedAt: new Date(),
			});
			await createApplication(db, acceptedButAbsent.id, volunteer.id, {
				status: "ACCEPTED",
				attendedAt: null,
			});

			const impact = await service.getVolunteerImpact(volunteer.id);

			// The 100-hour event must not count: accepted is not attended.
			expect(impact.hoursContributed).toBe(4);
			expect(impact.eventsAttended).toBe(1);
		});

		it("counts distinct organizations, not events", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			for (const hours of [2, 3]) {
				const event = await eventOfHours(org.id, hours);
				await createApplication(db, event.id, volunteer.id, {
					status: "ACCEPTED",
					attendedAt: new Date(),
				});
			}

			const impact = await service.getVolunteerImpact(volunteer.id);
			expect(impact.eventsAttended).toBe(2);
			expect(impact.organizationsHelped).toBe(1);
			expect(impact.hoursContributed).toBe(5);
		});

		it("computes acceptance rate over all applications", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			const a = await eventOfHours(org.id, 1);
			const b = await eventOfHours(org.id, 1);
			const c = await eventOfHours(org.id, 1);
			const d = await eventOfHours(org.id, 1);

			await createApplication(db, a.id, volunteer.id, { status: "ACCEPTED" });
			await createApplication(db, b.id, volunteer.id, { status: "REJECTED" });
			await createApplication(db, c.id, volunteer.id, { status: "PENDING" });
			await createApplication(db, d.id, volunteer.id, { status: "REJECTED" });

			const impact = await service.getVolunteerImpact(volunteer.id);
			expect(impact.applicationsSubmitted).toBe(4);
			expect(impact.acceptanceRate).toBe(25);
		});

		it("counts only committed pledges as items donated", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			const needA = await createNeed(db, org.id);
			const needB = await createNeed(db, org.id);
			await createPledge(db, needA.id, volunteer.id, {
				quantity: 30,
				status: "ACCEPTED",
			});
			// Still pending — must not be counted as donated.
			await createPledge(db, needB.id, volunteer.id, {
				quantity: 999,
				status: "PENDING",
			});

			const impact = await service.getVolunteerImpact(volunteer.id);
			expect(impact.itemsDonated).toBe(30);
			expect(impact.pledgesCompleted).toBe(1);
		});
	});

	describe("organization impact", () => {
		it("returns zeroes for a brand new organization", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			const impact = await service.getOrganizationImpact(org.id);
			expect(impact.eventsHosted).toBe(0);
			expect(impact.volunteersEngaged).toBe(0);
			expect(impact.volunteerHours).toBe(0);
			expect(impact.activeSince).not.toBeNull();
		});

		it("counts each event once even with many attendees", async () => {
			// The applications join multiplies rows; a plain count() would
			// overstate events hosted.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await eventOfHours(org.id, 5);

			for (let i = 0; i < 3; i++) {
				const volunteer = await createUser(db, { role: "volunteer" });
				await createApplication(db, event.id, volunteer.id, {
					status: "ACCEPTED",
					attendedAt: new Date(),
				});
			}

			const impact = await service.getOrganizationImpact(org.id);

			expect(impact.eventsHosted).toBe(1);
			expect(impact.volunteersEngaged).toBe(3);
			// Volunteer-hours: 3 people × 5 hours.
			expect(impact.volunteerHours).toBe(15);
		});

		it("excludes draft events from the hosted count", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await createEvent(db, org.id, { status: "PUBLISHED" });
			await createEvent(db, org.id, { status: "DRAFT" });

			const impact = await service.getOrganizationImpact(org.id);
			expect(impact.eventsHosted).toBe(1);
		});

		it("reports fulfilled needs and items received", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await createNeed(db, org.id, { status: "FULFILLED" });
			await createNeed(db, org.id, { status: "OPEN" });

			const impact = await service.getOrganizationImpact(org.id);
			expect(impact.needsFulfilled).toBe(1);
		});
	});

	describe("event lifecycle", () => {
		it("closes finished events so the feed stops offering them", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			const past = new Date(Date.now() - 5 * 24 * HOURS);
			await createEvent(db, org.id, {
				status: "PUBLISHED",
				startAt: past,
				endAt: new Date(past.getTime() + 4 * HOURS),
			});
			await createEvent(db, org.id, { status: "PUBLISHED" }); // future

			const result = await service.closeFinishedEvents();

			expect(result.completed).toBe(1);
			const rows = await db.query.events.findMany({});
			expect(rows.filter((e) => e.status === "COMPLETED")).toHaveLength(1);
			expect(rows.filter((e) => e.status === "PUBLISHED")).toHaveLength(1);
		});

		it("leaves cancelled and draft events alone", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const past = new Date(Date.now() - 5 * 24 * HOURS);

			await createEvent(db, org.id, {
				status: "CANCELLED",
				startAt: past,
				endAt: new Date(past.getTime() + HOURS),
			});
			await createEvent(db, org.id, {
				status: "DRAFT",
				startAt: past,
				endAt: new Date(past.getTime() + HOURS),
			});

			const result = await service.closeFinishedEvents();
			expect(result.completed).toBe(0);
		});

		it("is idempotent", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const past = new Date(Date.now() - 5 * 24 * HOURS);
			await createEvent(db, org.id, {
				status: "PUBLISHED",
				startAt: past,
				endAt: new Date(past.getTime() + HOURS),
			});

			expect((await service.closeFinishedEvents()).completed).toBe(1);
			expect((await service.closeFinishedEvents()).completed).toBe(0);
		});
	});
});
