import { announcements, bookmarks, organizationNeeds } from "@nabhya/db/schema";
import type { FeedQuery } from "@nabhya/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FeedService } from "../src/modules/feed/feed.service";
import {
	createEvent,
	createNeed,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

const query = (overrides: Partial<FeedQuery> = {}): FeedQuery => ({
	page: 1,
	limit: 20,
	tab: "for_you",
	...overrides,
});

/**
 * The feed is one hand-written SQL statement, which typecheck cannot see into.
 * These run it against a real Postgres so a column rename or an enum literal
 * typo fails here rather than on the first request.
 */
describe("FeedService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: FeedService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new FeedService(db as never);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	async function seedWorld() {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id, { name: "Seva Trust" });
		const need = await createNeed(db, org.id, { type: "WANT", quantity: 50 });
		const event = await createEvent(db, org.id, {
			status: "PUBLISHED",
			startAt: new Date(Date.now() + 7 * 86_400_000),
		});
		const [story] = await db
			.insert(announcements)
			.values({
				organizationId: org.id,
				title: "Winter drive wrap-up",
				body: "We reached 400 families this season.",
				status: "PUBLISHED",
			})
			.returning();

		// An unverified NGO's posts must never surface.
		const shadowOwner = await createUser(db, { role: "organisation" });
		const shadow = await createOrganization(db, shadowOwner.id, {
			verificationStatus: "PENDING",
		});
		await createNeed(db, shadow.id);

		return { org, need, event, story: story as NonNullable<typeof story> };
	}

	it("interleaves needs, events and stories from verified NGOs only", async () => {
		const { need, event, story } = await seedWorld();

		const page = await service.list(query(), null);

		expect(page.meta.total).toBe(3);
		expect(page.items.map((i) => `${i.kind}:${i.id}`).sort()).toEqual(
			[`need:${need.id}`, `event:${event.id}`, `story:${story.id}`].sort(),
		);

		const needItem = page.items.find((i) => i.kind === "need");
		expect(needItem?.need).toMatchObject({ type: "WANT", quantity: 50 });
		expect(needItem?.organization.organizationName).toBe("Seva Trust");
		expect(needItem?.isFollowing).toBe(false);
	});

	it("pages the merged list with a stable total", async () => {
		await seedWorld();

		const first = await service.list(query({ limit: 2 }), null);
		const second = await service.list(query({ limit: 2, page: 2 }), null);

		expect(first.items).toHaveLength(2);
		expect(first.meta.hasMore).toBe(true);
		expect(second.items).toHaveLength(1);
		expect(second.meta.total).toBe(3);
		expect(second.meta.hasMore).toBe(false);
	});

	it("scopes 'following' to bookmarked NGOs and flags them on every card", async () => {
		const { org } = await seedWorld();
		const volunteer = await createUser(db, { role: "volunteer" });

		const anonymous = await service.list(query({ tab: "following" }), null);
		expect(anonymous.items).toHaveLength(0);

		const before = await service.list(
			query({ tab: "following" }),
			volunteer.id,
		);
		expect(before.items).toHaveLength(0);

		await db
			.insert(bookmarks)
			.values({ userId: volunteer.id, organizationId: org.id });

		const after = await service.list(query({ tab: "following" }), volunteer.id);
		expect(after.meta.total).toBe(3);
		expect(after.items.every((i) => i.isFollowing)).toBe(true);
	});

	it("'urgent' keeps only HIGH-urgency needs and imminent events", async () => {
		const { need } = await seedWorld();
		await db
			.update(organizationNeeds)
			.set({ urgency: "HIGH" })
			.where(eq(organizationNeeds.id, need.id));

		const page = await service.list(query({ tab: "urgent" }), null);

		expect(page.items.map((i) => i.id)).toEqual([need.id]);
		expect(page.items[0]?.isUrgent).toBe(true);
	});

	it("'trending' hides stories and anything without recent engagement", async () => {
		await seedWorld();

		const page = await service.list(query({ tab: "trending" }), null);

		expect(page.items).toHaveLength(0);
	});

	it("filters by city, falling back to the NGO's city for stories", async () => {
		await seedWorld();

		const mumbai = await service.list(query({ city: "mumbai" }), null);
		const pune = await service.list(query({ city: "Pune" }), null);

		// Factory needs/events/orgs are all in Mumbai; the story has no city of
		// its own and inherits the NGO's.
		expect(mumbai.meta.total).toBe(3);
		expect(pune.items).toHaveLength(0);
	});
});
