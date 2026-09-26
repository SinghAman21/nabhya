import { organizationAdmins, posts } from "@nabhya/db/schema";
import { ForbiddenException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { FeedService } from "../src/modules/feed/feed.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	authUserFor,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Who may post to the feed as an NGO, and who may take a post down.
 *
 * Posts were the one kind of public content that skipped the team-role check
 * (needs, events and announcements all require `content.publish`), and
 * deletion was author-only, so a post outlived its author's place on the team.
 */
describe("FeedService permissions", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let feed: FeedService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		feed = new FeedService(
			db as never,
			{ delete: async () => undefined } as never,
			// Media is exercised elsewhere; these posts carry none.
			{
				createEmptyFeedMediaFolder: () => "feed-media/test",
				assertFeedMediaKeys: async () => undefined,
			} as never,
			audit,
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

	async function teamWith(role: "MANAGER" | "MEMBER" | "VIEWER") {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		await db.insert(organizationAdmins).values({
			organizationId: org.id,
			userId: owner.id,
			role: "OWNER",
			isOwner: true,
			status: "ACTIVE",
		});
		const member = await createUser(db, { role: "organisation" });
		await db.insert(organizationAdmins).values({
			organizationId: org.id,
			userId: member.id,
			role,
			status: "ACTIVE",
		});
		return { owner, org, member };
	}

	const post = {
		text: "We distributed 200 blankets in Dharavi this weekend.",
		type: "POST" as const,
		isUrgent: false,
		mediaKeys: [],
	};

	it("refuses a post from a teammate who cannot publish", async () => {
		const { member } = await teamWith("VIEWER");

		await expect(
			feed.create(authUserFor(member, ["organisation"]), post as never),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(await db.query.posts.findMany({})).toHaveLength(0);
	});

	it("lets a teammate with content.delete remove a colleague's post", async () => {
		const { owner, member } = await teamWith("MANAGER");
		const created = await feed.create(
			authUserFor(owner, ["organisation"]),
			post as never,
		);

		await feed.remove(authUserFor(member, ["organisation"]), created.id);

		expect(
			await db.query.posts.findFirst({ where: eq(posts.id, created.id) }),
		).toBeUndefined();
	});

	it("keeps a member without content.delete, and other NGOs, away from it", async () => {
		const { owner, member } = await teamWith("MEMBER");
		const created = await feed.create(
			authUserFor(owner, ["organisation"]),
			post as never,
		);
		const stranger = await createUser(db, { role: "organisation" });
		await createOrganization(db, stranger.id);

		await expect(
			feed.remove(authUserFor(member, ["organisation"]), created.id),
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			feed.remove(authUserFor(stranger, ["organisation"]), created.id),
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});
