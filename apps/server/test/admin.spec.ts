import {
	categories,
	donations,
	organizationCategories,
	organizationDocuments,
	posts,
	postsMedia,
	reviews,
	userCategories,
} from "@nabhya/db/schema";
import {
	adminActivityQuerySchema,
	adminAnalyticsQuerySchema,
	adminOrgPostsQuerySchema,
	adminOrgQuerySchema,
	adminUserQuerySchema,
	auditLogQuerySchema,
	documentQueueQuerySchema,
} from "@nabhya/shared";
import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { AdminService } from "../src/modules/admin/admin.service";
import { EventsService } from "../src/modules/events/events.service";
import { FeedService } from "../src/modules/feed/feed.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	authUserFor,
	createApplication,
	createEvent,
	createNeed,
	createOrganization,
	createPledge,
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
	let feed: FeedService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		service = new AdminService(db as never, audit);
		feed = new FeedService(
			db as never,
			{
				createDownloadUrl: async (key: string) => `https://storage.test/${key}`,
				delete: async () => undefined,
			} as never,
			null as never,
			audit,
			null as never,
		);
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
			const storedNeeds = await db.query.needs.findMany({});
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

			// Through the schema, not a literal: `sort` and `dir` have defaults
			// and the service is called here without the validation pipe that
			// would apply them.
			const result = await service.listOrganizations(
				adminOrgQuerySchema.parse({ page: 1, limit: 20 }),
			);

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

			const result = await service.listUsers(
				adminUserQuerySchema.parse({ page: 1, limit: 20, role: "volunteer" }),
			);

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

			const result = await service.listUsers(
				adminUserQuerySchema.parse({ page: 1, limit: 20, role: "volunteer" }),
			);

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.id).toBe(volunteer.id);
			expect(result.meta.total).toBe(1);
		});
	});

	describe("sorting", () => {
		/**
		 * Sorting is server-side, so these assert the *whole* set is ordered
		 * rather than the page. Each goes through the query schema, not a
		 * literal: `sort` and `dir` have defaults and the service is called here
		 * without the validation pipe that would apply them.
		 */
		it("orders organizations by name in both directions", async () => {
			for (const name of ["Zebra Trust", "Aardvark Aid", "Mango Mission"]) {
				const owner = await createUser(db, { role: "organisation" });
				await createOrganization(db, owner.id, { name });
			}

			const ascending = await service.listOrganizations(
				adminOrgQuerySchema.parse({ sort: "name", dir: "asc" }),
			);
			expect(ascending.items.map((o) => o.organizationName)).toEqual([
				"Aardvark Aid",
				"Mango Mission",
				"Zebra Trust",
			]);

			const descending = await service.listOrganizations(
				adminOrgQuerySchema.parse({ sort: "name", dir: "desc" }),
			);
			expect(descending.items.map((o) => o.organizationName)).toEqual([
				"Zebra Trust",
				"Mango Mission",
				"Aardvark Aid",
			]);
		});

		it("orders organizations by a correlated count, not just a column", async () => {
			// `pendingDocuments` and `events` are subqueries in the select list,
			// which is the case a plain column lookup would get wrong.
			const busyOwner = await createUser(db, { role: "organisation" });
			const busy = await createOrganization(db, busyOwner.id, {
				name: "Busy",
			});
			const quietOwner = await createUser(db, { role: "organisation" });
			await createOrganization(db, quietOwner.id, { name: "Quiet" });

			await createEvent(db, busy.id);
			await createEvent(db, busy.id);

			const result = await service.listOrganizations(
				adminOrgQuerySchema.parse({ sort: "events", dir: "desc" }),
			);

			expect(result.items[0]?.organizationName).toBe("Busy");
			expect(result.items[0]?.eventCount).toBe(2);
		});

		it("pages deterministically when every row shares the sort key", async () => {
			// All six have the same verification status, so the tiebreaker is the
			// only thing keeping page 2 from repeating rows from page 1.
			for (let index = 0; index < 6; index += 1) {
				const owner = await createUser(db, { role: "organisation" });
				await createOrganization(db, owner.id, { name: `Org ${index}` });
			}

			const first = await service.listOrganizations(
				adminOrgQuerySchema.parse({
					sort: "verificationStatus",
					dir: "asc",
					page: 1,
					limit: 3,
				}),
			);
			const second = await service.listOrganizations(
				adminOrgQuerySchema.parse({
					sort: "verificationStatus",
					dir: "asc",
					page: 2,
					limit: 3,
				}),
			);

			const ids = [...first.items, ...second.items].map((o) => o.id);
			expect(new Set(ids).size).toBe(6);
		});

		it("orders users by application count", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);

			const keen = await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "volunteer" });
			await createApplication(db, event.id, keen.id);

			const result = await service.listUsers(
				adminUserQuerySchema.parse({
					role: "volunteer",
					sort: "applications",
					dir: "desc",
				}),
			);

			expect(result.items[0]?.id).toBe(keen.id);
			expect(result.items[0]?.applicationCount).toBe(1);
		});

		it("orders the identity queue by the name of the person it belongs to", async () => {
			const zoe = await createUser(db, {
				role: "volunteer",
				fullName: "Zoe Last",
			});
			const amit = await createUser(db, {
				role: "volunteer",
				fullName: "Amit First",
			});
			await createUserDocument(db, zoe.id);
			await createUserDocument(db, amit.id);

			const result = await service.listUserDocuments(
				documentQueueQuerySchema.parse({ sort: "owner", dir: "asc" }),
			);

			expect(result.items[0]?.user.fullName).toBe("Amit First");
		});
	});

	describe("bulk document review", () => {
		it("approves every selected document and audits each one separately", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const idCard = await createUserDocument(db, volunteer.id, {
				documentType: "AADHAR_CARD",
			});
			const selfie = await createUserDocument(db, volunteer.id, {
				documentType: "SELFIE",
			});

			const result = await service.bulkReviewDocuments(admin.id, "user", {
				ids: [idCard.id, selfie.id],
				verificationStatus: "VERIFIED",
			});

			expect(result.reviewed).toHaveLength(2);
			expect(result.failed).toHaveLength(0);

			// One audit row per decision. A single "2 approved" entry cannot
			// answer "who approved this document", which is the only question
			// anyone asks of the trail.
			const trail = await service.listAuditLogs(
				auditLogQuerySchema.parse({ action: "USER_DOCUMENT_VERIFIED" }),
			);
			expect(trail.meta.total).toBe(2);
		});

		it("re-derives the account status once both identity documents pass", async () => {
			// The bulk path must not bypass `computeUserVerificationStatus`:
			// approving an ID on its own never promotes an account.
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const idCard = await createUserDocument(db, volunteer.id, {
				documentType: "AADHAR_CARD",
			});
			const selfie = await createUserDocument(db, volunteer.id, {
				documentType: "SELFIE",
			});

			await service.bulkReviewDocuments(admin.id, "user", {
				ids: [idCard.id],
				verificationStatus: "VERIFIED",
			});
			let dossier = await service.getUserDetail(volunteer.id);
			expect(dossier.verificationStatus).not.toBe("VERIFIED");

			await service.bulkReviewDocuments(admin.id, "user", {
				ids: [selfie.id],
				verificationStatus: "VERIFIED",
			});
			dossier = await service.getUserDetail(volunteer.id);
			expect(dossier.verificationStatus).toBe("VERIFIED");
		});

		it("reports a bad id without abandoning the good ones", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const real = await createUserDocument(db, volunteer.id);
			const missing = "00000000-0000-4000-8000-000000000000";

			const result = await service.bulkReviewDocuments(admin.id, "user", {
				ids: [real.id, missing],
				verificationStatus: "VERIFIED",
			});

			expect(result.reviewed).toEqual([real.id]);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0]?.id).toBe(missing);
		});

		it("reviews a repeated id once", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const volunteer = await createUser(db, { role: "volunteer" });
			const document = await createUserDocument(db, volunteer.id);

			const result = await service.bulkReviewDocuments(admin.id, "user", {
				ids: [document.id, document.id],
				verificationStatus: "VERIFIED",
			});

			expect(result.reviewed).toEqual([document.id]);

			const trail = await service.listAuditLogs(
				auditLogQuerySchema.parse({ action: "USER_DOCUMENT_VERIFIED" }),
			);
			expect(trail.meta.total).toBe(1);
		});
	});

	describe("admin post moderation", () => {
		it("lists one NGO's posts with media for superadmin review", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const otherOwner = await createUser(db, { role: "organisation" });
			const otherOrg = await createOrganization(db, otherOwner.id);

			const [post] = await db
				.insert(posts)
				.values({
					authorUserId: owner.id,
					organizationId: org.id,
					mediaFolder: "202609091700-abcd12",
					text: "We served lunch today",
					tag: "POST",
				})
				.returning();
			if (!post) throw new Error("post insert failed");
			await db.insert(postsMedia).values({
				postId: post.id,
				objectKey: "feed/example/photo.jpg",
				mediaType: "IMAGE",
				mimeType: "image/jpeg",
				sortOrder: 0,
			});
			await db.insert(posts).values({
				authorUserId: otherOwner.id,
				organizationId: otherOrg.id,
				mediaFolder: "202609091701-abcd12",
				text: "Other org post",
				tag: "POST",
			});

			const result = await feed.listOrganizationPosts(
				org.id,
				adminOrgPostsQuerySchema.parse({ page: 1, limit: 20 }),
			);

			expect(result.items).toHaveLength(1);
			expect(result.items[0]?.text).toBe("We served lunch today");
			expect(result.items[0]?.media[0]?.url).toBe(
				"https://storage.test/feed/example/photo.jpg",
			);
		});

		it("lets a superadmin delete an NGO post", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const [post] = await db
				.insert(posts)
				.values({
					authorUserId: owner.id,
					organizationId: org.id,
					mediaFolder: "202609091702-abcd12",
					text: "Remove me",
					tag: "POST",
				})
				.returning();
			if (!post) throw new Error("post insert failed");

			await feed.remove(authUserFor(admin, ["superadmin"]), post.id);

			const remaining = await db.query.posts.findFirst({
				where: (table, { eq }) => eq(table.id, post.id),
			});
			expect(remaining).toBeUndefined();
		});
	});

	describe("activity timelines", () => {
		it("returns a flat, groupable NGO activity feed with optional kind filters", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { title: "Food drive" });
			const volunteer = await createUser(db, {
				role: "volunteer",
				fullName: "Asha Volunteer",
			});
			await createApplication(db, event.id, volunteer.id);
			const need = await createNeed(db, org.id);
			await createPledge(db, need.id, volunteer.id);

			const all = await service.listOrganizationActivity(
				org.id,
				adminActivityQuerySchema.parse({ page: 1, limit: 20 }),
			);

			expect(all.items.map((item) => item.kind)).toEqual(
				expect.arrayContaining(["EVENT", "APPLICATION", "NEED", "PLEDGE"]),
			);
			expect(all.items[0]?.groupKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(all.meta.total).toBeGreaterThanOrEqual(4);

			const applications = await service.listOrganizationActivity(
				org.id,
				adminActivityQuerySchema.parse({ kind: "APPLICATION" }),
			);
			expect(applications.items).toHaveLength(1);
			expect(applications.items[0]?.actor?.name).toBe("Asha Volunteer");
		});

		it("returns a volunteer's mixed participation and contribution activity", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id, { title: "Tree planting" });
			const volunteer = await createUser(db, { role: "volunteer" });
			await createApplication(db, event.id, volunteer.id);
			const need = await createNeed(db, org.id);
			await createPledge(db, need.id, volunteer.id);

			const activity = await service.listUserActivity(
				volunteer.id,
				adminActivityQuerySchema.parse({ page: 1, limit: 20 }),
			);

			expect(activity.items.map((item) => item.kind)).toEqual(
				expect.arrayContaining(["APPLICATION", "PLEDGE"]),
			);
			expect(
				activity.items.every((item) => item.actor?.id === volunteer.id),
			).toBe(true);
		});
	});

	describe("analytics", () => {
		it("returns chart-ready distribution, funnel, queue and donation aggregates", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				name: "Analytics NGO",
			});
			const volunteer = await createUser(db, { role: "volunteer" });
			const event = await createEvent(db, org.id);
			await createApplication(db, event.id, volunteer.id, {
				status: "ACCEPTED",
			});
			await db.insert(organizationDocuments).values({
				organizationId: org.id,
				documentType: "NGO_REGISTRATION_CERTIFICATE",
				documentKey: `org-documents/${org.id}/registration.pdf`,
			});
			await db.insert(donations).values({
				organizationId: org.id,
				donorUserId: volunteer.id,
				amountMinor: 50000,
				status: "COMPLETED",
				completedAt: new Date(),
			});
			await db.insert(reviews).values({
				organizationId: org.id,
				userId: volunteer.id,
				rating: 5,
				body: "Helpful team",
			});
			const [category] = await db
				.insert(categories)
				.values({ name: "Education", slug: "education" })
				.returning();
			if (!category) throw new Error("category insert failed");
			await db
				.insert(organizationCategories)
				.values({ organizationId: org.id, categoryId: category.id });
			await db
				.insert(userCategories)
				.values({ userId: volunteer.id, categoryId: category.id });

			const analytics = await service.getAnalytics(
				adminAnalyticsQuerySchema.parse({ days: 7, limit: 5 }),
			);

			expect(analytics.locations.organizations[0]?.label).toBe("Mumbai");
			expect(analytics.categories.organizations[0]?.label).toBe("Education");
			expect(analytics.applicationFunnel).toContainEqual({
				label: "ACCEPTED",
				value: 1,
			});
			expect(analytics.reviewQueues.pending.organizationDocuments).toBe(1);
			expect(analytics.topOrganizations[0]?.organizationName).toBe(
				"Analytics NGO",
			);
			expect(analytics.donations.totalAmountMinor).toBe(50000);
			expect(analytics.donations.points).toHaveLength(7);
		});
	});

	describe("overview trends", () => {
		it("zero-fills every day in the window", async () => {
			// A GROUP BY only returns days that had a row; a line drawn across the
			// gaps would claim steady activity where there was none.
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id);

			const trends = await service.getTrends(7);

			expect(trends.days).toBe(7);
			expect(trends.points).toHaveLength(7);
			expect(
				trends.points.every((p) => typeof p.organizations === "number"),
			).toBe(true);
			// Today's bucket has the one signup; the rest are real zeros.
			expect(trends.totals.organizations).toBe(1);
			expect(trends.points.filter((p) => p.organizations > 0)).toHaveLength(1);
		});

		it("counts volunteers by role, not every account", async () => {
			await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "volunteer" });
			await createUser(db, { role: "organisation" });

			const trends = await service.getTrends(7);

			expect(trends.totals.volunteers).toBe(2);
		});

		it("sums the window before as well, for the delta", async () => {
			const trends = await service.getTrends(30);

			expect(trends.points).toHaveLength(30);
			expect(trends.previousTotals).toEqual({
				organizations: 0,
				volunteers: 0,
				events: 0,
				applications: 0,
			});
		});

		it("plots the current window only", async () => {
			const trends = await service.getTrends(7);
			const first = trends.points[0]?.date;
			const last = trends.points[6]?.date;

			// Ascending, and ending today. Compared as plain strings, which is
			// exactly what `YYYY-MM-DD` is sortable as.
			expect(first).toBeDefined();
			expect(last).toBeDefined();
			expect(String(first) < String(last)).toBe(true);
			expect(last).toBe(new Date().toISOString().slice(0, 10));
		});
	});
});
