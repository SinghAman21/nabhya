import type { db as dbType } from "@nabhya/db";
import { donations, organizations } from "@nabhya/db/schema";
import { env } from "@nabhya/env/server";
import type {
	CreateDonationInput,
	DonationCheckout,
	DonationQuery,
	DonationStats,
} from "@nabhya/shared";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	type SQL,
	sql,
} from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PAYMENT_PROVIDER_TOKEN, type PaymentProvider } from "./payment.types";

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

		if (event.kind === "IGNORED" || !event.referenceId) {
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
			// Already settled — a replay, or a duplicate delivery.
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
	async listForMyOrganization(userId: string, query: DonationQuery) {
		await this.organizationsService.requireOrgPermission(userId, "money.view");
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const where = and(
			eq(donations.organizationId, organization.id),
			eq(donations.status, query.status ?? "COMPLETED"),
		);
		const { limit, offset } = toOffset(query);

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
				.orderBy(desc(donations.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(donations).where(where),
			this.getStats(organization.id),
		]);

		return { ...paginate(items, totals?.value ?? 0, query), stats };
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
				donorCount: countDistinct(donations.donorUserId),
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
				organizationName: organizations.organizationName,
				organizationCity: organizations.city,
			})
			.from(donations)
			.innerJoin(organizations, eq(donations.organizationId, organizations.id))
			.where(eq(donations.id, donationId))
			.limit(1);

		if (!row) throw new NotFoundException("Donation not found");
		if (row.donorUserId !== userId) {
			throw new NotFoundException("Donation not found");
		}
		if (row.status !== "COMPLETED") {
			throw new BadRequestException(
				"A receipt is only available once the payment completes.",
			);
		}

		return row;
	}
}

/** e.g. NBH-2607-3F9A21 — year/month plus a slice of the uuid. */
function buildReceiptNumber(createdAt: Date, id: string): string {
	const year = String(createdAt.getFullYear()).slice(2);
	const month = String(createdAt.getMonth() + 1).padStart(2, "0");
	return `NBH-${year}${month}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
