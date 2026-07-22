import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { AdminService } from "../src/modules/admin/admin.service";
import { EventsService } from "../src/modules/events/events.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	createApplication,
	createEvent,
	createNeed,
	createOrganization,
	createUser,
	createUserDocument,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("AdminService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: AdminService;
	let events: EventsService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		service = new AdminService(db as never, audit);
		events = new EventsService(
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

	describe("organization moderation", () => {
		it("records who approved and when", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			const updated = await service.reviewOrganization(admin.id, org.id, {
				verificationStatus: "VERIFIED",
			});

			expect(updated?.verificationStatus).toBe("VERIFIED");
			expect(updated?.reviewedBy).toBe(admin.id);
			expect(updated?.reviewedAt).toBeTruthy();
		});

		it("stores the rejection reason and clears it on later approval", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			await service.reviewOrganization(admin.id, org.id, {
				verificationStatus: "REJECTED",
				reason: "Registration certificate unreadable",
			});
			let stored = await db.query.organizations.findFirst({});
			expect(stored?.rejectionReason).toContain("unreadable");

			await service.reviewOrganization(admin.id, org.id, {
				verificationStatus: "VERIFIED",
			});
			stored = await db.query.organizations.findFirst({});
			// A stale rejection reason on a verified NGO would be shown to them.
			expect(stored?.rejectionReason).toBeNull();
		});

		it("suspending an NGO pulls its content off the public feed", async () => {
			// Volunteers must stop being able to apply the moment an NGO is
			// suspended — leaving events live would keep taking applications.
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await createEvent(db, org.id, { status: "PUBLISHED" });
			await createNeed(db, org.id, { status: "OPEN" });

			await service.setOrganizationStatus(admin.id, org.id, {
				status: "SUSPENDED",
				reason: "Under investigation",
			});

			const storedEvents = await db.query.events.findMany({});
			const storedNeeds = await db.query.organizationNeeds.findMany({});
			expect(storedEvents[0]?.status).toBe("CANCELLED");
			expect(storedNeeds[0]?.status).toBe("CLOSED");

			const feed = await events.listPublic({
				page: 1,
				limit: 20,
				when: "upcoming",
			});
			expect(feed.items).toHaveLength(0);
		});

		it("leaves drafts untouched when suspending", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			await createEvent(db, org.id, { status: "DRAFT" });

			await service.setOrganizationStatus(admin.id, org.id, {
				status: "SUSPENDED",
				reason: "Under investigation",
			});

			const stored = await db.query.events.findMany({});
			expect(stored[0]?.status).toBe("DRAFT");
		});
	});

	describe("user moderation", () => {
		it("refuses to let an admin change their own status", async () => {
			// Otherwise a mis-click can lock the last administrator out.
			const admin = await createUser(db, { role: "superadmin" });

			await expect(
				service.setUserStatus(admin.id, admin.id, {
					status: "SUSPENDED",
					reason: "oops",
				}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("records the reason and clears it on reinstatement", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const user = await createUser(db, { role: "volunteer" });

			await service.setUserStatus(admin.id, user.id, {
				status: "SUSPENDED",
				reason: "Repeated no-shows",
			});
			let stored = await db.query.users.findFirst({});

			await service.setUserStatus(admin.id, user.id, { status: "ACTIVE" });
			stored = await db.query.users
				.findMany({})
				.then((rows) => rows.find((r) => r.id === user.id));
			expect(stored?.status).toBe("ACTIVE");
			expect(stored?.suspendedReason).toBeNull();
		});
	});

	describe("identity verification", () => {
		it("keeps the account PENDING until both a government ID and a selfie are approved", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const govId = await createUserDocument(db, volunteer.id, {
				documentType: "AADHAR_CARD",
			});
			await createUserDocument(db, volunteer.id, { documentType: "SELFIE" });

			// Approving only the ID must not promote the account on its own.
			await service.reviewUserDocument(admin.id, govId.id, {
				verificationStatus: "VERIFIED",
			});

			const user = await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, volunteer.id),
			});
			expect(user?.verificationStatus).toBe("PENDING");
		});

		it("verifies the account once both required documents are approved", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const govId = await createUserDocument(db, volunteer.id, {
				documentType: "PAN_CARD",
			});
			const selfie = await createUserDocument(db, volunteer.id, {
				documentType: "SELFIE",
			});

			await service.reviewUserDocument(admin.id, govId.id, {
				verificationStatus: "VERIFIED",
			});
			await service.reviewUserDocument(admin.id, selfie.id, {
				verificationStatus: "VERIFIED",
			});

			const user = await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, volunteer.id),
			});
			expect(user?.verificationStatus).toBe("VERIFIED");
		});

		it("rejecting a required document rejects the account", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const govId = await createUserDocument(db, volunteer.id, {
				documentType: "AADHAR_CARD",
			});
			const selfie = await createUserDocument(db, volunteer.id, {
				documentType: "SELFIE",
			});

			await service.reviewUserDocument(admin.id, govId.id, {
				verificationStatus: "VERIFIED",
			});
			await service.reviewUserDocument(admin.id, selfie.id, {
				verificationStatus: "REJECTED",
				remarks: "Face not clearly visible",
			});

			const user = await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, volunteer.id),
			});
			expect(user?.verificationStatus).toBe("REJECTED");
		});

		it("stays VERIFIED when an unrelated extra document is later rejected", async () => {
			// The approved ID + selfie still stand, so rejecting a spare document
			// must not knock an already-verified volunteer back out.
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const govId = await createUserDocument(db, volunteer.id, {
				documentType: "AADHAR_CARD",
			});
			const selfie = await createUserDocument(db, volunteer.id, {
				documentType: "SELFIE",
			});
			await service.reviewUserDocument(admin.id, govId.id, {
				verificationStatus: "VERIFIED",
			});
			await service.reviewUserDocument(admin.id, selfie.id, {
				verificationStatus: "VERIFIED",
			});

			const extra = await createUserDocument(db, volunteer.id, {
				documentType: "OTHER",
			});
			await service.reviewUserDocument(admin.id, extra.id, {
				verificationStatus: "REJECTED",
				remarks: "Duplicate, not required",
			});

			const user = await db.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, volunteer.id),
			});
			expect(user?.verificationStatus).toBe("VERIFIED");
		});
	});

	describe("overview", () => {
		it("returns a fully zeroed payload on an empty platform", async () => {
			// Every tile renders these directly; an undefined would crash the UI.
			const overview = await service.getOverview();

			expect(overview.organizations.total).toBe(0);
			expect(overview.users.volunteers).toBe(0);
			expect(overview.events.upcoming).toBe(0);
			expect(overview.needs.open).toBe(0);
			expect(overview.applications.pending).toBe(0);
			expect(overview.documents.pendingOrgDocuments).toBe(0);
		});

		it("counts by role and verification state", async () => {
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});
			const other = await createUser(db, { role: "organisation" });
			await createOrganization(db, other.id, {
				verificationStatus: "VERIFIED",
			});
			await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "volunteer" });

			const overview = await service.getOverview();

			expect(overview.organizations.total).toBe(2);
			expect(overview.organizations.pending).toBe(1);
			expect(overview.organizations.verified).toBe(1);
			expect(overview.users.volunteers).toBe(2);
			expect(overview.users.organisations).toBe(2);
		});

		it("counts pending applications across the platform", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const a = await createUser(db, { role: "volunteer" });
			const b = await createUser(db, { role: "volunteer" });
			await createApplication(db, event.id, a.id, { status: "PENDING" });
			await createApplication(db, event.id, b.id, { status: "ACCEPTED" });

			const overview = await service.getOverview();
			expect(overview.applications.total).toBe(2);
			expect(overview.applications.pending).toBe(1);
			expect(overview.applications.accepted).toBe(1);
		});
	});

	describe("correlated counts", () => {
		// These are computed with hand-written subqueries because interpolated
		// columns render unqualified and bind to the wrong table. Each assertion
		// here exists because the value silently read zero.
		it("reports real event, need and pending-document counts per NGO", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await createEvent(db, org.id);
			await createEvent(db, org.id);
			await createNeed(db, org.id);

			const result = await service.listOrganizations({ page: 1, limit: 20 });

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.eventCount).toBe(2);
			expect(result.items[0]?.needCount).toBe(1);
			expect(result.items[0]?.pendingDocuments).toBe(0);
		});

		it("reports each user's real roles and participation counts", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });

			await createApplication(db, event.id, volunteer.id, {
				status: "ACCEPTED",
			});

			const result = await service.listUsers({
				page: 1,
				limit: 20,
				role: "volunteer",
			});

			const row = result.items[0];
			expect(row?.roles).toEqual(["volunteer"]);
			expect(row?.applicationCount).toBe(1);
			expect(row?.acceptedCount).toBe(1);
			expect(row?.pledgeCount).toBe(0);
		});
	});

	describe("user listing", () => {
		it("filters by role without duplicating multi-role users", async () => {
			// The role filter uses EXISTS rather than a join for exactly this —
			// a join would return one row per matching role.
			const volunteer = await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "organisation" });

			const result = await service.listUsers({
				page: 1,
				limit: 20,
				role: "volunteer",
			});

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.id).toBe(volunteer.id);
			expect(result.meta.total).toBe(1);
		});
	});
});
