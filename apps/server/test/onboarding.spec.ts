import {
	categories,
	organizationAdmins,
	organizationCategories,
	users,
} from "@nabhya/db/schema";
import type { CompleteOrgOnboardingInput } from "@nabhya/shared";
import {
	completeOrgOnboardingSchema,
	completeVolunteerOnboardingSchema,
	onboardingStatusResponseSchema,
} from "@nabhya/shared";
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
 * here is either a locked-out user or an infinite redirect - both of which
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
		categoryIds: [],
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
			// The routing gate's runtime contract, as the client will see it.
			expect(
				onboardingStatusResponseSchema.safeParse(
					JSON.parse(JSON.stringify(status)),
				).error,
			).toBeUndefined();
		});

		it("counts a team member as onboarded to the NGO they joined", async () => {
			// Checking only owner_user_id sent every invited member to the
			// registration wizard to create a second NGO.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const member = await createUser(db, { role: "organisation" });
			await db.insert(organizationAdmins).values({
				organizationId: org.id,
				userId: member.id,
				role: "MEMBER",
				status: "ACTIVE",
			});
			const auth = authUserFor(member, ["organisation"]);

			const status = await service.getStatus(auth);
			expect(status.isOnboarded).toBe(true);
			expect(status.organization?.id).toBe(org.id);

			await expect(
				service.completeOrganizationOnboarding(auth, orgPayload),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("still routes the team of a suspended NGO into the NGO app", async () => {
			// The NGO app is where a suspension is explained; the wizard is not.
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				status: "SUSPENDED",
			});
			await db.insert(organizationAdmins).values({
				organizationId: org.id,
				userId: owner.id,
				role: "OWNER",
				isOwner: true,
				status: "ACTIVE",
			});

			const status = await service.getStatus(
				authUserFor(owner, ["organisation"]),
			);
			expect(status.isOnboarded).toBe(true);
			expect(status.organization?.status).toBe("SUSPENDED");
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
			// Always PENDING - an NGO cannot self-verify.
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

		it("links the causes the wizard collected", async () => {
			// `organization_categories` is what the feed's "For you" lens joins
			// through, so an NGO onboarded without causes is unmatchable.
			const owner = await createUser(db, { role: "organisation" });
			const inserted = await db
				.insert(categories)
				.values([
					{ name: "Education", slug: "education" },
					{ name: "Health", slug: "health" },
				])
				.returning();
			const [first, second] = inserted;
			if (!first || !second) throw new Error("category insert failed");

			const org = await service.completeOrganizationOnboarding(
				authUserFor(owner, ["organisation"]),
				{ ...orgPayload, categoryIds: [first.id, second.id] },
			);

			const links = await db.query.organizationCategories.findMany({
				where: eq(organizationCategories.organizationId, org.id),
			});
			expect(links.map((l) => l.categoryId).sort()).toEqual(
				[first.id, second.id].sort(),
			);
		});

		it("stores the coordinates captured at onboarding", async () => {
			// Without coordinates at onboarding an NGO never appears in "near me",
			// since the only other way to set them is an edit screen nobody opens.
			const owner = await createUser(db, { role: "organisation" });

			const org = await service.completeOrganizationOnboarding(
				authUserFor(owner, ["organisation"]),
				{ ...orgPayload, latitude: 19.0596, longitude: 72.8295 },
			);

			expect(Number(org.latitude)).toBeCloseTo(19.0596, 4);
			expect(Number(org.longitude)).toBeCloseTo(72.8295, 4);
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

	/**
	 * The wizards post **raw form values** - "" for every untouched optional
	 * field - and this schema is the only normaliser. The service specs call the
	 * service directly and so never exercise the controller's validation pipe,
	 * which is how the client shipped once posting its own parsed output: an
	 * `optionalText` field parses "" into `null`, and `null` is not valid input
	 * for it, so the API answered 400 "expected string, received null" on `bio`,
	 * `profileImage` and `description`.
	 */
	describe("wizard payloads, as the client sends them", () => {
		it("accepts a volunteer payload with every optional field blank", () => {
			const parsed = completeVolunteerOnboardingSchema.safeParse({
				fullName: "Asha Menon",
				// As typed, spaces and country code included - the wizard's own
				// placeholder is 16 characters and a raw `max(15)` rejected it.
				phone: "+91 98765 43210",
				profileImage: "",
				city: "Pune",
				state: "Maharashtra",
				latitude: undefined,
				longitude: undefined,
				categoryIds: [],
				bio: "",
			});

			expect(parsed.success).toBe(true);
			if (!parsed.success) return;
			expect(parsed.data.phone).toBe("+919876543210");
			expect(parsed.data.bio).toBeNull();
			expect(parsed.data.profileImage).toBeNull();
		});

		it("accepts an org payload with blank optional text and blank numbers", () => {
			const parsed = completeOrgOnboardingSchema.safeParse({
				...orgPayload,
				description: "",
				website: "",
				// Untouched numeric inputs. Coercing these to 0 is what made an
				// optional "Founded in" fail with "Enter a valid year".
				teamSize: "",
				foundingYear: "",
			});

			expect(parsed.success).toBe(true);
			if (!parsed.success) return;
			expect(parsed.data.description).toBeNull();
			expect(parsed.data.teamSize).toBeUndefined();
			expect(parsed.data.foundingYear).toBeUndefined();
		});

		it("still rejects what it should", () => {
			const missingType = completeOrgOnboardingSchema.safeParse({
				...orgPayload,
				orgType: "",
			});
			expect(missingType.success).toBe(false);

			const badPincode = completeOrgOnboardingSchema.safeParse({
				...orgPayload,
				pincode: "4000",
			});
			expect(badPincode.success).toBe(false);

			const shortPhone = completeVolunteerOnboardingSchema.safeParse({
				fullName: "Asha Menon",
				phone: "98765",
				city: "Pune",
				state: "Maharashtra",
			});
			expect(shortPhone.success).toBe(false);
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

		it("saves the avatar key and coordinates, and keeps an old avatar on re-submit", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const auth = authUserFor(user, ["volunteer"]);
			const base = {
				fullName: "Asha Menon",
				phone: "9876543210",
				city: "Pune",
				state: "Maharashtra",
				categoryIds: [],
			};

			await service.completeVolunteerOnboarding(auth, {
				...base,
				profileImage: "avatar/asha/photo.jpg",
				latitude: 18.5204,
				longitude: 73.8567,
			});

			const first = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(first?.profileImage).toBe("avatar/asha/photo.jpg");
			expect(Number(first?.latitude)).toBeCloseTo(18.5204, 4);

			// A resubmission without a photo must not blank the one on file.
			await service.completeVolunteerOnboarding(auth, base);

			const second = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(second?.profileImage).toBe("avatar/asha/photo.jpg");
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
			// authoritative - deselecting everything has to actually stick.
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
