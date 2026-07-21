import { categories, organizationAdmins, users } from "@nabhya/db/schema";
import type { CompleteOrgOnboardingInput } from "@nabhya/shared";
import { ConflictException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { OnboardingService } from "../src/modules/onboarding/onboarding.service";
import { UsersService } from "../src/modules/users/users.service";
import {
	authUserFor,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Onboarding decides where every account lands on launch, so a wrong answer
 * here is either a locked-out user or an infinite redirect — both of which
 * have already happened once.
 */
describe("OnboardingService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: OnboardingService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		const usersService = new UsersService(db as never, audit, null as never);
		service = new OnboardingService(db as never, audit, usersService);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	const orgPayload: CompleteOrgOnboardingInput = {
		orgName: "Sahaara Foundation",
		orgType: "trust",
		registrationNumber: "MH/2019/0012345",
		phone: "9876543210",
		address: "12 Linking Road, Bandra West",
		city: "Mumbai",
		state: "Maharashtra",
		pincode: "400050",
	};

	describe("status", () => {
		it("asks a brand-new account to pick a role", async () => {
			const user = await createUser(db);

			const status = await service.getStatus(authUserFor(user, []));

			expect(status.role).toBeNull();
			expect(status.needsRoleSelection).toBe(true);
			expect(status.isOnboarded).toBe(false);
		});

		it("reports a volunteer as not onboarded until the wizard is done", async () => {
			const user = await createUser(db, { role: "volunteer" });

			const before = await service.getStatus(authUserFor(user, ["volunteer"]));
			expect(before.needsRoleSelection).toBe(false);
			expect(before.isOnboarded).toBe(false);

			await service.completeVolunteerOnboarding(
				authUserFor(user, ["volunteer"]),
				{
					fullName: "Asha Menon",
					phone: "9876543210",
					city: "Pune",
					state: "Maharashtra",
					categoryIds: [],
				},
			);

			const after = await service.getStatus(authUserFor(user, ["volunteer"]));
			expect(after.isOnboarded).toBe(true);
		});

		it("treats the organization row as the NGO's completion signal", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const auth = authUserFor(owner, ["organisation"]);

			expect((await service.getStatus(auth)).isOnboarded).toBe(false);

			await createOrganization(db, owner.id, { verificationStatus: "PENDING" });

			const status = await service.getStatus(auth);
			expect(status.isOnboarded).toBe(true);
			expect(status.organization).not.toBeNull();
			expect(status.verificationStatus).toBe("PENDING");
		});

		it("never asks an NGO to re-select a role once it has one", async () => {
			// The redirect loop came from this: the gate saw no role and bounced
			// back to role-select even though the account already had one.
			const owner = await createUser(db, { role: "organisation" });
			const status = await service.getStatus(
				authUserFor(owner, ["organisation"]),
			);

			expect(status.needsRoleSelection).toBe(false);
		});
	});

	describe("organization onboarding", () => {
		it("creates the NGO, its owner admin row, and stamps the user", async () => {
			const owner = await createUser(db, { role: "organisation" });

			const org = await service.completeOrganizationOnboarding(
				authUserFor(owner, ["organisation"]),
				orgPayload,
			);

			expect(org.organizationName).toBe("Sahaara Foundation");
			expect(org.orgType).toBe("TRUST");
			// Always PENDING — an NGO cannot self-verify.
			expect(org.verificationStatus).toBe("PENDING");
			expect(org.email).toBe(owner.email);

			const admin = await db.query.organizationAdmins.findFirst({
				where: eq(organizationAdmins.organizationId, org.id),
			});
			expect(admin?.userId).toBe(owner.id);
			expect(admin?.isOwner).toBe(true);

			const stamped = await db.query.users.findFirst({
				where: eq(users.id, owner.id),
			});
			expect(stamped?.onboardedAt).not.toBeNull();
			expect(stamped?.city).toBe("Mumbai");
		});

		it("refuses a second organization for the same account", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const auth = authUserFor(owner, ["organisation"]);

			await service.completeOrganizationOnboarding(auth, orgPayload);

			await expect(
				service.completeOrganizationOnboarding(auth, {
					...orgPayload,
					orgName: "A Second NGO",
				}),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("stores an empty website as null rather than an empty string", async () => {
			const owner = await createUser(db, { role: "organisation" });

			const org = await service.completeOrganizationOnboarding(
				authUserFor(owner, ["organisation"]),
				{ ...orgPayload, website: "" },
			);

			expect(org.website).toBeNull();
		});

		it("records the optional wizard fields instead of dropping them", async () => {
			// These are collected by the client, so they have to land somewhere.
			const owner = await createUser(db, { role: "organisation" });

			const org = await service.completeOrganizationOnboarding(
				authUserFor(owner, ["organisation"]),
				{
					...orgPayload,
					teamSize: 24,
					foundingYear: 2011,
					description: "Runs after-school programmes across Mumbai.",
				},
			);

			expect(org.teamSize).toBe(24);
			expect(org.foundingYear).toBe(2011);
			expect(org.description).toContain("after-school");
		});
	});

	describe("volunteer onboarding", () => {
		it("saves the profile and the selected interests", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const [cause] = await db
				.insert(categories)
				.values([
					{ name: "Education", slug: "education" },
					{ name: "Environment", slug: "environment" },
				])
				.returning();
			if (!cause) throw new Error("category insert failed");

			await service.completeVolunteerOnboarding(
				authUserFor(user, ["volunteer"]),
				{
					fullName: "Asha Menon",
					phone: "9876543210",
					city: "Pune",
					state: "Maharashtra",
					bio: "Weekend teacher.",
					categoryIds: [cause.id],
				},
			);

			const saved = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(saved?.fullName).toBe("Asha Menon");
			expect(saved?.bio).toBe("Weekend teacher.");
			expect(saved?.onboardedAt).not.toBeNull();

			const interests = await db.query.userCategories.findMany();
			expect(interests).toHaveLength(1);
			expect(interests[0]?.categoryId).toBe(cause.id);
		});

		it("replaces interests on re-submission rather than accumulating them", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const inserted = await db
				.insert(categories)
				.values([
					{ name: "Education", slug: "education" },
					{ name: "Health", slug: "health" },
				])
				.returning();
			const [first, second] = inserted;
			if (!first || !second) throw new Error("category insert failed");

			const auth = authUserFor(user, ["volunteer"]);
			const base = {
				fullName: "Asha Menon",
				phone: "9876543210",
				city: "Pune",
				state: "Maharashtra",
			};

			await service.completeVolunteerOnboarding(auth, {
				...base,
				categoryIds: [first.id],
			});
			await service.completeVolunteerOnboarding(auth, {
				...base,
				categoryIds: [second.id],
			});

			const interests = await db.query.userCategories.findMany();
			expect(interests).toHaveLength(1);
			expect(interests[0]?.categoryId).toBe(second.id);
		});

		it("clears interests when the submitted selection is empty", async () => {
			// The wizard posts every step together, so the selection it sends is
			// authoritative — deselecting everything has to actually stick.
			const user = await createUser(db, { role: "volunteer" });
			const [cause] = await db
				.insert(categories)
				.values({ name: "Education", slug: "education" })
				.returning();
			if (!cause) throw new Error("category insert failed");

			const auth = authUserFor(user, ["volunteer"]);
			const base = {
				fullName: "Asha Menon",
				phone: "9876543210",
				city: "Pune",
				state: "Maharashtra",
			};

			await service.completeVolunteerOnboarding(auth, {
				...base,
				categoryIds: [cause.id],
			});
			await service.completeVolunteerOnboarding(auth, {
				...base,
				categoryIds: [],
			});

			expect(await db.query.userCategories.findMany()).toHaveLength(0);
		});
	});
});
