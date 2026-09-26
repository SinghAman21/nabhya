import { categories, userCategories, users } from "@nabhya/db/schema";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { StubStorageProvider } from "../src/common/storage";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { UsersService } from "../src/modules/users/users.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Role selection is the only thing in the system that grants a role - JwtGuard
 * deliberately assigns none - so it is the whole authorization story for a new
 * account.
 */
describe("UsersService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: UsersService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		service = new UsersService(
			db as never,
			new AuditService(db as never),
			null as never,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	describe("selectRole", () => {
		it("grants the chosen role to an account that has none", async () => {
			const user = await createUser(db);

			const result = await service.selectRole(user.id, "volunteer");

			expect(result).toEqual({ role: "volunteer", roles: ["volunteer"] });
			const profile = await service.getProfile(user.id);
			expect(profile.roles).toEqual(["volunteer"]);
		});

		it("refuses to switch an account that already has a different role", async () => {
			// Switching would re-home the user's organization and applications,
			// so it has to go through a superadmin instead.
			const user = await createUser(db, { role: "organisation" });

			await expect(
				service.selectRole(user.id, "volunteer"),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("is idempotent when the same role is chosen twice", async () => {
			// A double-tap on the role-select screen must not 409.
			const user = await createUser(db);

			await service.selectRole(user.id, "volunteer");
			const again = await service.selectRole(user.id, "volunteer");

			expect(again.roles).toEqual(["volunteer"]);
			const rows = await db.query.userRoles.findMany();
			expect(rows).toHaveLength(1);
		});

		it("fails loudly when the roles table was never seeded", async () => {
			// Silently granting nothing here would strand every new account.
			await db.execute("truncate table user_roles, roles cascade");
			const user = await createUser(db);

			await expect(
				service.selectRole(user.id, "volunteer"),
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("getProfile", () => {
		it("includes the organization the user owns, so the client can route once", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id, {
				verificationStatus: "PENDING",
			});

			const profile = await service.getProfile(owner.id);

			expect(profile.organization?.id).toBe(org.id);
			expect(profile.organization?.verificationStatus).toBe("PENDING");
		});

		it("returns no organization for a volunteer", async () => {
			const user = await createUser(db, { role: "volunteer" });
			expect((await service.getProfile(user.id)).organization).toBeNull();
		});

		it("rejects an unknown user rather than returning an empty profile", async () => {
			await expect(
				service.getProfile("00000000-0000-0000-0000-000000000000"),
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("updateProfile", () => {
		it("changes only the fields present in the payload", async () => {
			const user = await createUser(db, { fullName: "Asha Menon" });
			await service.updateProfile(user.id, { city: "Pune", bio: "Teacher." });

			const first = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(first?.city).toBe("Pune");
			expect(first?.fullName).toBe("Asha Menon");

			// A later edit that omits `bio` must not wipe it.
			await service.updateProfile(user.id, { city: "Nashik" });

			const second = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(second?.city).toBe("Nashik");
			expect(second?.bio).toBe("Teacher.");
		});

		it("clears a field when it is explicitly sent as null", async () => {
			const user = await createUser(db);
			await service.updateProfile(user.id, { bio: "Teacher." });
			await service.updateProfile(user.id, { bio: null });

			const saved = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(saved?.bio).toBeNull();
		});
	});

	describe("setInterests", () => {
		it("replaces the whole set rather than appending", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const inserted = await db
				.insert(categories)
				.values([
					{ name: "Education", slug: "education" },
					{ name: "Health", slug: "health" },
					{ name: "Environment", slug: "environment" },
				])
				.returning();
			const [education, health, environment] = inserted;
			if (!education || !health || !environment) {
				throw new Error("category insert failed");
			}

			await service.setInterests(user.id, [education.id, health.id]);
			await service.setInterests(user.id, [environment.id]);

			const rows = await db.query.userCategories.findMany({
				where: eq(userCategories.userId, user.id),
			});
			expect(rows.map((r) => r.categoryId)).toEqual([environment.id]);
		});

		it("tolerates the same category listed twice", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const [cause] = await db
				.insert(categories)
				.values({ name: "Education", slug: "education" })
				.returning();
			if (!cause) throw new Error("category insert failed");

			await service.setInterests(user.id, [cause.id, cause.id]);

			expect(await db.query.userCategories.findMany()).toHaveLength(1);
		});

		it("leaves one user's interests untouched when another user's change", async () => {
			const [first, second] = [
				await createUser(db, { role: "volunteer" }),
				await createUser(db, { role: "volunteer" }),
			];
			const [cause] = await db
				.insert(categories)
				.values({ name: "Education", slug: "education" })
				.returning();
			if (!cause) throw new Error("category insert failed");

			await service.setInterests(first.id, [cause.id]);
			await service.setInterests(second.id, []);

			const rows = await db.query.userCategories.findMany({
				where: eq(userCategories.userId, first.id),
			});
			expect(rows).toHaveLength(1);
		});
	});

	describe("uploadDocument", () => {
		let storage: StubStorageProvider;
		let docsService: UsersService;

		beforeAll(() => {
			storage = new StubStorageProvider();
			docsService = new UsersService(
				db as never,
				new AuditService(db as never),
				new UploadsService(db as never, storage),
			);
		});

		/** Mimic a completed direct-to-storage upload so assertUploaded passes. */
		async function stashUpload(userId: string, name: string) {
			const key = `user-documents/${userId}/${name}`;
			await storage.putObject({
				key,
				body: new Uint8Array(64),
				contentType: "image/jpeg",
			});
			return key;
		}

		it("supersedes a prior upload of the same type instead of stacking", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await docsService.uploadDocument(user.id, {
				documentType: "AADHAR_CARD",
				documentKey: await stashUpload(user.id, "aadhaar-1.jpg"),
			});
			const secondKey = await stashUpload(user.id, "aadhaar-2.jpg");
			await docsService.uploadDocument(user.id, {
				documentType: "AADHAR_CARD",
				documentKey: secondKey,
			});

			const docs = await db.query.userDocuments.findMany({
				where: (d, { eq: eqOp }) => eqOp(d.userId, user.id),
			});
			expect(docs).toHaveLength(1);
			expect(docs[0]?.documentKey).toBe(secondKey);
		});

		it("does not verify the account on upload alone", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await docsService.uploadDocument(user.id, {
				documentType: "AADHAR_CARD",
				documentKey: await stashUpload(user.id, "aadhaar.jpg"),
			});

			const stored = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});
			expect(stored?.verificationStatus).toBe("PENDING");
		});

		it("stores liveness metadata and confirms the second frame exists", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const documentKey = await stashUpload(user.id, "selfie.jpg");
			const secondaryFrameKey = await stashUpload(user.id, "selfie-2.jpg");

			await docsService.uploadDocument(user.id, {
				documentType: "SELFIE",
				documentKey,
				metadata: { liveness: { challenge: "BLINK", secondaryFrameKey } },
			});

			const doc = await db.query.userDocuments.findFirst({
				where: (d, { eq: eqOp }) => eqOp(d.userId, user.id),
			});
			const metadata = doc?.metadata as {
				liveness?: { challenge?: string };
			} | null;
			expect(metadata?.liveness?.challenge).toBe("BLINK");
		});

		it("rejects a selfie whose second frame was never uploaded", async () => {
			// A signed PUT can't guarantee the frame landed, so the key is HEAD-checked.
			const user = await createUser(db, { role: "volunteer" });
			const documentKey = await stashUpload(user.id, "selfie.jpg");

			await expect(
				docsService.uploadDocument(user.id, {
					documentType: "SELFIE",
					documentKey,
					metadata: {
						liveness: {
							challenge: "BLINK",
							secondaryFrameKey: `user-documents/${user.id}/missing.jpg`,
						},
					},
				}),
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});
});
