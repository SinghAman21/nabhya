import type { db as dbType } from "@nabhya/db";
import {
	donations,
	organizationPayoutProfiles,
	organizations,
} from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import type {
	CreateDonationInput,
	DonationCheckout,
	DonationQuery,
	DonationStats,
	ExportFile,
	OrgDonationExportQuery,
	OrgDonationQuery,
} from "@nabhya/shared";
import { MAX_EXPORT_ROWS } from "@nabhya/shared";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { MailService } from "../../common/mail";
import {
	NGO_VERIFICATION_BUCKET,
	STORAGE_TOKEN,
	type StorageProvider,
} from "../../common/storage";
import {
	istDayEnd,
	istDayStart,
	istTimestamp,
	paginate,
	takeFirstOrThrow,
	toCsv,
	toOffset,
} from "../../common/utils";
import { orderBySort } from "../../common/utils/order";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PayoutsService } from "../payouts/payouts.service";
import { PAYMENT_PROVIDER_TOKEN, type PaymentProvider } from "./payment.types";
import { formatReceiptAmount, renderReceiptPdf } from "./receipt-pdf";

@Injectable()
export class DonationsService {
	private readonly logger = new Logger(DonationsService.name);

	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(PAYMENT_PROVIDER_TOKEN)
		private readonly payments: PaymentProvider,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
		@Inject(MailService) private readonly mail: MailService,
		@Inject(PayoutsService)
		private readonly payoutsService: PayoutsService,
	) {}

	/**
	 * Starts a donation.
	 *
	 * The row is created PENDING with the amount we computed; only a verified
	 * webhook can move it to COMPLETED. Nothing the client sends afterwards can
	 * mark a donation paid.
	 */
	async createCheckout(
		input: CreateDonationInput,
		donor: { id: string; email: string; name: string | null } | null,
	): Promise<DonationCheckout> {
		// Only verified, active NGOs can receive money.
		const organization = await this.organizationsService.getPublicById(
			input.organizationId,
		);

		if (!donor && !input.donorEmail) {
			throw new BadRequestException(
				"Enter an email so we can send your receipt.",
			);
		}

		// Look up NGO payout profile for Route settlement
		const payoutProfile =
			await this.db.query.organizationPayoutProfiles.findFirst({
				where: eq(organizationPayoutProfiles.organizationId, organization.id),
			});

		// In live environments, gate direct donations on an activated payout profile
		if (
			this.payments.name !== "stub" &&
			(!payoutProfile ||
				payoutProfile.razorpayStatus !== "ACTIVATED" ||
				!payoutProfile.razorpayAccountId)
		) {
			throw new BadRequestException(
				"This organization cannot receive direct donations yet. Payout onboarding is pending.",
			);
		}

		const destinationAccountId = payoutProfile?.razorpayAccountId ?? null;
		const transferAmountMinor = input.amountMinor;

		const donation = takeFirstOrThrow(
			await this.db
				.insert(donations)
				.values({
					organizationId: organization.id,
					donorUserId: donor?.id ?? null,
					amountMinor: input.amountMinor,
					currency: "INR",
					status: "PENDING",
					provider: this.payments.name,
					message: input.message ?? null,
					isAnonymous: input.isAnonymous,
					donorName: donor?.name ?? input.donorName ?? null,
					donorEmail: donor?.email ?? input.donorEmail ?? null,
					wants80G: input.wants80G ?? false,
					donorPan: input.donorPan ?? null,
					donorAddress: input.donorAddress ?? null,
					platformFeeMinor: 0,
					transferAmountMinor: destinationAccountId
						? transferAmountMinor
						: null,
					destinationAccountId: destinationAccountId,
					transferStatus: destinationAccountId ? "PENDING" : null,
				})
				.returning(),
			"create donation",
		);

		const checkout = await this.payments.createCheckout({
			referenceId: donation.id,
			amountMinor: donation.amountMinor,
			currency: donation.currency,
			organizationName: organization.organizationName,
			donorName: donation.donorName,
			donorEmail: donation.donorEmail,
			destinationAccountId: destinationAccountId,
			transferAmountMinor: transferAmountMinor,
			returnUrl: `${env.CORS_ORIGIN.split(",")[0]}/donations/${donation.id}`,
		});

		await this.db
			.update(donations)
			.set({
				providerCheckoutId: checkout.providerCheckoutId,
				updatedAt: new Date(),
			})
			.where(eq(donations.id, donation.id));

		return {
			donationId: donation.id,
			checkoutUrl: checkout.checkoutUrl,
			orderId: checkout.providerCheckoutId,
			razorpayKeyId: checkout.publicKeyId,
			amountMinor: donation.amountMinor,
			currency: donation.currency,
		};
	}

	/**
	 * Applies a verified provider event.
	 *
	 * Idempotent by construction: the unique index on `provider_payment_id`
	 * plus the PENDING-only guard means a webhook replay cannot double-count a
	 * donation or re-notify the organization.
	 */
	async handleWebhook(rawBody: string, headers: Record<string, string>) {
		const event = this.payments.parseWebhook(rawBody, headers);

		if (event.kind === "IGNORED") {
			return { handled: false };
		}

		// Handle Account lifecycle events
		if (event.kind === "ACCOUNT_UPDATED") {
			if (event.accountId && event.accountEventType) {
				await this.payoutsService.handleAccountWebhook({
					type: event.accountEventType,
					accountId: event.accountId,
				});
				return { handled: true };
			}
			return { handled: false };
		}

		// Handle Route transfer events
		if (event.kind === "TRANSFER_PROCESSED") {
			if (!event.referenceId) return { handled: false };
			await this.db
				.update(donations)
				.set({
					transferStatus: "PROCESSED",
					razorpayTransferId: event.transferId ?? undefined,
					updatedAt: new Date(),
				})
				.where(eq(donations.id, event.referenceId));
			return { handled: true };
		}

		if (event.kind === "TRANSFER_FAILED") {
			if (!event.referenceId) return { handled: false };
			await this.db
				.update(donations)
				.set({
					transferStatus: "FAILED",
					razorpayTransferId: event.transferId ?? undefined,
					transferFailureReason: event.failureReason ?? null,
					updatedAt: new Date(),
				})
				.where(eq(donations.id, event.referenceId));
			return { handled: true };
		}

		if (!event.referenceId) {
			return { handled: false };
		}

		const donation = await this.db.query.donations.findFirst({
			where: eq(donations.id, event.referenceId),
		});

		if (!donation) {
			this.logger.warn(`Webhook for unknown donation ${event.referenceId}`);
			return { handled: false };
		}

		if (donation.status !== "PENDING") {
			// Already settled - a replay, or a duplicate delivery.
			return { handled: true, duplicate: true };
		}

		// Guards against a tampered or mismatched amount reaching the ledger.
		if (
			event.kind === "SUCCEEDED" &&
			event.amountMinor !== null &&
			event.amountMinor !== donation.amountMinor
		) {
			this.logger.error(
				`Amount mismatch on donation ${donation.id}: expected ${donation.amountMinor}, got ${event.amountMinor}`,
			);
			throw new BadRequestException("Donation amount mismatch");
		}

		if (event.kind === "SUCCEEDED") {
			await this.db
				.update(donations)
				.set({
					status: "COMPLETED",
					providerPaymentId: event.providerPaymentId,
					receiptNumber: buildReceiptNumber(donation.createdAt, donation.id),
					completedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(donations.id, donation.id));

			const organization = await this.db.query.organizations.findFirst({
				where: eq(organizations.id, donation.organizationId),
				columns: { ownerUserId: true, organizationName: true },
			});

			if (organization) {
				void this.notifications.notify({
					userId: organization.ownerUserId,
					type: "DONATION_RECEIVED",
					title: "You received a donation",
					body: donation.isAnonymous
						? "An anonymous donor supported your work."
						: `${donation.donorName ?? "Someone"} donated to your organization.`,
					entityName: "DONATION",
					entityId: donation.id,
				});
			}

			// Fire-and-forget like the audit write: a mail outage must not make
			// the provider retry a webhook whose payment is already recorded.
			void this.emailReceipt(donation.id);

			void this.audit.record({
				performedBy: donation.donorUserId,
				action: "DONATION_COMPLETED",
				entityName: "DONATION",
				entityId: donation.id,
				newValue: { amountMinor: donation.amountMinor },
			});
		} else {
			await this.db
				.update(donations)
				.set({
					status: event.kind === "REFUNDED" ? "REFUNDED" : "FAILED",
					providerPaymentId: event.providerPaymentId,
					failureReason: event.failureReason ?? null,
					transferStatus:
						event.kind === "REFUNDED" && donation.destinationAccountId
							? "REVERSED"
							: donation.transferStatus,
					updatedAt: new Date(),
				})
				.where(eq(donations.id, donation.id));
		}

		return { handled: true };
	}

	/** A donor's own history, including pending attempts. */
	async listMine(userId: string, query: DonationQuery) {
		const conditions: SQL[] = [eq(donations.donorUserId, userId)];
		if (query.status) conditions.push(eq(donations.status, query.status));

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: donations.id,
					amountMinor: donations.amountMinor,
					currency: donations.currency,
					status: donations.status,
					message: donations.message,
					isAnonymous: donations.isAnonymous,
					receiptNumber: donations.receiptNumber,
					completedAt: donations.completedAt,
					createdAt: donations.createdAt,
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
					},
				})
				.from(donations)
				.innerJoin(
					organizations,
					eq(donations.organizationId, organizations.id),
				)
				.where(where)
				.orderBy(desc(donations.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(donations).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/** What the receiving organization sees. Only settled money is listed. */
	async listForMyOrganization(userId: string, query: OrgDonationQuery) {
		await this.organizationsService.requireOrgPermission(userId, "money.view");
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const where = and(
			eq(donations.organizationId, organization.id),
			eq(donations.status, query.status ?? "COMPLETED"),
		);
		const { limit, offset } = toOffset(query);
		// The name as the response shows it. Sorting by the raw column would put
		// an anonymous gift where its hidden name falls, which is the name.
		const shownDonor = sql`case when ${donations.isAnonymous}
			then null else ${donations.donorName} end`;

		const [items, [totals], stats] = await Promise.all([
			this.db
				.select({
					id: donations.id,
					amountMinor: donations.amountMinor,
					currency: donations.currency,
					status: donations.status,
					message: donations.message,
					isAnonymous: donations.isAnonymous,
					receiptNumber: donations.receiptNumber,
					completedAt: donations.completedAt,
					createdAt: donations.createdAt,
					// Anonymity is enforced here, not in the client.
					donorName: sql<string | null>`case when ${donations.isAnonymous}
						then null else ${donations.donorName} end`,
				})
				.from(donations)
				.where(where)
				.orderBy(
					...orderBySort(
						query.sort,
						query.dir,
						{
							createdAt: donations.createdAt,
							amount: donations.amountMinor,
							donor: shownDonor,
						},
						{ column: donations.createdAt, dir: "desc" },
						donations.id,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(donations).where(where),
			this.getStats(organization.id),
		]);

		return { ...paginate(items, totals?.value ?? 0, query), stats };
	}

	/**
	 * The NGO's "Download report": its donations as CSV.
	 *
	 * The same view the NGO already has, in a file - settled donations by
	 * default, the donor's name only where the donor allowed it, and never the
	 * donor's email, which the NGO's list does not show either. Gated on
	 * `money.view` like the list, and audited because the file leaves the app.
	 */
	async exportForMyOrganization(
		userId: string,
		query: OrgDonationExportQuery,
	): Promise<ExportFile> {
		await this.organizationsService.requireOrgPermission(userId, "money.view");
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const conditions: SQL[] = [
			eq(donations.organizationId, organization.id),
			eq(donations.status, query.status ?? "COMPLETED"),
		];
		if (query.from) {
			conditions.push(gte(donations.createdAt, istDayStart(query.from)));
		}
		if (query.to) {
			conditions.push(lt(donations.createdAt, istDayEnd(query.to)));
		}

		const rows = await this.db
			.select({
				id: donations.id,
				amountMinor: donations.amountMinor,
				currency: donations.currency,
				status: donations.status,
				receiptNumber: donations.receiptNumber,
				message: donations.message,
				isAnonymous: donations.isAnonymous,
				donorName: sql<string | null>`case when ${donations.isAnonymous}
					then null else ${donations.donorName} end`,
				createdAt: donations.createdAt,
				completedAt: donations.completedAt,
			})
			.from(donations)
			.where(and(...conditions))
			.orderBy(desc(donations.createdAt), desc(donations.id))
			.limit(MAX_EXPORT_ROWS + 1);

		const truncated = rows.length > MAX_EXPORT_ROWS;
		const included = truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows;

		const csv = toCsv(
			[
				"Received (IST)",
				"Status",
				"Amount",
				"Currency",
				"Receipt number",
				"Donor",
				"Message",
				"Donation id",
			],
			included.map((row) => [
				istTimestamp(row.completedAt ?? row.createdAt),
				row.status,
				Number((row.amountMinor / 100).toFixed(2)),
				row.currency,
				row.receiptNumber,
				row.isAnonymous ? "Anonymous" : (row.donorName ?? ""),
				row.message,
				row.id,
			]),
		);

		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `nabhya-donations-${stamp}.csv`;
		const key = `${NGO_VERIFICATION_BUCKET}/exports/${organization.id}/${fileName}`;
		await this.storage.putObject({
			key,
			body: new TextEncoder().encode(csv),
			contentType: "text/csv",
		});

		void this.audit.record({
			performedBy: userId,
			action: "ORG_DONATIONS_EXPORTED",
			entityName: "ORGANIZATION",
			entityId: organization.id,
			newValue: { ...query, rowCount: included.length, truncated },
		});

		return {
			url: await this.storage.createDownloadUrl(key),
			fileName,
			rowCount: included.length,
			truncated,
		};
	}

	async getStats(organizationId: string): Promise<DonationStats> {
		const [row] = await this.db
			.select({
				totalMinor: sql<number>`coalesce(sum(${donations.amountMinor})
					filter (where ${donations.status} = 'COMPLETED'), 0)::int`,
				completedCount: sql<number>`count(*)
					filter (where ${donations.status} = 'COMPLETED')::int`,
				pendingCount: sql<number>`count(*)
					filter (where ${donations.status} = 'PENDING')::int`,
				// Donors beside "Received" and "Donations" count the same rows:
				// settled gifts only. Counting every status put "1 donor" next to
				// "0 donations" while a payment was still confirming.
				donorCount: sql<number>`count(distinct ${donations.donorUserId})
					filter (where ${donations.status} = 'COMPLETED')::int`,
			})
			.from(donations)
			.where(eq(donations.organizationId, organizationId));

		return {
			totalMinor: row?.totalMinor ?? 0,
			completedCount: row?.completedCount ?? 0,
			pendingCount: row?.pendingCount ?? 0,
			donorCount: row?.donorCount ?? 0,
		};
	}

	/** Receipt for a settled donation, fetchable only by its donor. */
	async getReceipt(userId: string, donationId: string) {
		const row = await this.findReceiptRow(donationId);

		if (!row) throw new NotFoundException("Donation not found");
		if (row.donorUserId !== userId) {
			throw new NotFoundException("Donation not found");
		}
		if (row.status !== "COMPLETED") {
			throw new BadRequestException(
				"A receipt is only available once the payment completes.",
			);
		}

		const { provider: _provider, ...receipt } = row;
		return receipt;
	}

	/**
	 * Signed link to the receipt PDF, rendering it first if storage has never
	 * had it or lost it - the same recover-on-read rule as certificate PDFs.
	 * The key is derived from the donation, so there is no column to keep in
	 * step with the object.
	 */
	async getReceiptPdfUrl(userId: string, donationId: string) {
		const receipt = await this.getReceipt(userId, donationId);
		const key = receiptKey(donationId, receipt.receiptNumber);

		if (!(await this.storage.head(key))) {
			await this.storeReceiptPdf(donationId);
		}

		return { url: await this.storage.createDownloadUrl(key) };
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private async findReceiptRow(donationId: string) {
		const [row] = await this.db
			.select({
				id: donations.id,
				receiptNumber: donations.receiptNumber,
				amountMinor: donations.amountMinor,
				currency: donations.currency,
				status: donations.status,
				completedAt: donations.completedAt,
				donorName: donations.donorName,
				donorEmail: donations.donorEmail,
				donorUserId: donations.donorUserId,
				provider: donations.provider,
				paymentReference: donations.providerPaymentId,
				wants80G: donations.wants80G,
				donorPan: donations.donorPan,
				donorAddress: donations.donorAddress,
				destinationAccountId: donations.destinationAccountId,
				organizationName: organizations.organizationName,
				organizationCity: organizations.city,
				organizationRegistration: organizations.registrationNumber,
				organizationPan: organizationPayoutProfiles.pan,
			})
			.from(donations)
			.innerJoin(organizations, eq(donations.organizationId, organizations.id))
			.leftJoin(
				organizationPayoutProfiles,
				eq(organizationPayoutProfiles.organizationId, organizations.id),
			)
			.where(eq(donations.id, donationId))
			.limit(1);
		return row;
	}

	/** Renders and stores the receipt; returns the bytes for the email. */
	private async storeReceiptPdf(donationId: string) {
		const row = await this.findReceiptRow(donationId);
		if (!row || row.status !== "COMPLETED" || !row.receiptNumber) {
			throw new BadRequestException(
				"A receipt is only available once the payment completes.",
			);
		}

		const pdf = await renderReceiptPdf({
			receiptNumber: row.receiptNumber,
			amountMinor: row.amountMinor,
			currency: row.currency,
			completedAt: row.completedAt ?? new Date(),
			donorName: row.donorName,
			donorEmail: row.donorEmail,
			organizationName: row.organizationName,
			organizationCity: row.organizationCity,
			organizationRegistration: row.organizationRegistration,
			paymentReference: row.paymentReference,
			provider: row.provider,
			wants80G: row.wants80G,
			donorPan: row.donorPan,
			donorAddress: row.donorAddress,
			organizationPan: row.organizationPan,
			isDirectSettlement: Boolean(row.destinationAccountId),
		});

		await this.storage.putObject({
			key: receiptKey(donationId, row.receiptNumber),
			body: pdf,
			contentType: "application/pdf",
		});

		return { row, pdf };
	}

	/**
	 * Emails the receipt to the donor's address - the account email for a
	 * signed-in donor, the one they typed for a guest. Never throws: it runs
	 * after the webhook has already committed the payment.
	 */
	private async emailReceipt(donationId: string) {
		try {
			const { row, pdf } = await this.storeReceiptPdf(donationId);
			if (!row.donorEmail || !row.receiptNumber) return;

			await this.mail.sendDonationReceipt({
				to: row.donorEmail,
				donorName: row.donorName,
				organizationName: row.organizationName,
				amount: formatReceiptAmount(row.amountMinor, row.currency),
				receiptNumber: row.receiptNumber,
				completedAt: row.completedAt ?? new Date(),
				pdf,
			});
		} catch (error) {
			this.logger.error(
				`Receipt for donation ${donationId} was not emailed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

/**
 * Receipts carry the donor's name and email, so they live in the private
 * documents bucket rather than feed media. The first key segment is the
 * bucket (see `splitKey` in the Supabase provider).
 */
function receiptKey(donationId: string, receiptNumber: string | null) {
	return `${NGO_VERIFICATION_BUCKET}/receipts/${donationId}/${receiptNumber ?? "receipt"}.pdf`;
}

/** e.g. NBH-2607-3F9A21 - year/month plus a slice of the uuid. */
function buildReceiptNumber(createdAt: Date, id: string): string {
	const year = String(createdAt.getFullYear()).slice(2);
	const month = String(createdAt.getMonth() + 1).padStart(2, "0");
	return `NBH-${year}${month}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
