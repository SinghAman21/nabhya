import type { db as dbType } from "@nabhya/db";
import { donations, financialReports, organizations } from "@nabhya/db/schema";
import {
	type AdminDonationFilter,
	type AdminDonationQuery,
	type AdminDonationSummary,
	type AdminFinancialReportQuery,
	type ExportFile,
	MAX_EXPORT_ROWS,
} from "@nabhya/shared";
import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	ilike,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
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
	toCsv,
	toOffset,
} from "../../common/utils";
import { orderBySort } from "../../common/utils/order";

/**
 * The superadmin's money console: the platform-wide donation ledger, its CSV
 * export, and every NGO's transparency documents in one list.
 *
 * Its own service rather than more of `AdminService`, which is already the
 * moderation surface; nothing here moderates anything.
 *
 * Access policy, decided once here rather than per screen:
 * - Superadmins see every status, and the donor's real name and email even on
 *   an anonymous gift. Anonymity is a promise about the public page and the
 *   NGO, not about the platform that answers for the money.
 * - Every export is audited (`DONATIONS_EXPORTED`) with the filters used and
 *   the row count, because an export is the one action here that lets donor
 *   data leave the system.
 */
@Injectable()
export class FinanceService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	async listDonations(query: AdminDonationQuery) {
		const where = this.donationWhere(query);
		const { limit, offset } = toOffset(query);

