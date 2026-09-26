import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	NGO_VERIFICATION_BUCKET,
	parseStorageKey,
	StubStorageProvider,
} from "../src/common/storage";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import {
	authUserFor,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

/**
 * Authorization tests for object storage.
 *
 * These matter more than most: a hole here leaks other people's identity
 * documents and NGO financial records. Ownership is derived from the key, so
 * the key-building and key-parsing rules are the security boundary.
 */
describe("UploadsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: UploadsService;
	let storage: StubStorageProvider;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		storage = new StubStorageProvider();
		service = new UploadsService(db as never, storage);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	describe("issuing upload tickets", () => {
		it("scopes a user document to the caller, ignoring any client input", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const auth = authUserFor(user, ["volunteer"]);

			const ticket = await service.createIntent(auth, {
				purpose: "USER_DOCUMENT",
				fileName: "aadhaar.pdf",
				contentType: "application/pdf",
				size: 1000,
			});

			// The client never proposes a key; it is derived from the token. The
			// document prefixes carry a readable folder between the prefix and
			// the owner id - `<bucket>/user-documents/<label>-<date>/<userId>/…`
			// - so the owner segment is asserted through `parseStorageKey`,
			// which is the function authorisation actually uses, rather than by
			// re-deriving the layout here and drifting from it.
			expect(
				ticket.key.startsWith(`${NGO_VERIFICATION_BUCKET}/user-documents/`),
			).toBe(true);
			expect(parseStorageKey(ticket.key)).toEqual({
				purpose: "USER_DOCUMENT",
				ownerId: user.id,
			});
		});

		it("scopes an org document to the caller's organization", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const auth = authUserFor(owner, ["organisation"]);

			const ticket = await service.createIntent(auth, {
				purpose: "ORG_DOCUMENT",
				fileName: "pan.pdf",
				contentType: "application/pdf",
				size: 1000,
			});

			expect(
				ticket.key.startsWith(`${NGO_VERIFICATION_BUCKET}/org-documents/`),
			).toBe(true);
			expect(parseStorageKey(ticket.key)).toEqual({
				purpose: "ORG_DOCUMENT",
				ownerId: org.id,
			});
		});

		it("refuses org-scoped uploads from someone with no organization", async () => {
			const volunteer = await createUser(db, { role: "volunteer" });
			const auth = authUserFor(volunteer, ["volunteer"]);

			await expect(
				service.createIntent(auth, {
					purpose: "ORG_DOCUMENT",
					fileName: "pan.pdf",
					contentType: "application/pdf",
					size: 1000,
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("download authorization", () => {
		it("lets a user read their own document", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const auth = authUserFor(user, ["volunteer"]);

			const ticket = await service.createIntent(auth, {
				purpose: "USER_DOCUMENT",
				fileName: "id.pdf",
				contentType: "application/pdf",
				size: 100,
			});

			const result = await service.createDownloadUrl(auth, ticket.key);
			expect(result.url).toContain("stub-download");
		});

		it("refuses another user's identity document", async () => {
			const owner = await createUser(db, { role: "volunteer" });
			const attacker = await createUser(db, { role: "volunteer" });

			const ticket = await service.createIntent(
				authUserFor(owner, ["volunteer"]),
				{
					purpose: "USER_DOCUMENT",
					fileName: "id.pdf",
					contentType: "application/pdf",
					size: 100,
				},
			);

			await expect(
				service.createDownloadUrl(
					authUserFor(attacker, ["volunteer"]),
					ticket.key,
				),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("refuses another organization's documents", async () => {
			const ownerA = await createUser(db, { role: "organisation" });
			await createOrganization(db, ownerA.id);
			const ticketA = await service.createIntent(
				authUserFor(ownerA, ["organisation"]),
				{
					purpose: "ORG_DOCUMENT",
					fileName: "pan.pdf",
					contentType: "application/pdf",
					size: 100,
				},
			);

			const ownerB = await createUser(db, { role: "organisation" });
			await createOrganization(db, ownerB.id);

			await expect(
				service.createDownloadUrl(
					authUserFor(ownerB, ["organisation"]),
					ticketA.key,
				),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("lets a superadmin read anything, since they run verification", async () => {
			const owner = await createUser(db, { role: "volunteer" });
			const admin = await createUser(db, { role: "superadmin" });

			const ticket = await service.createIntent(
				authUserFor(owner, ["volunteer"]),
				{
					purpose: "USER_DOCUMENT",
					fileName: "id.pdf",
					contentType: "application/pdf",
					size: 100,
				},
			);

			const result = await service.createDownloadUrl(
				authUserFor(admin, ["superadmin"]),
				ticket.key,
			);
			expect(result.url).toContain("stub-download");
		});

		it("rejects a malformed key rather than guessing an owner", async () => {
			const user = await createUser(db, { role: "volunteer" });
			await expect(
				service.createDownloadUrl(authUserFor(user, ["volunteer"]), "nonsense"),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("refuses a forged key that points at another user's prefix", async () => {
			const victim = await createUser(db, { role: "volunteer" });
			const attacker = await createUser(db, { role: "volunteer" });

			// A *well-formed* key aimed at the victim's folder: the point of this
			// test is the ownership check, so the key has to survive parsing.
			// Built without the bucket prefix it was merely malformed, which is
			// a different refusal - covered by the test above - and told us
			// nothing about whether ownership is enforced.
			const forged = `${NGO_VERIFICATION_BUCKET}/user-documents/someone-070926/${victim.id}/anything.pdf`;

			await expect(
				service.createDownloadUrl(authUserFor(attacker, ["volunteer"]), forged),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("confirming uploads", () => {
		it("rejects a key that was never uploaded", async () => {
			await expect(
				service.assertUploaded(
					`${NGO_VERIFICATION_BUCKET}/user-documents/someone-070926/nobody/never-uploaded.pdf`,
				),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("rejects and cleans up an oversized object", async () => {
			const user = await createUser(db, { role: "volunteer" });
			const ticket = await service.createIntent(
				authUserFor(user, ["volunteer"]),
				{
					purpose: "USER_DOCUMENT",
					fileName: "big.pdf",
					contentType: "application/pdf",
					size: 100,
				},
			);

			// A signed PUT cannot cap body size, so oversized objects are caught
			// here - simulate one landing in storage.
			await storage.putObject({
				key: ticket.key,
				body: new Uint8Array(11 * 1024 * 1024),
				contentType: "application/pdf",
			});

			await expect(service.assertUploaded(ticket.key)).rejects.toBeInstanceOf(
				BadRequestException,
			);

			// And it must not be left behind occupying the bucket.
			expect(await storage.head(ticket.key)).toBeNull();
		});
	});
});
