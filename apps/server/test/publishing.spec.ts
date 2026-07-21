import { announcements, organizationAdmins } from "@nabhya/db/schema";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { PublishingService } from "../src/modules/publishing/publishing.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Announcements, transparency reports and team management.
 *
 * The property that matters across all three is isolation: an NGO must never
 * be able to reach another NGO's rows by guessing an id.
 */
describe("PublishingService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: PublishingService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		const organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		service = new PublishingService(
			db as never,
			audit,
			notifications,
			organizationsService,
			// Storage is stubbed: assertUploaded is exercised in uploads.spec.
			{ assertUploaded: async () => undefined } as never,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	/** A verified org plus its owner — the state most of these paths require. */
	async function verifiedOrg() {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id, {
			verificationStatus: "VERIFIED",
		});
		return { owner, org };
	}

	const announcement = {
		title: "Winter drive begins",
		body: "We are collecting blankets across three wards this month.",
		status: "PUBLISHED" as const,
		isPinned: false,
	};

	describe("announcements", () => {
		it("refuses to publish from an unverified NGO", async () => {
			// Announcements are publicly visible, so verification gates them.
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			await expect(
				service.createAnnouncement(owner.id, announcement),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("stamps publishedAt only when the update goes live", async () => {
			const { owner } = await verifiedOrg();

			const draft = await service.createAnnouncement(owner.id, {
				...announcement,
				status: "DRAFT",
			});
			expect(draft.publishedAt).toBeNull();

			const live = await service.createAnnouncement(owner.id, announcement);
			expect(live.publishedAt).not.toBeNull();
		});

		it("hides drafts from the public list but shows them to the owner", async () => {
			const { owner, org } = await verifiedOrg();
			await service.createAnnouncement(owner.id, {
				...announcement,
				status: "DRAFT",
			});
			await service.createAnnouncement(owner.id, announcement);

			const publicList = await service.listAnnouncements(org.id, {
				page: 1,
				limit: 20,
			});
			expect(publicList.items).toHaveLength(1);

			const ownList = await service.listMyAnnouncements(owner.id, {
				page: 1,
				limit: 20,
			});
			expect(ownList.items).toHaveLength(2);
		});

		it("refuses to edit another NGO's update", async () => {
			const { owner } = await verifiedOrg();
			const mine = await service.createAnnouncement(owner.id, announcement);

			const { owner: stranger } = await verifiedOrg();

			await expect(
				service.updateAnnouncement(stranger.id, mine.id, {
					...announcement,
					title: "Hijacked title",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);

			const untouched = await db.query.announcements.findFirst({
				where: eq(announcements.id, mine.id),
			});
			expect(untouched?.title).toBe("Winter drive begins");
		});

		it("refuses to delete another NGO's update", async () => {
			const { owner } = await verifiedOrg();
			const mine = await service.createAnnouncement(owner.id, announcement);
			const { owner: stranger } = await verifiedOrg();

			await expect(
				service.deleteAnnouncement(stranger.id, mine.id),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("notifies everyone who bookmarked the NGO", async () => {
			const { owner, org } = await verifiedOrg();
			const follower = await createUser(db, { role: "volunteer" });
			await db.execute(
				`insert into bookmarks (user_id, organization_id) values ('${follower.id}', '${org.id}')`,
			);

			await service.createAnnouncement(owner.id, announcement);

			const inbox = await db.query.notifications.findMany();
			expect(inbox).toHaveLength(1);
			expect(inbox[0]?.userId).toBe(follower.id);
		});

		it("does not notify anyone about a draft", async () => {
			const { owner, org } = await verifiedOrg();
			const follower = await createUser(db, { role: "volunteer" });
			await db.execute(
				`insert into bookmarks (user_id, organization_id) values ('${follower.id}', '${org.id}')`,
			);

			await service.createAnnouncement(owner.id, {
				...announcement,
				status: "DRAFT",
			});

			expect(await db.query.notifications.findMany()).toHaveLength(0);
		});
	});

	describe("financial reports", () => {
		const report = {
			type: "ANNUAL_REPORT" as const,
			title: "Annual report",
			financialYear: 2024,
			documentKey: "org-reports/x/annual.pdf",
		};

		it("refuses to publish from an unverified NGO", async () => {
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id, {
				verificationStatus: "UNDER_REVIEW",
			});

			await expect(
				service.createFinancialReport(owner.id, report),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("lists newest financial year first", async () => {
			const { owner, org } = await verifiedOrg();
			await service.createFinancialReport(owner.id, {
				...report,
				financialYear: 2022,
			});
			await service.createFinancialReport(owner.id, {
				...report,
				financialYear: 2024,
			});

			const list = await service.listFinancialReports(org.id);
			expect(list.map((r) => r.financialYear)).toEqual([2024, 2022]);
		});

		it("refuses to delete another NGO's report", async () => {
			const { owner } = await verifiedOrg();
			const mine = await service.createFinancialReport(owner.id, report);
			const { owner: stranger } = await verifiedOrg();

			await expect(
				service.deleteFinancialReport(stranger.id, mine.id),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("team", () => {
		it("adds an existing account and lists the owner first", async () => {
			const { owner, org } = await verifiedOrg();
			await db.insert(organizationAdmins).values({
				organizationId: org.id,
				userId: owner.id,
				isOwner: true,
			});
			const colleague = await createUser(db, { role: "volunteer" });

			await service.inviteAdmin(owner.id, {
				email: colleague.email,
				designation: "Programme lead",
			});

			const team = await service.listTeam(owner.id);
			expect(team).toHaveLength(2);
			expect(team[0]?.isOwner).toBe(true);
			expect(team[1]?.user.email).toBe(colleague.email);
		});

		it("refuses to invite someone who has not signed up", async () => {
			// Creating an account from an email would provision a user who never
			// consented, so this has to fail rather than invent one.
			const { owner } = await verifiedOrg();

			await expect(
				service.inviteAdmin(owner.id, { email: "nobody@example.com" }),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("matches the invitee's email case-insensitively", async () => {
			const { owner } = await verifiedOrg();
			const colleague = await createUser(db, { role: "volunteer" });

			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email.toUpperCase(),
			});

			expect(member.userId).toBe(colleague.id);
		});

		it("refuses to add the same person twice", async () => {
			const { owner } = await verifiedOrg();
			const colleague = await createUser(db, { role: "volunteer" });

			await service.inviteAdmin(owner.id, { email: colleague.email });

			await expect(
				service.inviteAdmin(owner.id, { email: colleague.email }),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("refuses to remove the owner, which would orphan the NGO", async () => {
			const { owner, org } = await verifiedOrg();
			const [ownerRow] = await db
				.insert(organizationAdmins)
				.values({ organizationId: org.id, userId: owner.id, isOwner: true })
				.returning();
			if (!ownerRow) throw new Error("owner admin insert failed");

			await expect(
				service.removeAdmin(owner.id, ownerRow.id),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("refuses to touch a member of another organization", async () => {
			const { owner } = await verifiedOrg();
			const colleague = await createUser(db, { role: "volunteer" });
			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email,
			});

			const { owner: stranger } = await verifiedOrg();

			await expect(
				service.removeAdmin(stranger.id, member.id),
			).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				service.updateAdmin(stranger.id, member.id, {
					designation: "Impostor",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("removes a non-owner member", async () => {
			const { owner } = await verifiedOrg();
			const colleague = await createUser(db, { role: "volunteer" });
			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email,
			});

			await service.removeAdmin(owner.id, member.id);

			expect(await db.query.organizationAdmins.findMany()).toHaveLength(0);
		});
	});
});
