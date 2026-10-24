import { randomUUID } from "node:crypto";
import { organizationAdmins } from "@nabhya/db/schema";
import {
	canTeamRole,
	type OrgPermissionAction,
	type TeamRole,
} from "@nabhya/shared";
import { ForbiddenException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { StubStorageProvider } from "../src/common/storage";
import { CertificatesService } from "../src/modules/certificates/certificates.service";
import { DonationsService } from "../src/modules/donations/donations.service";
import { StubPaymentProvider } from "../src/modules/donations/stub-payment.provider";
import { EngagementService } from "../src/modules/engagement/engagement.service";
import { EventsService } from "../src/modules/events/events.service";
import { FeedService } from "../src/modules/feed/feed.service";
import { NeedsService } from "../src/modules/needs/needs.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { PublishingService } from "../src/modules/publishing/publishing.service";
import {
	authUserFor,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * The role × action matrix from epic #10, asserted end to end.
 *
 * For every guarded service call and every non-owner role, the call must 403
 * exactly when `ROLE_PERMISSIONS` says the role lacks the action - and must
 * get past the permission check otherwise. Every one of these methods checks
 * its permission before loading anything, so the calls use made-up ids: a
 * permitted role then fails later with a 404 or 400, which is the point - it
 * was not refused *for its role*.
 *
 * The matrix is derived from `canTeamRole`, not restated, so changing
 * `ROLE_PERMISSIONS` changes the expectations with it; what this test pins is
 * that every server path actually consults it.
 */
describe("team permission matrix", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let services: ReturnType<typeof build>;

	function build(database: TestDb) {
		const audit = new AuditService(database as never);
		const notifications = new NotificationsService(database as never);
		const organizations = new OrganizationsService(
			database as never,
			audit,
			null as never,
		);
		return {
			needs: new NeedsService(
				database as never,
				audit,
				organizations,
				notifications,
				null as never,
			),
			events: new EventsService(
				database as never,
				audit,
				organizations,
				notifications,
				null as never,
			),
			certificates: new CertificatesService(
				database as never,
				audit,
				new StubStorageProvider(),
				notifications,
				organizations,
			),
			donations: new DonationsService(
				database as never,
				audit,
				new StubPaymentProvider(),
				notifications,
				organizations,
				new StubStorageProvider(),
				null as never,
			),
			engagement: new EngagementService(
				database as never,
				audit,
				notifications,
				organizations,
			),
			publishing: new PublishingService(
				database as never,
				audit,
				notifications,
				organizations,
				{ assertUploaded: async () => undefined } as never,
				{ sendTeamInvite: async () => undefined } as never,
			),
			feed: new FeedService(
				database as never,
				new StubStorageProvider(),
				{
					createEmptyFeedMediaFolder: () => "feed-media/test",
					assertFeedMediaKeys: async () => undefined,
				} as never,
				audit,
				organizations,
			),
			organizations,
		};
	}

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		services = build(db);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	const id = () => randomUUID();

	/** One call per guarded path, keyed by the action it must consult. */
	const CALLS: Array<{
		action: OrgPermissionAction;
		name: string;
		call: (userId: string) => Promise<unknown>;
	}> = [
		{
			action: "content.publish",
			name: "create a need",
			call: (u) =>
				services.needs.create(u, {
					type: "WANT",
					title: "Winter blankets",
					description: "Blankets for the night shelter this winter.",
					city: "Mumbai",
					state: "Maharashtra",
				} as never),
		},
		{
			action: "content.publish",
			name: "publish an event",
			call: (u) =>
				services.events.create(u, {
					title: "Beach cleanup",
					description: "A description long enough to satisfy validation.",
					city: "Mumbai",
					state: "Maharashtra",
					startAt: new Date(Date.now() + 86_400_000),
					endAt: new Date(Date.now() + 90_000_000),
					volunteersNeeded: 5,
					status: "PUBLISHED",
					isUrgent: false,
				}),
		},
		{
			action: "content.publish",
			name: "publish an update",
			call: (u) =>
				services.publishing.createAnnouncement(u, {
					title: "Winter drive begins",
					body: "We are collecting blankets across three wards.",
					status: "PUBLISHED",
					isPinned: false,
					isUrgent: false,
				}),
		},
		{
			action: "content.publish",
			name: "post to the feed",
			call: (u) =>
				services.feed.create(
					authUserFor({ id: u, email: "x@example.com", fullName: null }, [
						"organisation",
					]),
					{
						text: "We distributed 200 blankets.",
						type: "POST",
						isUrgent: false,
						mediaKeys: [],
					} as never,
				),
		},
		{
			action: "content.publish",
			name: "reply to a review",
			call: (u) =>
				services.engagement.replyToReview(u, id(), { reply: "Thank you!" }),
		},
		{
			action: "content.delete",
			name: "remove a need",
			call: (u) => services.needs.remove(u, id()),
		},
		{
			action: "content.delete",
			name: "remove an event",
			call: (u) => services.events.remove(u, id()),
		},
		{
			action: "content.delete",
			name: "delete an update",
			call: (u) => services.publishing.deleteAnnouncement(u, id()),
		},
		{
			action: "people.review",
			name: "review an application",
			call: (u) =>
				services.events.reviewApplication(u, id(), id(), {
					status: "ACCEPTED",
				} as never),
		},
		{
			action: "people.review",
			name: "review a pledge",
			call: (u) =>
				services.needs.reviewPledge(u, id(), id(), {
					status: "ACCEPTED",
				} as never),
		},
		{
			action: "people.attendance",
			name: "mark attendance",
			call: (u) =>
				services.certificates.markAttendance(u, id(), id(), {
					attended: true,
				}),
		},
		{
			action: "certs.issue",
			name: "issue a certificate",
			call: (u) => services.certificates.issue(u, id(), id(), {}),
		},
		{
			action: "certs.revoke",
			name: "revoke a certificate",
			call: (u) =>
				services.certificates.revoke(u, id(), {
					reason: "Issued by mistake",
				}),
		},
		{
			action: "money.view",
			name: "list donations",
			call: (u) =>
				services.donations.listForMyOrganization(u, {
					page: 1,
					limit: 20,
				} as never),
		},
		{
			action: "reports.manage",
			name: "publish a financial report",
			call: (u) =>
				services.publishing.createFinancialReport(u, {
					type: "ANNUAL_REPORT",
					title: "Annual report 2025",
					financialYear: 2025,
					documentKey: "financial-reports/x/report.pdf",
				} as never),
		},
		{
			action: "org.edit",
			name: "edit the organisation",
			call: (u) =>
				services.organizations.updateMyOrganization(u, {
					description: "Updated description for the profile.",
				}),
		},
		{
			action: "team.invite",
			name: "invite a teammate",
			call: (u) =>
				services.publishing.createTeamInvite(u, {
					email: `new-${id()}@example.com`,
					role: "MEMBER",
				} as never),
		},
		{
			action: "team.changeRole",
			name: "change a teammate",
			call: (u) =>
				services.publishing.updateAdmin(u, id(), { designation: "Lead" }),
		},
		{
			action: "team.remove",
			name: "remove a teammate",
			call: (u) => services.publishing.removeAdmin(u, id()),
		},
	];

	const ROLES: Array<Exclude<TeamRole, "OWNER">> = [
		"ADMIN",
		"MANAGER",
		"MEMBER",
		"VIEWER",
	];

	/** A verified NGO with an owner row and one teammate in `role`. */
	async function teammate(role: Exclude<TeamRole, "OWNER">) {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		await db.insert(organizationAdmins).values([
			{
				organizationId: org.id,
				userId: owner.id,
				role: "OWNER",
				isOwner: true,
				status: "ACTIVE",
			},
		]);
		const member = await createUser(db, { role: "organisation" });
		await db.insert(organizationAdmins).values({
			organizationId: org.id,
			userId: member.id,
			role,
			status: "ACTIVE",
		});
		return member;
	}

	it("shuts a suspended or departed teammate out of every guarded call", async () => {
		// Epic #10: "leavers lose access instantly" - membership is resolved per
		// request, so the next call after a status change must already fail.
		for (const status of ["SUSPENDED", "LEFT", "REMOVED"] as const) {
			const member = await teammate("ADMIN");
			await db
				.update(organizationAdmins)
				.set({ status })
				.where(eq(organizationAdmins.userId, member.id));

			for (const { name, call } of CALLS) {
				const error = await call(member.id).then(
					() => null,
					(caught: unknown) => caught,
				);
				expect(error, `${status} teammate: ${name}`).toBeInstanceOf(
					ForbiddenException,
				);
			}
		}
	});

	for (const role of ROLES) {
		describe(role, () => {
			for (const { action, name, call } of CALLS) {
				const allowed = canTeamRole(role, action);
				it(`${allowed ? "may" : "may not"} ${name} (${action})`, async () => {
					const member = await teammate(role);
					const error = await call(member.id).then(
						() => null,
						(caught: unknown) => caught,
					);
					if (allowed) {
						expect(error).not.toBeInstanceOf(ForbiddenException);
					} else {
						expect(error).toBeInstanceOf(ForbiddenException);
					}
				});
			}
		});
	}
});
