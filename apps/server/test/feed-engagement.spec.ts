import { announcements, posts } from "@nabhya/db/schema";
import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FeedEngagementService } from "../src/modules/feed/feed-engagement.service";
import {
	createEvent,
	createNeed,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Regression cover for the polymorphic feed target. `assertVisible` once
 * looked only in `posts`, so every like, impression and comment on a need,
 * event or announcement 404'd — those ids belong to their own tables.
 *
 * Visibility is intentionally strict, matching the candidate pool
 * (`FeedRankingService.candidates`) and the single-item detail fetches
 * (`EventsService.getPublicById`, etc.): only an OPEN need, a PUBLISHED event
 * or a PUBLISHED announcement is engageable — the same status gate that keeps
 * it out of the feed in the first place also keeps it un-likeable once it
 * changes state, rather than freezing engagement at whatever it was when the
 * row was last visible.
 */
describe("FeedEngagementService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: FeedEngagementService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new FeedEngagementService(db as never);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	async function fixture() {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		const volunteer = await createUser(db, { role: "volunteer" });
		return { owner, org, volunteer };
	}

	async function createAnnouncement(
		organizationId: string,
		status: "DRAFT" | "PUBLISHED" = "PUBLISHED",
	) {
		const [row] = await db
			.insert(announcements)
			.values({
				organizationId,
				title: "We distributed 400 blankets",
				body: "A sufficiently long announcement body for the feed.",
				status,
				publishedAt: status === "PUBLISHED" ? new Date() : null,
			})
			.returning();
		if (!row) throw new Error("announcement insert failed");
		return row;
	}

	async function createPost(organizationId: string, authorUserId: string) {
		const [row] = await db
			.insert(posts)
			.values({
				organizationId,
				authorUserId,
				type: "POST",
				text: "Hello from the feed.",
				mediaFolder: `folder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
			})
			.returning();
		if (!row) throw new Error("post insert failed");
		return row;
	}

	it("likes a NEED, whose id lives in `needs`, not `posts`", async () => {
		const { org, volunteer } = await fixture();
		const need = await createNeed(db, org.id);

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "NEED", postId: need.id },
				"LIKE",
			),
		).resolves.toEqual({ recorded: true });

		const rows = await db.query.postInteractions.findMany({});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ targetType: "NEED", postId: need.id });
	});

	it("likes an EVENT and an ANNOUNCEMENT", async () => {
		const { org, volunteer } = await fixture();
		const event = await createEvent(db, org.id);
		const announcement = await createAnnouncement(org.id);

		await service.addInteraction(
			volunteer.id,
			{ targetType: "EVENT", postId: event.id },
			"LIKE",
		);
		await service.addInteraction(
			volunteer.id,
			{ targetType: "ANNOUNCEMENT", postId: announcement.id },
			"IMPRESSION",
		);

		expect(await db.query.postInteractions.findMany({})).toHaveLength(2);
	});

	it("comments on a NEED and reads the thread back", async () => {
		const { org, volunteer } = await fixture();
		const need = await createNeed(db, org.id);

		await service.createComment(volunteer.id, {
			targetType: "NEED",
			postId: need.id,
			body: "I can bring 20 of these.",
		});

		const page = await service.listComments(
			{ targetType: "NEED", postId: need.id },
			{ page: 1, limit: 20 },
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.body).toBe("I can bring 20 of these.");
	});

	it("still serves plain posts", async () => {
		const { org, owner, volunteer } = await fixture();
		const post = await createPost(org.id, owner.id);

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "POST", postId: post.id },
				"LIKE",
			),
		).resolves.toEqual({ recorded: true });
	});

	it("keeps a like idempotent across repeat taps", async () => {
		const { org, volunteer } = await fixture();
		const need = await createNeed(db, org.id);
		const target = { targetType: "NEED", postId: need.id } as const;

		await service.addInteraction(volunteer.id, target, "LIKE");
		await service.addInteraction(volunteer.id, target, "LIKE");
		await service.addInteraction(volunteer.id, target, "LIKE");

		expect(await db.query.postInteractions.findMany({})).toHaveLength(1);
	});

	it("refuses a need that has closed — the status gate cuts both ways", async () => {
		const { org, volunteer } = await fixture();
		const need = await createNeed(db, org.id, { status: "CLOSED" });

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "NEED", postId: need.id },
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses a draft announcement, which was never public", async () => {
		const { org, volunteer } = await fixture();
		const announcement = await createAnnouncement(org.id, "DRAFT");

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "ANNOUNCEMENT", postId: announcement.id },
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses a draft event", async () => {
		const { org, volunteer } = await fixture();
		const event = await createEvent(db, org.id, { status: "DRAFT" });

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "EVENT", postId: event.id },
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses a completed event — same status gate, not just draft", async () => {
		const { org, volunteer } = await fixture();
		const event = await createEvent(db, org.id, { status: "COMPLETED" });

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "EVENT", postId: event.id },
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses a need belonging to a suspended organization", async () => {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id, {
			status: "SUSPENDED",
		});
		const volunteer = await createUser(db, { role: "volunteer" });
		const need = await createNeed(db, org.id);

		await expect(
			service.addInteraction(
				volunteer.id,
				{ targetType: "NEED", postId: need.id },
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("refuses an id that names nothing", async () => {
		const { volunteer } = await fixture();

		await expect(
			service.addInteraction(
				volunteer.id,
				{
					targetType: "NEED",
					postId: "00000000-0000-0000-0000-000000000000",
				},
				"LIKE",
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
