import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { EngagementService } from "../src/modules/engagement/engagement.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("EngagementService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: EngagementService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		service = new EngagementService(
			db as never,
			audit,
			new NotificationsService(db as never),
			new OrganizationsService(db as never, audit, null as never),
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
		const org = await createOrganization(db, owner.id);
		return { owner, org };
	}

	describe("bookmarks", () => {
		it("toggles on and off, and is safe to repeat", async () => {
			const { org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });

			expect(await service.toggleBookmark(volunteer.id, org.id)).toEqual({
				bookmarked: true,
			});
			expect(await service.toggleBookmark(volunteer.id, org.id)).toEqual({
				bookmarked: false,
			});
			expect(await service.toggleBookmark(volunteer.id, org.id)).toEqual({
				bookmarked: true,
			});

			const rows = await db.query.bookmarks.findMany({});
			expect(rows).toHaveLength(1);
		});

		it("refuses to bookmark an unverified organization", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});
			const volunteer = await createUser(db, { role: "volunteer" });

			await expect(
				service.toggleBookmark(volunteer.id, org.id),
			).rejects.toThrow();
		});
	});

	describe("reviews", () => {
		it("stops an owner reviewing their own organization", async () => {
			// Otherwise the rating is trivially self-inflatable.
			const { owner, org } = await verifiedOrg();

			await expect(
				service.upsertReview(owner.id, org.id, { rating: 5 }),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("edits in place rather than stacking a second review", async () => {
			const { org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.upsertReview(volunteer.id, org.id, {
				rating: 3,
				body: "Fine",
			});
			await service.upsertReview(volunteer.id, org.id, {
				rating: 5,
				body: "Actually great",
			});

			const rows = await db.query.reviews.findMany({});
			expect(rows).toHaveLength(1);
			expect(rows[0]?.rating).toBe(5);
			expect(rows[0]?.body).toBe("Actually great");
		});

		it("notifies the organization owner of a new review", async () => {
			const { owner, org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.upsertReview(volunteer.id, org.id, { rating: 4 });

			const inbox = await db.query.notifications.findMany({});
			expect(inbox).toHaveLength(1);
			expect(inbox[0]?.userId).toBe(owner.id);
		});

		it("does not re-notify on an edit", async () => {
			const { org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });

			await service.upsertReview(volunteer.id, org.id, { rating: 4 });
			await service.upsertReview(volunteer.id, org.id, { rating: 2 });

			const inbox = await db.query.notifications.findMany({});
			expect(inbox).toHaveLength(1);
		});

		it("computes the average and star distribution", async () => {
			const { org } = await verifiedOrg();
			for (const rating of [5, 5, 3]) {
				const volunteer = await createUser(db, { role: "volunteer" });
				await service.upsertReview(volunteer.id, org.id, { rating });
			}

			const summary = await service.getReviewSummary(org.id);

			expect(summary.count).toBe(3);
			expect(summary.average).toBeCloseTo(4.33, 1);
			expect(summary.distribution["5"]).toBe(2);
			expect(summary.distribution["3"]).toBe(1);
			expect(summary.distribution["1"]).toBe(0);
		});

		it("returns a zeroed summary for an organization with no reviews", async () => {
			const { org } = await verifiedOrg();
			const summary = await service.getReviewSummary(org.id);

			// Must be 0, not NaN — this renders directly in the UI.
			expect(summary.average).toBe(0);
			expect(summary.count).toBe(0);
		});

		it("lets the organization reply, and notifies the reviewer", async () => {
			const { owner, org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });
			const review = await service.upsertReview(volunteer.id, org.id, {
				rating: 2,
				body: "Disorganised",
			});

			await service.replyToReview(owner.id, (review as { id: string }).id, {
				reply: "Sorry — we've changed our check-in process since.",
			});

			const stored = await db.query.reviews.findMany({});
			expect(stored[0]?.reply).toContain("check-in process");

			const inbox = await db.query.notifications.findMany({});
			expect(inbox.some((n) => n.userId === volunteer.id)).toBe(true);
		});

		it("stops an organization replying to another's review", async () => {
			const { org } = await verifiedOrg();
			const volunteer = await createUser(db, { role: "volunteer" });
			const review = await service.upsertReview(volunteer.id, org.id, {
				rating: 1,
			});

			const outsider = await createUser(db, { role: "organisation" });
			await createOrganization(db, outsider.id);

			await expect(
				service.replyToReview(outsider.id, (review as { id: string }).id, {
					reply: "Not our problem",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});
});
