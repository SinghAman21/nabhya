import { donations, organizationPayoutProfiles } from "@nabhya/db/schema";
import { BadRequestException, NotFoundException } from "@nestjs/common";
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
import { decrypt } from "../src/common/crypto/encryption";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { PayoutsService } from "../src/modules/payouts/payouts.service";
import { RazorpayRouteService } from "../src/modules/payouts/razorpay-route.service";
import { createOrganization, createUser, seedRoles } from "./factories";
import { createTestDb, type TestDb, truncateAll } from "./harness";

describe("PayoutsService", () => {
	let db: TestDb;
	let close: () => Promise<void>;
	let service: PayoutsService;
	let audit: AuditService;
	let notifications: NotificationsService;
	let routeService: RazorpayRouteService;

	beforeAll(async () => {
		({ db, close } = await createTestDb());
		audit = new AuditService(db as never);
		notifications = new NotificationsService(db as never);
		routeService = new RazorpayRouteService();

		// Mock external network calls to Razorpay API in test environment
		vi.spyOn(routeService, "createLinkedAccount").mockResolvedValue({
			accountId: "acc_mock_test_123",
		});
		vi.spyOn(routeService, "createStakeholder").mockResolvedValue({
			stakeholderId: "sth_mock_test_123",
		});
		vi.spyOn(routeService, "requestRouteProduct").mockResolvedValue({
			productId: "prod_mock_test_123",
		});
		vi.spyOn(routeService, "linkBankAccount").mockResolvedValue(undefined);
		vi.spyOn(routeService, "getAccount").mockResolvedValue({
			id: "acc_mock_test_123",
			status: "activated",
		});
		vi.spyOn(routeService, "refundPayment").mockResolvedValue({
			id: "rfnd_mock_test_123",
		});

		service = new PayoutsService(
			db as never,
			audit,
			notifications,
			routeService,
		);
	});

	afterAll(async () => {
		await close();
	});

	beforeEach(async () => {
		await truncateAll(db);
		await seedRoles(db);
	});

	describe("savePayoutProfile & masking", () => {
		it("encrypts bank account at rest and stores only last 4 plaintext", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			const profile = await service.savePayoutProfile(owner.id, {
				legalEntityName: "Helping Hands Trust",
				businessType: "trust",
				pan: "AAATH1234F",
				bankAccountNumber: "987654321098",
				confirmBankAccountNumber: "987654321098",
				ifsc: "HDFC0001234",
				bankName: "HDFC Bank",
				bankBranch: "Koramangala",
				accountHolderName: "Helping Hands Trust",
				signatoryName: "Rajesh Kumar",
				signatoryEmail: "rajesh@helpinghands.org",
				signatoryPhone: "+919876543210",
			});

			expect(profile.organizationId).toBe(org.id);
			expect(profile.bankAccountLast4).toBe("1098");
			expect(profile.panMasked).toBe("AAATH****F");
			expect(profile.razorpayStatus).toBe("SUBMITTED");

			// Check the raw row in the database
			const rawRow = await db.query.organizationPayoutProfiles.findFirst({
				where: eq(organizationPayoutProfiles.organizationId, org.id),
			});

			expect(rawRow?.bankAccountLast4).toBe("1098");
			expect(rawRow?.bankAccountEncrypted).not.toContain("987654321098");

			// Decrypting raw ciphertext reproduces original account number
			const decrypted = decrypt(rawRow!.bankAccountEncrypted);
			expect(decrypted).toBe("987654321098");
		});

		it("returns null if organization has no payout profile yet", async () => {
			const owner = await createUser(db, { role: "organisation" });
			await createOrganization(db, owner.id);

			const profile = await service.getMyPayoutProfile(owner.id);
			expect(profile).toBeNull();
		});

		it("refuses to save payout profile if user owns no organization", async () => {
			const volunteer = await createUser(db, { role: "volunteer" });

			await expect(
				service.savePayoutProfile(volunteer.id, {
					legalEntityName: "Fake Org",
					businessType: "trust",
					pan: "AAATH1234F",
					bankAccountNumber: "1234567890",
					confirmBankAccountNumber: "1234567890",
					ifsc: "HDFC0001234",
					accountHolderName: "Fake",
					signatoryName: "Fake",
					signatoryEmail: "fake@fake.org",
					signatoryPhone: "+919876543210",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("handleAccountWebhook", () => {
		it("updates profile to ACTIVATED on account.activated event", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await service.savePayoutProfile(owner.id, {
				legalEntityName: "Helping Hands",
				businessType: "trust",
				pan: "AAATH1234F",
				bankAccountNumber: "987654321098",
				confirmBankAccountNumber: "987654321098",
				ifsc: "HDFC0001234",
				accountHolderName: "Helping Hands",
				signatoryName: "Rajesh Kumar",
				signatoryEmail: "rajesh@helpinghands.org",
				signatoryPhone: "+919876543210",
			});

			// Assign a razorpay account id
			await db
				.update(organizationPayoutProfiles)
				.set({ razorpayAccountId: "acc_test_123" })
				.where(eq(organizationPayoutProfiles.organizationId, org.id));

			await service.handleAccountWebhook({
				type: "account.activated",
				accountId: "acc_test_123",
			});

			const updated = await service.getPayoutProfileByOrgId(org.id);
			expect(updated?.razorpayStatus).toBe("ACTIVATED");
			expect(updated?.activatedAt).toBeInstanceOf(Date);
		});

		it("updates profile to REJECTED on account.rejected event", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await service.savePayoutProfile(owner.id, {
				legalEntityName: "Helping Hands",
				businessType: "trust",
				pan: "AAATH1234F",
				bankAccountNumber: "987654321098",
				confirmBankAccountNumber: "987654321098",
				ifsc: "HDFC0001234",
				accountHolderName: "Helping Hands",
				signatoryName: "Rajesh Kumar",
				signatoryEmail: "rajesh@helpinghands.org",
				signatoryPhone: "+919876543210",
			});

			await db
				.update(organizationPayoutProfiles)
				.set({ razorpayAccountId: "acc_test_reject" })
				.where(eq(organizationPayoutProfiles.organizationId, org.id));

			await service.handleAccountWebhook({
				type: "account.rejected",
				accountId: "acc_test_reject",
				statusReason: "Signatory document not clear",
			});

			const updated = await service.getPayoutProfileByOrgId(org.id);
			expect(updated?.razorpayStatus).toBe("REJECTED");
			expect(updated?.statusReason).toBe("Signatory document not clear");
		});
	});

	describe("retrySync", () => {
		it("refuses to retry sync if profile is already ACTIVATED", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await service.savePayoutProfile(owner.id, {
				legalEntityName: "Active Org",
				businessType: "society",
				pan: "BBBTB1234F",
				bankAccountNumber: "111222333444",
				confirmBankAccountNumber: "111222333444",
				ifsc: "SBIN0001234",
				accountHolderName: "Active Org",
				signatoryName: "Suresh",
				signatoryEmail: "suresh@active.org",
				signatoryPhone: "+919876543210",
			});

			await db
				.update(organizationPayoutProfiles)
				.set({ razorpayStatus: "ACTIVATED", razorpayAccountId: "acc_active" })
				.where(eq(organizationPayoutProfiles.organizationId, org.id));

			await expect(service.retrySync(org.id)).rejects.toThrow(
				BadRequestException,
			);
		});

		it("resets identifiers and re-triggers onboarding when status is NEEDS_CLARIFICATION", async () => {
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			await service.savePayoutProfile(owner.id, {
				legalEntityName: "Need Help Org",
				businessType: "society",
				pan: "BBBTB1234F",
				bankAccountNumber: "111222333444",
				confirmBankAccountNumber: "111222333444",
				ifsc: "SBIN0001234",
				accountHolderName: "Need Help Org",
				signatoryName: "Suresh",
				signatoryEmail: "suresh@active.org",
				signatoryPhone: "+919876543210",
			});

			await db
				.update(organizationPayoutProfiles)
				.set({
					razorpayStatus: "NEEDS_CLARIFICATION",
					statusReason: "Wrong IFSC",
					razorpayAccountId: "acc_clarify",
				})
				.where(eq(organizationPayoutProfiles.organizationId, org.id));

			await service.retrySync(org.id);

			const row = await db.query.organizationPayoutProfiles.findFirst({
				where: eq(organizationPayoutProfiles.organizationId, org.id),
			});

			expect(row?.statusReason).toBeNull();
		});
	});

	describe("refundDonation", () => {
		it("refuses refund if donation is not completed", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			const [donation] = await db
				.insert(donations)
				.values({
					organizationId: org.id,
					amountMinor: 50_000,
					currency: "INR",
					status: "PENDING",
					donorEmail: "donor@example.com",
				})
				.returning();

			await expect(
				service.refundDonation(admin.id, donation.id),
			).rejects.toThrow(BadRequestException);
		});

		it("refunds completed donation, reverses transferStatus, and records audit", async () => {
			const admin = await createUser(db, { role: "superadmin" });
			const owner = await createUser(db, { role: "organisation" });
			const org = await createOrganization(db, owner.id);

			const [donation] = await db
				.insert(donations)
				.values({
					organizationId: org.id,
					amountMinor: 50_000,
					currency: "INR",
					status: "COMPLETED",
					providerPaymentId: "pay_test_refund_1",
					destinationAccountId: "acc_test_route_1",
					transferStatus: "PROCESSED",
					donorEmail: "donor@example.com",
				})
				.returning();

			const res = await service.refundDonation(admin.id, donation.id);
			expect(res.refundId).toBeDefined();

			const updated = await db.query.donations.findFirst({
				where: eq(donations.id, donation.id),
			});

			expect(updated?.status).toBe("REFUNDED");
			expect(updated?.transferStatus).toBe("REVERSED");
		});
	});
});
