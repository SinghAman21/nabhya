import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../src/common/audit";
import { StubStorageProvider } from "../src/common/storage";
import { CertificatesService } from "../src/modules/certificates/certificates.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import {
	createApplication,
	createEvent,
	createOrganization,
	createUser,
	seedRoles,
} from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("CertificatesService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: CertificatesService;
	let storage: StubStorageProvider;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		const audit = new AuditService(db as never);
		storage = new StubStorageProvider();
		service = new CertificatesService(
			db as never,
			audit,
			storage,
			new NotificationsService(db as never),
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

	async function scenario(options: { attended?: boolean } = {}) {
		const owner = await createUser(db, { role: "organisation" });
		const org = await createOrganization(db, owner.id);
		const event = await createEvent(db, org.id);
		const volunteer = await createUser(db, {
			role: "volunteer",
			fullName: "Aditi Sharma",
		});
		const application = await createApplication(db, event.id, volunteer.id, {
			status: "ACCEPTED",
			attendedAt: options.attended ? new Date() : null,
		});
		return { owner, org, event, volunteer, application };
	}

	describe("attendance", () => {
		it("refuses to mark a volunteer who was never accepted", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);
			const event = await createEvent(db, org.id);
			const volunteer = await createUser(db, { role: "volunteer" });
			const application = await createApplication(db, event.id, volunteer.id, {
				status: "PENDING",
			});

			await expect(
				service.markAttendance(owner.id, event.id, application.id, {
					attended: true,
				}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("stops one organization marking another's applicants", async () => {
			const { event, application } = await scenario();
			const outsider = await createUser(db, { role: "organisation" });
			await createOrganization(db, outsider.id);

			await expect(
				service.markAttendance(outsider.id, event.id, application.id, {
					attended: true,
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("issuing", () => {
		it("refuses to issue without attendance", async () => {
			// Attendance is the whole basis of the claim — a certificate for
			// someone who never turned up is a forgery the platform vouched for.
			const { owner, event, application } = await scenario({
				attended: false,
			});

			await expect(
				service.issue(owner.id, event.id, application.id, {}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("issues once attended, storing a PDF and a unique code", async () => {
			const { owner, event, application } = await scenario({ attended: true });

			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{ note: "12 hours contributed" },
			);

			expect(certificate.code).toMatch(/^NBH-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

			// The PDF is generated after the record so a storage failure cannot
			// lose the certificate; by now it should exist.
			const stored = await db.query.certificates.findFirst({});
			expect(stored?.pdfKey).toBeTruthy();
			expect(await storage.head(stored?.pdfKey as string)).not.toBeNull();
		});

		it("refuses a second certificate for the same participation", async () => {
			const { owner, event, application } = await scenario({ attended: true });
			await service.issue(owner.id, event.id, application.id, {});

			await expect(
				service.issue(owner.id, event.id, application.id, {}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("notifies the volunteer that their certificate is ready", async () => {
			const { owner, event, application, volunteer } = await scenario({
				attended: true,
			});
			await service.issue(owner.id, event.id, application.id, {});

			const inbox = await db.query.notifications.findMany({});
			expect(inbox).toHaveLength(1);
			expect(inbox[0]?.userId).toBe(volunteer.id);
			expect(inbox[0]?.type).toBe("CERTIFICATE_ISSUED");
		});
	});

	describe("attendance reversal", () => {
		it("refuses to un-mark attendance while a certificate exists", async () => {
			// Otherwise the certificate outlives the evidence behind it.
			const { owner, event, application } = await scenario({ attended: true });
			await service.issue(owner.id, event.id, application.id, {});

			await expect(
				service.markAttendance(owner.id, event.id, application.id, {
					attended: false,
				}),
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe("public verification", () => {
		it("resolves a valid certificate without any authentication", async () => {
			const { owner, event, application, org } = await scenario({
				attended: true,
			});
			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{},
			);

			const result = await service.verify(certificate.code);

			expect(result.valid).toBe(true);
			expect(result.revoked).toBe(false);
			expect(result.volunteerName).toBe("Aditi Sharma");
			expect(result.organizationName).toBe(org.organizationName);
		});

		it("is case-insensitive, since codes get typed by hand", async () => {
			const { owner, event, application } = await scenario({ attended: true });
			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{},
			);

			const result = await service.verify(certificate.code.toLowerCase());
			expect(result.valid).toBe(true);
		});

		it("still resolves a revoked code, but reports it as void", async () => {
			// Returning "not found" would let a holder claim the checker mistyped.
			const { owner, event, application } = await scenario({ attended: true });
			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{},
			);

			await service.revoke(owner.id, certificate.id, {
				reason: "Issued in error",
			});

			const result = await service.verify(certificate.code);
			expect(result.valid).toBe(false);
			expect(result.revoked).toBe(true);
			expect(result.revokedReason).toBe("Issued in error");
		});

		it("rejects an unknown code", async () => {
			await expect(service.verify("NBH-XXXX-XXXX")).rejects.toThrow();
		});
	});

	describe("downloading", () => {
		it("refuses to hand another volunteer's certificate over", async () => {
			const { owner, event, application } = await scenario({ attended: true });
			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{},
			);

			const stranger = await createUser(db, { role: "volunteer" });

			await expect(
				service.getPdfUrl(stranger.id, certificate.id),
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("regenerates the PDF if storage lost it", async () => {
			const { owner, event, application, volunteer } = await scenario({
				attended: true,
			});
			const certificate = await service.issue(
				owner.id,
				event.id,
				application.id,
				{},
			);

			const stored = await db.query.certificates.findFirst({});
			await storage.delete(stored?.pdfKey as string);

			const result = await service.getPdfUrl(volunteer.id, certificate.id);
			expect(result.url).toContain("stub-download");
		});
	});
});
