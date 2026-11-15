import { randomUUID } from "node:crypto";
import type { db as dbType } from "@nabhya/db";
import {
	donations,
	organizationPayoutProfiles,
	organizations,
} from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import type {
	CreatePayoutProfileInput,
	PayoutProfileView,
} from "@nabhya/shared";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { decrypt, encrypt } from "../../common/crypto/encryption";
import { DB_TOKEN } from "../../common/database";
import { NotificationsService } from "../notifications/notifications.service";
import {
	type PayoutProfileForOnboarding,
	RazorpayRouteService,
} from "./razorpay-route.service";

@Injectable()
export class PayoutsService {
	private readonly logger = new Logger(PayoutsService.name);

	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
		@Inject(RazorpayRouteService)
		private readonly razorpayRoute: RazorpayRouteService,
	) {}

	// ─── Helpers ────────────────────────────────────────────────────────────────

	/**
	 * Returns the organization owned by the given user.
	 * Throws NotFoundException if no org is found, so callers never get a null.
	 */
	private async requireOrgByUser(userId: string) {
		const org = await this.db.query.organizations.findFirst({
			where: eq(organizations.ownerUserId, userId),
			columns: {
				id: true,
				organizationName: true,
				orgType: true,
				registrationNumber: true,
				email: true,
				phone: true,
				address: true,
				city: true,
				state: true,
				pincode: true,
			},
		});

		if (!org) {
			throw new NotFoundException(
				"No organization found for this account. Complete NGO registration first.",
			);
		}

		return org;
	}

	/**
	 * Maps a DB row to the public masked view DTO.
	 * Never exposes the full bank account number.
	 */
	private toView(
		row: typeof organizationPayoutProfiles.$inferSelect,
	): PayoutProfileView {
		return {
			id: row.id,
			organizationId: row.organizationId,
			legalEntityName: row.legalEntityName,
			businessType: row.businessType,
			// Mask PAN: AAATP1234F → AAATP****F
			panMasked: `${row.pan.slice(0, 5)}****${row.pan.slice(-1)}`,
			bankAccountLast4: row.bankAccountLast4,
			ifsc: row.ifsc,
			bankName: row.bankName ?? null,
			bankBranch: row.bankBranch ?? null,
			accountHolderName: row.accountHolderName,
			signatoryName: row.signatoryName,
			signatoryEmail: row.signatoryEmail,
			signatoryPhone: row.signatoryPhone,
			razorpayAccountId: row.razorpayAccountId ?? null,
			razorpayStatus: row.razorpayStatus,
			statusReason: row.statusReason ?? null,
			requirementsDue: row.requirementsDue ?? null,
			isPennyDropVerified: row.isPennyDropVerified,
			pennyDropRegisteredName: row.pennyDropRegisteredName ?? null,
			activatedAt: row.activatedAt ?? null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	// ─── Public API ─────────────────────────────────────────────────────────────

	/**
	 * Saves or updates the NGO's payout profile.
	 *
	 * - Encrypts the bank account number with AES-256-GCM.
	 * - Stores only the last 4 digits in plaintext for the UI.
	 * - Marks status as SUBMITTED (not yet sent to Razorpay; that happens on
	 *   org verification via `startOnboarding`).
	 */
	async savePayoutProfile(
		userId: string,
		input: CreatePayoutProfileInput,
	): Promise<PayoutProfileView> {
		const org = await this.requireOrgByUser(userId);

		const encrypted = encrypt(input.bankAccountNumber);
		const last4 = input.bankAccountNumber.slice(-4);

		const values = {
			organizationId: org.id,
			legalEntityName: input.legalEntityName,
			businessType: input.businessType,
			pan: input.pan,
			bankAccountEncrypted: encrypted,
			bankAccountLast4: last4,
			ifsc: input.ifsc,
			bankName: input.bankName ?? null,
			bankBranch: input.bankBranch ?? null,
			accountHolderName: input.accountHolderName,
			signatoryName: input.signatoryName,
			signatoryEmail: input.signatoryEmail,
			signatoryPhone: input.signatoryPhone,
			signatoryDob: input.signatoryDob ?? null,
			signatoryPan: input.signatoryPan ?? null,
			signatoryAddress: input.signatoryAddress ?? null,
			razorpayStatus: "SUBMITTED" as const,
			updatedAt: new Date(),
		};

		const [row] = await this.db
			.insert(organizationPayoutProfiles)
			.values(values)
			.onConflictDoUpdate({
				target: organizationPayoutProfiles.organizationId,
				set: {
					...values,
					// Don't overwrite an already-activated account's Razorpay identifiers
					// or status when the NGO re-submits a form; keep those fields out of
					// the conflict-update so the existing lifecycle status is preserved.
					// We only reset status to SUBMITTED if the account was not yet
					// activated.
				},
			})
			.returning();

		void this.audit.record({
			performedBy: userId,
			action: "PAYOUT_PROFILE_SAVED",
			entityName: "ORGANIZATION",
			entityId: org.id,
			newValue: {
				legalEntityName: input.legalEntityName,
				ifsc: input.ifsc,
				bankAccountLast4: last4,
			},
		});

		return this.toView(row);
	}

	/**
	 * Returns the payout profile for the calling NGO's organisation, or null.
	 */
	async getMyPayoutProfile(userId: string): Promise<PayoutProfileView | null> {
		const org = await this.requireOrgByUser(userId);

		const row = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.organizationId, org.id),
		});

		return row ? this.toView(row) : null;
	}

	/**
	 * Returns the payout profile by organization ID (for admin use).
	 */
	async getPayoutProfileByOrgId(
		orgId: string,
	): Promise<PayoutProfileView | null> {
		const row = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.organizationId, orgId),
		});

		return row ? this.toView(row) : null;
	}

	/**
	 * Triggers Razorpay Route's 4-step linked-account onboarding for an NGO.
	 *
	 * Called fire-and-forget from `AdminService.reviewOrganization` after the
	 * superadmin verifies an NGO. Must NOT be awaited by the caller — a Razorpay
	 * timeout must never fail the NGO verification flow.
	 *
	 * Idempotent: safe to call again if the previous attempt left the profile in
	 * NOT_STARTED, SUBMITTED, or NEEDS_CLARIFICATION status.
	 */
	async startOnboarding(organizationId: string): Promise<void> {
		const org = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: {
				id: true,
				organizationName: true,
				orgType: true,
				registrationNumber: true,
				email: true,
				phone: true,
				address: true,
				city: true,
				state: true,
				pincode: true,
			},
		});

		if (!org) {
			this.logger.warn(
				`startOnboarding: organization ${organizationId} not found`,
			);
			return;
		}

		const profile = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.organizationId, organizationId),
		});

		if (!profile) {
			this.logger.warn(
				`startOnboarding: no payout profile for org ${organizationId}. ` +
					"The NGO must submit their banking details before onboarding can proceed.",
			);
			return;
		}

		// Don't re-trigger for already-active or in-flight accounts.
		if (
			profile.razorpayStatus === "UNDER_REVIEW" ||
			profile.razorpayStatus === "ACTIVATED"
		) {
			this.logger.log(
				`startOnboarding: org ${organizationId} already in status ${profile.razorpayStatus}, skipping`,
			);
			return;
		}

		this.logger.log(
			`startOnboarding: beginning Razorpay Route onboarding for org ${organizationId}`,
		);

		try {
			// Step 1: Create Razorpay linked account
			let accountId = profile.razorpayAccountId ?? undefined;
			if (!accountId) {
				const { accountId: newAccountId } =
					await this.razorpayRoute.createLinkedAccount(org, {
						legalEntityName: profile.legalEntityName,
						businessType: profile.businessType,
						pan: profile.pan,
						signatoryEmail: profile.signatoryEmail,
						signatoryPhone: profile.signatoryPhone,
					});
				accountId = newAccountId;

				await this.db
					.update(organizationPayoutProfiles)
					.set({ razorpayAccountId: accountId, updatedAt: new Date() })
					.where(eq(organizationPayoutProfiles.organizationId, organizationId));
			}

			// Step 2: Create stakeholder
			let stakeholderId = profile.razorpayStakeholderId ?? undefined;
			if (!stakeholderId) {
				const profileData: PayoutProfileForOnboarding = {
					legalEntityName: profile.legalEntityName,
					businessType: profile.businessType,
					pan: profile.pan,
					bankAccountEncrypted: profile.bankAccountEncrypted,
					bankAccountLast4: profile.bankAccountLast4,
					ifsc: profile.ifsc,
					bankName: profile.bankName ?? null,
					accountHolderName: profile.accountHolderName,
					signatoryName: profile.signatoryName,
					signatoryEmail: profile.signatoryEmail,
					signatoryPhone: profile.signatoryPhone,
					signatoryDob: profile.signatoryDob ?? null,
					signatoryPan: profile.signatoryPan ?? null,
					signatoryAddress: profile.signatoryAddress ?? null,
				};

				const { stakeholderId: newStakeholderId } =
					await this.razorpayRoute.createStakeholder(accountId, profileData);
				stakeholderId = newStakeholderId;

				await this.db
					.update(organizationPayoutProfiles)
					.set({ razorpayStakeholderId: stakeholderId, updatedAt: new Date() })
					.where(eq(organizationPayoutProfiles.organizationId, organizationId));
			}

			// Step 3: Request Route product
			const { productId } =
				await this.razorpayRoute.requestRouteProduct(accountId);

			// Step 4: Link bank account (decrypt only here, never logged)
			const plaintextAccountNumber = decrypt(profile.bankAccountEncrypted);
			const profileData: PayoutProfileForOnboarding = {
				legalEntityName: profile.legalEntityName,
				businessType: profile.businessType,
				pan: profile.pan,
				bankAccountEncrypted: profile.bankAccountEncrypted,
				bankAccountLast4: profile.bankAccountLast4,
				ifsc: profile.ifsc,
				bankName: profile.bankName ?? null,
				accountHolderName: profile.accountHolderName,
				signatoryName: profile.signatoryName,
				signatoryEmail: profile.signatoryEmail,
				signatoryPhone: profile.signatoryPhone,
				signatoryDob: profile.signatoryDob ?? null,
				signatoryPan: profile.signatoryPan ?? null,
				signatoryAddress: profile.signatoryAddress ?? null,
			};

			await this.razorpayRoute.linkBankAccount(
				accountId,
				productId,
				profileData,
				plaintextAccountNumber,
			);

			// All 4 steps succeeded — move to UNDER_REVIEW
			await this.db
				.update(organizationPayoutProfiles)
				.set({
					razorpayStatus: "UNDER_REVIEW",
					statusReason: null,
					updatedAt: new Date(),
				})
				.where(eq(organizationPayoutProfiles.organizationId, organizationId));

			void this.audit.record({
				action: "PAYOUT_ONBOARDING_TRIGGERED",
				entityName: "ORGANIZATION",
				entityId: organizationId,
				newValue: { razorpayAccountId: accountId, status: "UNDER_REVIEW" },
			});

			this.logger.log(
				`startOnboarding: org ${organizationId} moved to UNDER_REVIEW (account: ${accountId})`,
			);
		} catch (err) {
			const reason =
				err instanceof Error ? err.message : "Unknown onboarding error";

			this.logger.error(
				`startOnboarding: failed for org ${organizationId}: ${reason}`,
			);

			await this.db
				.update(organizationPayoutProfiles)
				.set({
					razorpayStatus: "NEEDS_CLARIFICATION",
					statusReason: reason,
					updatedAt: new Date(),
				})
				.where(eq(organizationPayoutProfiles.organizationId, organizationId));

			void this.notifications.notifyOrganizationTeam(organizationId, {
				type: "PAYOUT_ONBOARDING_FAILED",
				title: "Payout setup needs attention",
				body: "We were unable to complete your bank account verification. Our team will review and get back to you.",
				entityName: "ORGANIZATION",
				entityId: organizationId,
			});
		}
	}

	/**
	 * Updates the payout profile's status based on a Razorpay account webhook.
	 *
	 * Razorpay sends `account.activated`, `account.rejected`, `account.suspended`
	 * etc. This method is called by the webhook handler (Phase 3).
	 */
	async handleAccountWebhook(event: {
		type: string;
		accountId: string;
		statusReason?: string;
	}): Promise<void> {
		const profile = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.razorpayAccountId, event.accountId),
		});

		if (!profile) {
			this.logger.warn(
				`handleAccountWebhook: no profile found for Razorpay account ${event.accountId}`,
			);
			return;
		}

		let newStatus: typeof profile.razorpayStatus | undefined;
		let activatedAt: Date | undefined;

		switch (event.type) {
			case "account.activated":
				newStatus = "ACTIVATED";
				activatedAt = new Date();
				break;
			case "account.rejected":
				newStatus = "REJECTED";
				break;
			case "account.suspended":
				newStatus = "SUSPENDED";
				break;
			case "account.needs_clarification":
				newStatus = "NEEDS_CLARIFICATION";
				break;
			default:
				this.logger.log(
					`handleAccountWebhook: unhandled event type ${event.type}`,
				);
				return;
		}

		await this.db
			.update(organizationPayoutProfiles)
			.set({
				razorpayStatus: newStatus,
				statusReason: event.statusReason ?? null,
				...(activatedAt ? { activatedAt } : {}),
				updatedAt: new Date(),
			})
			.where(
				eq(organizationPayoutProfiles.organizationId, profile.organizationId),
			);

		// Notify the NGO team about significant status changes
		if (newStatus === "ACTIVATED") {
			void this.notifications.notifyOrganizationTeam(profile.organizationId, {
				type: "PAYOUT_ACTIVATED",
				title: "Payouts are now active",
				body: "Your bank account has been verified. Donations will now settle directly to your account.",
				entityName: "ORGANIZATION",
				entityId: profile.organizationId,
			});
		} else if (
			newStatus === "REJECTED" ||
			newStatus === "NEEDS_CLARIFICATION"
		) {
			void this.notifications.notifyOrganizationTeam(profile.organizationId, {
				type: "PAYOUT_ONBOARDING_FAILED",
				title: "Payout verification issue",
				body:
					event.statusReason ??
					"Your payout profile needs attention. Please contact support.",
				entityName: "ORGANIZATION",
				entityId: profile.organizationId,
			});
		}

		void this.audit.record({
			action: `PAYOUT_STATUS_${newStatus}`,
			entityName: "ORGANIZATION",
			entityId: profile.organizationId,
			newValue: { razorpayStatus: newStatus, statusReason: event.statusReason },
		});
	}

	/**
	 * Re-triggers Razorpay onboarding for profiles stuck in a retryable state.
	 * Only superadmins call this endpoint.
	 */
	async retrySync(organizationId: string): Promise<void> {
		const profile = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.organizationId, organizationId),
			columns: { razorpayStatus: true },
		});

		if (!profile) {
			throw new NotFoundException(
				"No payout profile found for this organization.",
			);
		}

		const retryableStatuses = [
			"NOT_STARTED",
			"SUBMITTED",
			"NEEDS_CLARIFICATION",
			"REJECTED",
		] as const;

		if (
			!retryableStatuses.includes(
				profile.razorpayStatus as (typeof retryableStatuses)[number],
			)
		) {
			throw new BadRequestException(
				`Cannot retry onboarding in status ${profile.razorpayStatus}. ` +
					`Only ${retryableStatuses.join(", ")} are retryable.`,
			);
		}

		// Reset identifiers so the 4-step flow restarts cleanly
		await this.db
			.update(organizationPayoutProfiles)
			.set({
				razorpayAccountId: null,
				razorpayStakeholderId: null,
				razorpayStatus: "NOT_STARTED",
				statusReason: null,
				updatedAt: new Date(),
			})
			.where(eq(organizationPayoutProfiles.organizationId, organizationId));

		// Fire-and-forget, same as the original trigger from reviewOrganization
		void this.startOnboarding(organizationId);
	}

	/**
	 * Reconciles payout profile status directly against Razorpay API.
	 */
	async syncStatus(organizationId: string): Promise<PayoutProfileView> {
		const profile = await this.db.query.organizationPayoutProfiles.findFirst({
			where: eq(organizationPayoutProfiles.organizationId, organizationId),
		});

		if (!profile) {
			throw new NotFoundException(
				"No payout profile found for this organization.",
			);
		}

		if (!profile.razorpayAccountId) {
			return this.toView(profile);
		}

		if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
			try {
				const account = await this.razorpayRoute.getAccount(
					profile.razorpayAccountId,
				);
				let mappedStatus: typeof profile.razorpayStatus | undefined;

				if (account.status === "activated") mappedStatus = "ACTIVATED";
				else if (account.status === "under_review")
					mappedStatus = "UNDER_REVIEW";
				else if (account.status === "suspended") mappedStatus = "SUSPENDED";
				else if (account.status === "needs_clarification")
					mappedStatus = "NEEDS_CLARIFICATION";

				if (mappedStatus && mappedStatus !== profile.razorpayStatus) {
					const [updated] = await this.db
						.update(organizationPayoutProfiles)
						.set({
							razorpayStatus: mappedStatus,
							...(mappedStatus === "ACTIVATED" && !profile.activatedAt
								? { activatedAt: new Date() }
								: {}),
							updatedAt: new Date(),
						})
						.where(
							eq(organizationPayoutProfiles.organizationId, organizationId),
						)
						.returning();

					return this.toView(updated);
				}
			} catch (err) {
				this.logger.warn(
					`syncStatus: error fetching Razorpay account ${profile.razorpayAccountId}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		return this.toView(profile);
	}

	/**
	 * Initiates a full refund for a completed donation.
	 * When Route transfers are attached, reverses the transfer to the linked account.
	 */
	async refundDonation(
		adminId: string,
		donationId: string,
	): Promise<{ message: string; refundId: string }> {
		const donation = await this.db.query.donations.findFirst({
			where: eq(donations.id, donationId),
		});

		if (!donation) {
			throw new NotFoundException("Donation not found");
		}

		if (donation.status !== "COMPLETED") {
			throw new BadRequestException(
				`Only completed donations can be refunded. Current status is ${donation.status}.`,
			);
		}

		if (!donation.providerPaymentId) {
			throw new BadRequestException(
				"No payment provider reference found for this donation.",
			);
		}

		let refundId = `stub_rfnd_${randomUUID()}`;

		// If real Razorpay credentials exist, call Razorpay refund with reverse_all: 1
		if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
			const result = await this.razorpayRoute.refundPayment(
				donation.providerPaymentId,
				donation.amountMinor,
				true, // reverse_all = 1 (reverses Route transfer to linked account)
			);
			refundId = result.id;
		}

		await this.db
			.update(donations)
			.set({
				status: "REFUNDED",
				transferStatus: donation.destinationAccountId ? "REVERSED" : null,
				updatedAt: new Date(),
			})
			.where(eq(donations.id, donationId));

		void this.audit.record({
			performedBy: adminId,
			action: "DONATION_REFUNDED",
			entityName: "DONATION",
			entityId: donationId,
			newValue: { refundId, amountMinor: donation.amountMinor },
		});

		return {
			message: "Donation refund processed successfully.",
			refundId,
		};
	}
}
