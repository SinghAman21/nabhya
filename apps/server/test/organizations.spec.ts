import { organizations } from "@nabhya/db/schema";
import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
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

/** Mumbai, Pune and Delhi - roughly 120 km and 1150 km apart respectively. */
const MUMBAI = { latitude: 19.076, longitude: 72.8777 };
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };

describe("OrganizationsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: OrganizationsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new OrganizationsService(
			db as never,
			new AuditService(db as never),
			null as never,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	async function orgAt(
		point: { latitude: number; longitude: number } | null,
		options: { name?: string; verified?: boolean; suspended?: boolean } = {},
	) {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id, {
			name: options.name,
			verificationStatus: options.verified === false ? "PENDING" : "VERIFIED",
			status: options.suspended ? "SUSPENDED" : "ACTIVE",
		});
		if (point) {
			await db
				.update(organizations)
				.set({
					latitude: String(point.latitude),
					longitude: String(point.longitude),
				})
				.where(eq(organizations.id, org.id));
		}
		return org;
	}

	describe("public directory", () => {
		it("lists only verified, active organizations", async () => {
			await orgAt(null, { name: "Verified NGO" });
			await orgAt(null, { name: "Pending NGO", verified: false });
			await orgAt(null, { name: "Suspended NGO", suspended: true });

			const result = await service.listPublic({ page: 1, limit: 20 });

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.organizationName).toBe("Verified NGO");
			expect(result.meta.total).toBe(1);
		});

		it("hides an unverified organization from the detail route too", async () => {
			const org = await orgAt(null, { verified: false });
			await expect(service.getPublicById(org.id)).rejects.toBeInstanceOf(
				NotFoundException,
			);
		});
	});

	describe("proximity search", () => {
		it("returns organizations inside the radius, nearest first", async () => {
			await orgAt(MUMBAI, { name: "Mumbai NGO" });
			await orgAt(PUNE, { name: "Pune NGO" });

			const result = await service.listNearby({
				page: 1,
				limit: 20,
				...MUMBAI,
				radiusKm: 200,
			});

			expect(result.items.map((i) => i.organizationName)).toEqual([
				"Mumbai NGO",
				"Pune NGO",
			]);
			expect(result.items[0]?.distanceKm).toBeLessThan(1);
			// Pune is ~120 km from Mumbai.
			expect(result.items[1]?.distanceKm).toBeGreaterThan(100);
			expect(result.items[1]?.distanceKm).toBeLessThan(160);
		});

		it("excludes organizations beyond the radius", async () => {
			await orgAt(MUMBAI, { name: "Mumbai NGO" });
			await orgAt(DELHI, { name: "Delhi NGO" });

			const result = await service.listNearby({
				page: 1,
				limit: 20,
				...MUMBAI,
				radiusKm: 50,
			});

			expect(result.items.map((i) => i.organizationName)).toEqual([
				"Mumbai NGO",
			]);
		});

		it("excludes organizations with no coordinates set", async () => {
			await orgAt(null, { name: "No coordinates" });

			const result = await service.listNearby({
				page: 1,
				limit: 20,
				...MUMBAI,
				radiusKm: 500,
			});

			expect(result.items).toHaveLength(0);
		});

		it("excludes unverified and suspended organizations", async () => {
			await orgAt(MUMBAI, { name: "Pending", verified: false });
			await orgAt(MUMBAI, { name: "Suspended", suspended: true });

			const result = await service.listNearby({
				page: 1,
				limit: 20,
				...MUMBAI,
				radiusKm: 50,
			});

			expect(result.items).toHaveLength(0);
		});

		it("reports the true total, not just the size of the current page", async () => {
			// Three inside the radius, asking for one per page. A total derived
			// from the page length would wrongly report 1 and hide pages 2 and 3.
			await orgAt(MUMBAI, { name: "A" });
			await orgAt(MUMBAI, { name: "B" });
			await orgAt(MUMBAI, { name: "C" });

			const result = await service.listNearby({
				page: 1,
				limit: 1,
				...MUMBAI,
				radiusKm: 50,
			});

			expect(result.items).toHaveLength(1);
			expect(result.meta.total).toBe(3);
			expect(result.meta.totalPages).toBe(3);
			expect(result.meta.hasMore).toBe(true);
		});
	});

	describe("dashboard overview", () => {
		it("counts across the whole org, not the first page of a list", async () => {
			// The dashboard summed page 1 (20 rows), so the 21st event's
			// applicants never reached "Needs your decision".
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const other = await createOrganization(
				db,
				(await createUser(db, { role: "organisation" })).id,
			);
			const volunteer = await createUser(db, { role: "volunteer" });

			const published = [];
			for (let i = 0; i < 22; i++) {
				published.push(await createEvent(db, org.id, { status: "PUBLISHED" }));
			}
			await createEvent(db, org.id, { status: "DRAFT" });
			const [firstEvent] = published;
			const lastEvent = published.at(-1);
			if (!firstEvent || !lastEvent) throw new Error("events not created");
			await createApplication(db, lastEvent.id, volunteer.id);
			await createApplication(
				db,
				firstEvent.id,
				(await createUser(db, { role: "volunteer" })).id,
			);
			await createApplication(
				db,
				firstEvent.id,
				(await createUser(db, { role: "volunteer" })).id,
				{ status: "ACCEPTED" },
			);
			const need = await createNeed(db, org.id);
			await createNeed(db, org.id, { status: "CLOSED" });
			await createPledge(db, need.id, volunteer.id);
			// Another NGO's rows must not leak into the counts.
			await createEvent(db, other.id, { status: "PUBLISHED" });

			const overview = await service.getMyOverview(owner.id);

			expect(overview).toEqual({
				publishedEvents: 22,
				openNeeds: 1,
				pendingApplications: 2,
				eventsWithApplicants: 2,
				pendingPledges: 1,
				needsWithPledges: 1,
			});
		});
	});
});
