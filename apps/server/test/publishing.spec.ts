import {
	announcements,
	notifications,
	organizationAdmins,
	organizations,
	roles,
	teamInvites,
	userRoles,
	users,
} from "@nabhya/db/schema";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
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
	let sentTeamInviteEmails: Array<{ to: string; inviteUrl: string }>;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const notifications = new NotificationsService(db as never);
		const organizationsService = new OrganizationsService(
			db as never,
			audit,
			null as never,
		);
		sentTeamInviteEmails = [];
		service = new PublishingService(
			db as never,
			audit,
			notifications,
			organizationsService,
			// Storage is stubbed: assertUploaded is exercised in uploads.spec.
			{ assertUploaded: async () => undefined } as never,
			{
				sendTeamInvite: async (input: { to: string; inviteUrl: string }) => {
					sentTeamInviteEmails.push(input);
				},
			} as never,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		sentTeamInviteEmails = [];
		await seedRoles(db);
	});

	/** A verified org plus its owner - the state most of these paths require. */
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
		isUrgent: false,
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

		it("stops serving announcements once the NGO is suspended", async () => {
			// Suspending a fraudulent NGO must pull its public content, not just its
			// events and needs.
			const { owner, org } = await verifiedOrg();
			await service.createAnnouncement(owner.id, announcement);

			const live = await service.listAnnouncements(org.id, {
				page: 1,
				limit: 20,
			});
			expect(live.items).toHaveLength(1);

			await db
				.update(organizations)
				.set({ status: "SUSPENDED" })
				.where(eq(organizations.id, org.id));

			await expect(
				service.listAnnouncements(org.id, { page: 1, limit: 20 }),
			).rejects.toBeInstanceOf(NotFoundException);
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

		it("filters the NGO's own list by status on the server", async () => {
			const { owner } = await verifiedOrg();
			await service.createAnnouncement(owner.id, announcement);
			await service.createAnnouncement(owner.id, {
				...announcement,
				title: "Next month's plan",
				status: "DRAFT",
			});

			const drafts = await service.listMyAnnouncements(owner.id, {
				page: 1,
				limit: 20,
				status: "DRAFT",
			});
			expect(drafts.items.map((row) => row.title)).toEqual([
				"Next month's plan",
			]);
			expect(drafts.meta.total).toBe(1);
		});

		it("keeps drafts silent, restricts viewers, and protects published updates from demotion", async () => {
			const { owner, org } = await verifiedOrg();
			const follower = await createUser(db, { role: "volunteer" });
			const member = await createUser(db, { role: "organisation" });
			const viewer = await createUser(db, { role: "organisation" });
			await db.insert(organizationAdmins).values([
				{
					organizationId: org.id,
					userId: member.id,
					role: "MEMBER",
					status: "ACTIVE",
				},
				{
					organizationId: org.id,
					userId: viewer.id,
					role: "VIEWER",
					status: "ACTIVE",
				},
			]);
			await db.execute(
				`insert into bookmarks (user_id, organization_id) values ('${follower.id}', '${org.id}')`,
			);

			const draft = await service.createAnnouncement(member.id, {
				...announcement,
				status: "DRAFT",
			});
			expect(draft.status).toBe("DRAFT");
			await expect(
				service.createAnnouncement(viewer.id, {
					...announcement,
					status: "DRAFT",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(await db.query.notifications.findMany()).toHaveLength(0);

			const published = await service.createAnnouncement(
				owner.id,
				announcement,
			);
			await expect(
				service.updateAnnouncement(viewer.id, published.id, {
					...announcement,
					status: "DRAFT",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);

			const stillPublished = await db.query.announcements.findFirst({
				where: eq(announcements.id, published.id),
			});
			expect(stillPublished?.status).toBe("PUBLISHED");
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
			const colleague = await createUser(db);

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
			const colleague = await createUser(db);

			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email.toUpperCase(),
			});

			expect(member.userId).toBe(colleague.id);
		});

		it("refuses to add the same person twice", async () => {
			const { owner } = await verifiedOrg();
			const colleague = await createUser(db);

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
			const colleague = await createUser(db);
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
			const colleague = await createUser(db);
			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email,
			});

			await service.removeAdmin(owner.id, member.id);

			const stored = await db.query.organizationAdmins.findFirst({
				where: eq(organizationAdmins.id, member.id),
			});
			expect(stored?.status).toBe("REMOVED");
			expect(stored?.leftAt).not.toBeNull();
		});

		it("creates an invite for a future account and accepts it once that email signs in", async () => {
			const { owner } = await verifiedOrg();
			const invite = await service.createTeamInvite(owner.id, {
				email: "priya@example.com",
				role: "MANAGER",
				designation: "Field Lead – Pune",
			});
			expect(invite.token).toBeTruthy();
			expect(invite.tokenHash).not.toBe(invite.token);
			expect(sentTeamInviteEmails[0]?.to).toBe("priya@example.com");
			expect(sentTeamInviteEmails[0]?.inviteUrl).toContain(invite.token);

			const priya = await createUser(db, {
				role: "organisation",
				fullName: "Priya",
			});
			await db
				.update(users)
				.set({ email: "priya@example.com" })
				.where(eq(users.id, priya.id));

			const member = await service.acceptTeamInvite(priya.id, invite.token);
			expect(member.role).toBe("MANAGER");
			expect(member.designation).toBe("Field Lead – Pune");

			await expect(
				service.acceptTeamInvite(priya.id, invite.token),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("fails expired and revoked invites with distinct errors", async () => {
			const { owner } = await verifiedOrg();
			const expired = await service.createTeamInvite(owner.id, {
				email: "old@example.com",
				role: "MEMBER",
			});
			await db
				.update(teamInvites)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(teamInvites.id, expired.id));
			const oldUser = await createUser(db, { role: "organisation" });
			await db
				.update(users)
				.set({ email: "old@example.com" })
				.where(eq(users.id, oldUser.id));
			await expect(
				service.acceptTeamInvite(oldUser.id, expired.token),
			).rejects.toBeInstanceOf(BadRequestException);

			const revoked = await service.createTeamInvite(owner.id, {
				email: "revoked@example.com",
				role: "MEMBER",
			});
			await service.revokeTeamInvite(owner.id, revoked.id);
			const revokedUser = await createUser(db, { role: "organisation" });
			await db
				.update(users)
				.set({ email: "revoked@example.com" })
				.where(eq(users.id, revokedUser.id));
			await expect(
				service.acceptTeamInvite(revokedUser.id, revoked.token),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("enforces team permissions for viewer/member roles", async () => {
			const { owner } = await verifiedOrg();
			const viewer = await createUser(db, { role: "organisation" });
			const viewerMember = await service.inviteAdmin(owner.id, {
				email: viewer.email,
				role: "VIEWER",
			});

			await expect(
				service.createTeamInvite(viewer.id, {
					email: "blocked@example.com",
					role: "MEMBER",
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				service.removeAdmin(viewer.id, viewerMember.id),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("transfers ownership to an active admin through confirmation", async () => {
			const { owner, org } = await verifiedOrg();
			await db.insert(organizationAdmins).values({
				organizationId: org.id,
				userId: owner.id,
				role: "OWNER",
				isOwner: true,
			});
			const cofounder = await createUser(db, { role: "organisation" });
			const admin = await service.inviteAdmin(owner.id, {
				email: cofounder.email,
				role: "ADMIN",
			});

			const transfer = await service.requestOwnershipTransfer(
				owner.id,
				admin.id,
			);
			expect(transfer.token).toBeTruthy();
			await service.confirmOwnershipTransfer(cofounder.id, {
				token: transfer.token,
			});

			const rows = await db.query.organizationAdmins.findMany({
				where: eq(organizationAdmins.organizationId, org.id),
			});
			expect(
				rows.filter((row) => row.role === "OWNER" && row.status === "ACTIVE"),
			).toHaveLength(1);
			expect(rows.find((row) => row.userId === cofounder.id)?.role).toBe(
				"OWNER",
			);
			expect(rows.find((row) => row.userId === owner.id)?.role).toBe("ADMIN");
			const updatedOrg = await db.query.organizations.findFirst({
				where: eq(organizations.id, org.id),
			});
			expect(updatedOrg?.ownerUserId).toBe(cofounder.id);
		});

		/** An invite to `email`, plus the account that signs up with it. */
		async function inviteFor(
			email: string,
			role?: "volunteer" | "organisation",
		) {
			const { owner, org } = await verifiedOrg();
			const invite = await service.createTeamInvite(owner.id, {
				email,
				role: "MEMBER",
			});
			const invitee = await createUser(db, role ? { role } : {});
			await db.update(users).set({ email }).where(eq(users.id, invitee.id));
			return { owner, org, invite, invitee };
		}

		async function roleNamesOf(userId: string) {
			const rows = await db
				.select({ name: roles.name })
				.from(userRoles)
				.innerJoin(roles, eq(userRoles.roleId, roles.id))
				.where(eq(userRoles.userId, userId));
			return rows.map((row) => row.name);
		}

		it("makes a role-less invitee an organisation account and tells the inviter", async () => {
			// Without the role the invitee lands on role-select, and picking
			// "organisation" there sends them to register a second NGO.
			const { owner, invite, invitee } = await inviteFor("new@example.com");

			await service.acceptTeamInvite(invitee.id, invite.token);

			expect(await roleNamesOf(invitee.id)).toEqual(["organisation"]);
			const sent = await db.query.notifications.findMany({
				where: eq(notifications.userId, owner.id),
			});
			expect(sent.map((row) => row.type)).toContain("TEAM_INVITE_ACCEPTED");
		});

		it("does not grant the role twice to an organisation account", async () => {
			const { invite, invitee } = await inviteFor(
				"org@example.com",
				"organisation",
			);

			await service.acceptTeamInvite(invitee.id, invite.token);

			expect(await roleNamesOf(invitee.id)).toEqual(["organisation"]);
		});

		it("refuses a volunteer account and leaves the invite pending", async () => {
			// Roles are chosen once and the client routes on the first, so a
			// volunteer on a team could never reach the NGO app.
			const { invite, invitee } = await inviteFor(
				"vol@example.com",
				"volunteer",
			);

			await expect(
				service.acceptTeamInvite(invitee.id, invite.token),
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(await roleNamesOf(invitee.id)).toEqual(["volunteer"]);
			const stored = await db.query.teamInvites.findFirst({
				where: eq(teamInvites.id, invite.id),
			});
			expect(stored?.status).toBe("PENDING");
		});

		it("accepts and declines from the notification by invite id", async () => {
			// The token only travels in the email; the in-app notification
			// carries the invite id, which had nothing to call.
			const { invite, invitee } = await inviteFor("inapp@example.com");
			const stranger = await createUser(db);

			await expect(
				service.acceptTeamInviteById(stranger.id, invite.id),
			).rejects.toBeInstanceOf(ForbiddenException);

			await service.acceptTeamInviteById(invitee.id, invite.id);
			expect(await roleNamesOf(invitee.id)).toEqual(["organisation"]);
			await expect(
				service.acceptTeamInviteById(invitee.id, invite.id),
			).rejects.toBeInstanceOf(ConflictException);

			const other = await inviteFor("declines@example.com");
			await service.declineTeamInviteById(other.invitee.id, other.invite.id);
			const stored = await db.query.teamInvites.findFirst({
				where: eq(teamInvites.id, other.invite.id),
			});
			expect(stored?.status).toBe("DECLINED");
		});

		it("tells a teammate when their role changes and when they are removed", async () => {
			const { owner, org } = await verifiedOrg();
			await db.insert(organizationAdmins).values({
				organizationId: org.id,
				userId: owner.id,
				role: "OWNER",
				isOwner: true,
			});
			const colleague = await createUser(db);
			const member = await service.inviteAdmin(owner.id, {
				email: colleague.email,
				role: "MEMBER",
			});

			await service.updateAdmin(owner.id, member.id, { role: "MANAGER" });
			await service.removeAdmin(owner.id, member.id);

			await vi.waitFor(async () => {
				const sent = await db.query.notifications.findMany({
					where: eq(notifications.userId, colleague.id),
				});
				expect(sent.map((row) => row.type)).toEqual(
					expect.arrayContaining(["TEAM_ROLE_CHANGED", "TEAM_REMOVED"]),
				);
			});
		});

		it("refuses an account that already runs or belongs to another NGO", async () => {
			// getActiveMembership picks one membership with limit(1), so a
			// second would make org/* requests act on an arbitrary NGO.
			const { owner: otherOwner } = await verifiedOrg();
			const { owner } = await verifiedOrg();
			const invite = await service.createTeamInvite(owner.id, {
				email: "busy@example.com",
				role: "MEMBER",
			});
			await db
				.update(users)
				.set({ email: "busy@example.com" })
				.where(eq(users.id, otherOwner.id));

			await expect(
				service.acceptTeamInvite(otherOwner.id, invite.token),
			).rejects.toBeInstanceOf(ConflictException);
		});
	});
});