		const [items, [totals], summary] = await Promise.all([
			this.ledgerSelect()
				.where(where)
				.orderBy(
					...orderBySort(
						query.sort,
						query.dir,
						{
							createdAt: donations.createdAt,
							amount: donations.amountMinor,
							organization: organizations.organizationName,
							status: donations.status,
						},
						{ column: donations.createdAt, dir: "desc" },
						donations.id,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(donations)
				.innerJoin(
					organizations,
					eq(donations.organizationId, organizations.id),
				)
				.where(where),
			this.summarise(where),
		]);

		return { ...paginate(items, totals?.value ?? 0, query), summary };
	}

	/** The filtered ledger as CSV in private storage, behind a signed link. */
	async exportDonations(
		adminId: string,
		filter: AdminDonationFilter,
	): Promise<ExportFile> {
		const rows = await this.ledgerSelect()
			.where(this.donationWhere(filter))
			.orderBy(desc(donations.createdAt), desc(donations.id))
			// One over the cap tells us the export was cut short.
			.limit(MAX_EXPORT_ROWS + 1);

		const truncated = rows.length > MAX_EXPORT_ROWS;
		const included = truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows;

		const csv = toCsv(
			[
				"Created (IST)",
				"Completed (IST)",
				"Status",
				"Amount",
				"Currency",
				"Receipt number",
				"NGO",
				"NGO id",
				"Donor name",
				"Donor email",
				"Anonymous",
				"Guest",
				"Message",
				"Provider",
				"Payment id",
				"Failure reason",
				"Donation id",
			],
			included.map((row) => [
				istTimestamp(row.createdAt),
				istTimestamp(row.completedAt),
				row.status,
				// Rupees with paise, as a number a spreadsheet can sum.
				Number((row.amountMinor / 100).toFixed(2)),
				row.currency,
				row.receiptNumber,
				row.organization.organizationName,
				row.organization.id,
				row.donorName,
				row.donorEmail,
				row.isAnonymous ? "Yes" : "No",
				row.donorUserId ? "No" : "Yes",
				row.message,
				row.provider,
				row.providerPaymentId,
				row.failureReason,
				row.id,
			]),
		);

		const file = await this.storeExport(adminId, "donations", csv);

		void this.audit.record({
			performedBy: adminId,
			action: "DONATIONS_EXPORTED",
			entityName: "DONATION",
			newValue: { filter, rowCount: included.length, truncated },
		});

		return { ...file, rowCount: included.length, truncated };
	}

	async listFinancialReports(query: AdminFinancialReportQuery) {
		const conditions: SQL[] = [];
		if (query.organizationId) {
			conditions.push(
				eq(financialReports.organizationId, query.organizationId),
			);
		}
		if (query.type) conditions.push(eq(financialReports.type, query.type));
		if (query.financialYear) {
			conditions.push(eq(financialReports.financialYear, query.financialYear));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(financialReports.title, term),
				ilike(organizations.organizationName, term),
			);
			if (match) conditions.push(match);
		}

		const where = conditions.length ? and(...conditions) : undefined;
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: financialReports.id,
					type: financialReports.type,
					title: financialReports.title,
					financialYear: financialReports.financialYear,
					documentKey: financialReports.documentKey,
					notes: financialReports.notes,
					createdAt: financialReports.createdAt,
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						status: organizations.status,
						verificationStatus: organizations.verificationStatus,
					},
				})
				.from(financialReports)
				.innerJoin(
					organizations,
					eq(financialReports.organizationId, organizations.id),
				)
				.where(where)
				.orderBy(
					desc(financialReports.financialYear),
					desc(financialReports.createdAt),
					desc(financialReports.id),
				)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(financialReports)
				.innerJoin(
					organizations,
					eq(financialReports.organizationId, organizations.id),
				)
				.where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private ledgerSelect() {
		return this.db
			.select({
				id: donations.id,
				amountMinor: donations.amountMinor,
				currency: donations.currency,
				status: donations.status,
				receiptNumber: donations.receiptNumber,
				providerPaymentId: donations.providerPaymentId,
				provider: donations.provider,
				isAnonymous: donations.isAnonymous,
				donorUserId: donations.donorUserId,
				donorName: donations.donorName,
				donorEmail: donations.donorEmail,
				message: donations.message,
				failureReason: donations.failureReason,
				createdAt: donations.createdAt,
				completedAt: donations.completedAt,
				organization: {
					id: organizations.id,
					organizationName: organizations.organizationName,
				},
			})
			.from(donations)
			.innerJoin(organizations, eq(donations.organizationId, organizations.id));
	}

	private donationWhere(filter: AdminDonationFilter): SQL | undefined {
		const conditions: SQL[] = [];
		if (filter.status) conditions.push(eq(donations.status, filter.status));
		if (filter.organizationId) {
			conditions.push(eq(donations.organizationId, filter.organizationId));
		}
		if (filter.from) {
			conditions.push(gte(donations.createdAt, istDayStart(filter.from)));
		}
		if (filter.to) {
			conditions.push(lt(donations.createdAt, istDayEnd(filter.to)));
		}
		if (filter.search) {
			const term = `%${filter.search}%`;
			const match = or(
				ilike(donations.donorName, term),
				ilike(donations.donorEmail, term),
				ilike(donations.receiptNumber, term),
				ilike(donations.providerPaymentId, term),
			);
			if (match) conditions.push(match);
		}
		return conditions.length ? and(...conditions) : undefined;
	}

	private async summarise(
		where: SQL | undefined,
	): Promise<AdminDonationSummary> {
		const [row] = await this.db
			.select({
				completedMinor: sql<number>`coalesce(sum(${donations.amountMinor})
					filter (where ${donations.status} = 'COMPLETED'), 0)::int`,
				completedCount: sql<number>`count(*)
					filter (where ${donations.status} = 'COMPLETED')::int`,
				pendingCount: sql<number>`count(*)
					filter (where ${donations.status} = 'PENDING')::int`,
				failedCount: sql<number>`count(*)
					filter (where ${donations.status} = 'FAILED')::int`,
				refundedMinor: sql<number>`coalesce(sum(${donations.amountMinor})
					filter (where ${donations.status} = 'REFUNDED'), 0)::int`,
				refundedCount: sql<number>`count(*)
					filter (where ${donations.status} = 'REFUNDED')::int`,
				// Guests have no user id; count them by email so the total is
				// people, not accounts.
				donorCount: countDistinct(
					sql`coalesce(${donations.donorUserId}::text, lower(${donations.donorEmail}))`,
				),
			})
			.from(donations)
			.innerJoin(organizations, eq(donations.organizationId, organizations.id))
			.where(where);

		return {
			completedMinor: Number(row?.completedMinor ?? 0),
			completedCount: Number(row?.completedCount ?? 0),
			pendingCount: Number(row?.pendingCount ?? 0),
			failedCount: Number(row?.failedCount ?? 0),
			refundedMinor: Number(row?.refundedMinor ?? 0),
			refundedCount: Number(row?.refundedCount ?? 0),
			donorCount: Number(row?.donorCount ?? 0),
		};
	}

	private async storeExport(ownerId: string, name: string, csv: string) {
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `nabhya-${name}-${stamp}.csv`;
		const key = `${NGO_VERIFICATION_BUCKET}/exports/${ownerId}/${fileName}`;
		await this.storage.putObject({
			key,
			body: new TextEncoder().encode(csv),
			contentType: "text/csv",
		});
		return { url: await this.storage.createDownloadUrl(key), fileName };
	}
}
