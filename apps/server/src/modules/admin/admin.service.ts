import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	auditLogs,
	categories,
	certificates,
	donations,
	eventApplications,
	events,
	financialReports,
	needPledges,
	needs,
	organizationCategories,
	organizationDocuments,
	organizations,
	posts,
	reviews,
	roles,
	userCategories,
	userDocuments,
	userRoles,
	users,
} from "@nabhya/db/schema";
import {
	type AdminActivityItem,
	type AdminActivityQuery,
	type AdminAnalytics,
	type AdminAnalyticsPoint,
	type AdminAnalyticsQuery,
	type AdminOrgQuery,
	type AdminOverview,
	type AdminTrendPoint,
	type AdminTrends,
	type AdminUserQuery,
	type AuditLogQuery,
	type BulkReviewDocumentsInput,
	type BulkReviewResult,
	computeUserVerificationStatus,
	type DocumentQueueQuery,
	type ReviewDocumentInput,
	type ReviewOrganizationInput,
	type SetOrgStatusInput,
	type SetUserStatusInput,
	type SortDir,
} from "@nabhya/shared";
import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, toOffset } from "../../common/utils";

/**
 * Turns a validated sort key into an `ORDER BY`.
 *
 * Sorting is server-side across the whole result set, not client-side over the
 * loaded pages - see the note on the sort schemas in `@nabhya/shared`. The
 * column comes from a lookup table keyed by the Zod enum, so an unmapped key
 * cannot reach SQL: the enum rejects it at the boundary, and `?? fallback`
 * covers the impossible case rather than emitting an unordered query, which
 * would silently make paging non-deterministic.
 *
 * Every list adds its own default column as a tiebreaker. Postgres gives no
 * stable order for rows equal on the sort key, so without one, paging a list
 * sorted by (say) verification status can show the same row twice and skip
 * another.
 */
function orderFor<K extends string>(
	sort: K,
	dir: SortDir,
	columns: Record<K, PgColumn | SQL>,
	tiebreak: PgColumn,
): Array<SQL> {
	const direction = dir === "asc" ? asc : desc;
	const column = columns[sort];
	if (!column) return [desc(tiebreak)];
	// Only add the tiebreaker when it is not already the sort key.
	return column === tiebreak
		? [direction(column)]
		: [direction(column), desc(tiebreak)];
}

/**
 * Midnight UTC for a moment. The trend buckets are UTC days, so the window's
 * edges have to be too - using local midnight would shift every bucket the day
 * the deploy region changed.
 */
function startOfUtcDay(at: Date): Date {
	const day = new Date(at);
	day.setUTCHours(0, 0, 0, 0);
	return day;
}

function activityItem(
	input: Omit<AdminActivityItem, "groupKey" | "groupLabel">,
): AdminActivityItem {
	const occurredAt = new Date(input.occurredAt);
	const groupKey = occurredAt.toISOString().slice(0, 10);
	return {
		...input,
		occurredAt: occurredAt.toISOString(),
		groupKey,
		groupLabel: groupKey,
	};
}

function sumValues(rows: Array<{ value: number | string | null | undefined }>) {
	return rows.reduce((total, row) => total + Number(row.value ?? 0), 0);
}

function indexSeries(
	rows: Array<{
		day: string;
		amountMinor?: number | string | null;
		count?: number | string | null;
	}>,
) {
	return new Map(
		rows.map((row) => [
			row.day,
			{
				amountMinor: Number(row.amountMinor ?? 0),
				count: Number(row.count ?? 0),
			},
		]),
	);
}

@Injectable()
export class AdminService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
	) {}

	// ─── Overview ────────────────────────────────────────────────────────────

	/**
	 * Every tile on the superadmin dashboard in one round trip.
	 *
	 * Each metric is a filtered COUNT aggregated in a single scan per table
	 * rather than one query per tile.
	 */
	async getOverview(): Promise<AdminOverview> {
		const countWhere = (condition: SQL) =>
			sql<number>`count(*) filter (where ${condition})::int`;

		const [orgStats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				pending: countWhere(eq(organizations.verificationStatus, "PENDING")),
				underReview: countWhere(
					eq(organizations.verificationStatus, "UNDER_REVIEW"),
				),
				verified: countWhere(eq(organizations.verificationStatus, "VERIFIED")),
				rejected: countWhere(eq(organizations.verificationStatus, "REJECTED")),
				suspended: countWhere(eq(organizations.status, "SUSPENDED")),
			})
			.from(organizations);

		const [userStats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				suspended: countWhere(eq(users.status, "SUSPENDED")),
				pendingVerification: countWhere(
					eq(users.verificationStatus, "PENDING"),
				),
			})
			.from(users);

		const roleCounts = await this.db
			.select({ role: roles.name, value: count() })
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.groupBy(roles.name);

		const byRole = Object.fromEntries(
			roleCounts.map((r) => [r.role, Number(r.value)]),
		);

		const now = new Date();
		const [eventStats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				published: countWhere(eq(events.status, "PUBLISHED")),
				upcoming: countWhere(
					and(eq(events.status, "PUBLISHED"), gte(events.startAt, now)) as SQL,
				),
			})
			.from(events);

		const [needStats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				open: countWhere(eq(needs.status, "OPEN")),
				wants: countWhere(eq(needs.type, "WANT")),
				offers: countWhere(eq(needs.type, "OFFER")),
			})
			.from(needs);

		const [applicationStats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				pending: countWhere(eq(eventApplications.status, "PENDING")),
				accepted: countWhere(eq(eventApplications.status, "ACCEPTED")),
			})
			.from(eventApplications);

		const [[orgDocs], [userDocs]] = await Promise.all([
			this.db
				.select({ value: count() })
				.from(organizationDocuments)
				.where(eq(organizationDocuments.verificationStatus, "PENDING")),
			this.db
				.select({ value: count() })
				.from(userDocuments)
				.where(eq(userDocuments.verificationStatus, "PENDING")),
		]);

		// An aggregate without GROUP BY always returns exactly one row; the
		// fallbacks satisfy noUncheckedIndexedAccess rather than a real case.
		const zeroOrgs = {
			total: 0,
			pending: 0,
			underReview: 0,
			verified: 0,
			rejected: 0,
			suspended: 0,
		};

		return {
			organizations: orgStats ?? zeroOrgs,
			users: {
				total: userStats?.total ?? 0,
				volunteers: byRole.volunteer ?? 0,
				organisations: byRole.organisation ?? 0,
				suspended: userStats?.suspended ?? 0,
				pendingVerification: userStats?.pendingVerification ?? 0,
			},
			events: eventStats ?? { total: 0, published: 0, upcoming: 0 },
			needs: needStats ?? { total: 0, open: 0, wants: 0, offers: 0 },
			applications: applicationStats ?? { total: 0, pending: 0, accepted: 0 },
			documents: {
				pendingOrgDocuments: orgDocs?.value ?? 0,
				pendingUserDocuments: userDocs?.value ?? 0,
			},
		};
	}

	/**
	 * The Overview's time series: new NGOs, new volunteers, events created and
	 * applications made, per day, over the window - plus the totals for it and
	 * for the window immediately before, so the client can show a delta without
	 * a second request.
	 *
	 * Four `GROUP BY date` scans rather than one query. A single query would
	 * need four FULL OUTER JOINs on a generated date series, which is both
	 * harder to read and no faster: each of these is an index-friendly range
	 * scan over one table's `created_at`.
	 *
	 * **The day key is `to_char(column, 'YYYY-MM-DD')` with no timezone
	 * conversion, and that is load-bearing.** Every `created_at` in this schema
	 * is `timestamp` *without* time zone (see `packages/db/src/schema`), already
	 * holding UTC. Writing `date_trunc('day', column at time zone 'UTC')` on
	 * such a column casts naive → `timestamptz` and then truncates in the
	 * **session** zone, so the bucket a row lands in depends on the database's
	 * `TimeZone` setting - which silently produced all-zero series here. The
	 * window bounds are compared against the same naive column, so both sides
	 * agree without either knowing a zone.
	 */
	async getTrends(days: number): Promise<AdminTrends> {
		const start = startOfUtcDay(new Date());
		start.setUTCDate(start.getUTCDate() - (days - 1));
		const previousStart = new Date(start);
		previousStart.setUTCDate(previousStart.getUTCDate() - days);

		const perDay = async (
			table: typeof organizations | typeof events | typeof eventApplications,
			column: PgColumn,
			from: Date,
			extra?: SQL,
		) => {
			const where = extra ? and(gte(column, from), extra) : gte(column, from);
			return this.db
				.select({
					day: sql<string>`to_char(${column}, 'YYYY-MM-DD')`,
					value: sql<number>`count(*)::int`,
				})
				.from(table as never)
				.where(where)
				.groupBy(sql`1`);
		};

		// Volunteers are a role, which lives in a join table; EXISTS keeps the
		// count right for an account holding more than one role.
		const volunteerFilter = sql`exists (
			select 1 from ${userRoles}
			join ${roles} on ${roles.id} = ${userRoles.roleId}
			where ${userRoles.userId} = ${users.id} and ${roles.name} = 'volunteer'
		)`;

		const [orgRows, volunteerRows, eventRows, applicationRows] =
			await Promise.all([
				perDay(organizations, organizations.createdAt, previousStart),
				this.db
					.select({
						day: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`,
						value: sql<number>`count(*)::int`,
					})
					.from(users)
					.where(and(gte(users.createdAt, previousStart), volunteerFilter))
					.groupBy(sql`1`),
				perDay(events, events.createdAt, previousStart),
				perDay(eventApplications, eventApplications.appliedAt, previousStart),
			]);

		const index = (
			rows: Array<{ day: string; value: number }>,
		): Map<string, number> => new Map(rows.map((r) => [r.day, r.value]));

		const byDay = {
			organizations: index(orgRows),
			volunteers: index(volunteerRows),
			events: index(eventRows),
			applications: index(applicationRows),
		};

		// Zero-fill. A GROUP BY only returns days that had a row, and a line
		// drawn straight across the gaps claims steady activity where there was
		// none. See the note on `AdminTrends` in @nabhya/shared.
		const points: AdminTrendPoint[] = [];
		const zero = () => ({
			organizations: 0,
			volunteers: 0,
			events: 0,
			applications: 0,
		});
		const totals = zero();
		const previousTotals = zero();

		for (let offset = -days; offset < days; offset += 1) {
			const day = new Date(start);
			day.setUTCDate(day.getUTCDate() + offset);
			const key = day.toISOString().slice(0, 10);

			const point: AdminTrendPoint = {
				date: key,
				organizations: byDay.organizations.get(key) ?? 0,
				volunteers: byDay.volunteers.get(key) ?? 0,
				events: byDay.events.get(key) ?? 0,
				applications: byDay.applications.get(key) ?? 0,
			};

			const bucket = offset < 0 ? previousTotals : totals;
			bucket.organizations += point.organizations;
			bucket.volunteers += point.volunteers;
			bucket.events += point.events;
			bucket.applications += point.applications;

			// Only the current window is plotted; the previous one exists to be
			// summed for the delta.
			if (offset >= 0) points.push(point);
		}

		return { days, points, totals, previousTotals };
	}

	// ─── Organization monitoring ─────────────────────────────────────────────

	async listOrganizations(query: AdminOrgQuery) {
		const conditions: SQL[] = [];

		if (query.verificationStatus) {
			conditions.push(
				eq(organizations.verificationStatus, query.verificationStatus),
			);
		}
		if (query.status) conditions.push(eq(organizations.status, query.status));
		if (query.city) {
			conditions.push(ilike(organizations.city, `%${query.city}%`));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(organizations.organizationName, term),
				ilike(organizations.email, term),
				ilike(organizations.registrationNumber, term),
			);
			if (match) conditions.push(match);
		}

		const where = conditions.length ? and(...conditions) : undefined;
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: organizations.id,
					organizationName: organizations.organizationName,
					orgType: organizations.orgType,
					email: organizations.email,
					phone: organizations.phone,
					city: organizations.city,
					state: organizations.state,
					logo: organizations.logo,
					verificationStatus: organizations.verificationStatus,
					status: organizations.status,
					createdAt: organizations.createdAt,
					owner: {
						id: users.id,
						fullName: users.fullName,
						email: users.email,
					},
					// Table-qualified literals: inside a select-field template an
					// unqualified "id" binds to the subquery's own table, so these
					// silently counted zero.
					pendingDocuments: sql<number>`(
						select count(*)::int from organization_documents od
						where od.organization_id = organizations.id
						  and od.verification_status = 'PENDING'
					)`,
					eventCount: sql<number>`(
						select count(*)::int from events e
						where e.organization_id = organizations.id
					)`,
					needCount: sql<number>`(
						select count(*)::int from needs n
						where n.organization_id = organizations.id
					)`,
				})
				.from(organizations)
				.innerJoin(users, eq(organizations.ownerUserId, users.id))
				.where(where)
				.orderBy(
					...orderFor(
						query.sort,
						query.dir,
						{
							createdAt: organizations.createdAt,
							name: organizations.organizationName,
							city: organizations.city,
							verificationStatus: organizations.verificationStatus,
							pendingDocuments: sql`(
								select count(*)::int from organization_documents od
								where od.organization_id = organizations.id
								  and od.verification_status = 'PENDING'
							)`,
							events: sql`(
								select count(*)::int from events e
								where e.organization_id = organizations.id
							)`,
						},
						organizations.createdAt,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(organizations).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/** Everything the reviewer needs on one screen to make a decision. */
	async getOrganizationDetail(organizationId: string) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			with: {
				owner: {
					columns: {
						id: true,
						fullName: true,
						email: true,
						phone: true,
						verificationStatus: true,
						status: true,
						createdAt: true,
					},
				},
				organizationCategories: { with: { category: true } },
			},
		});

		if (!organization) {
			throw new NotFoundException("Organization not found");
		}

		const [documents, [eventTotals], [needTotals], recentEvents] =
			await Promise.all([
				this.db.query.organizationDocuments.findMany({
					where: eq(organizationDocuments.organizationId, organizationId),
					orderBy: desc(organizationDocuments.uploadedAt),
				}),
				this.db
					.select({
						total: sql<number>`count(*)::int`,
						published: sql<number>`count(*) filter (where ${events.status} = 'PUBLISHED')::int`,
					})
					.from(events)
					.where(eq(events.organizationId, organizationId)),
				this.db
					.select({
						total: sql<number>`count(*)::int`,
						open: sql<number>`count(*) filter (where ${needs.status} = 'OPEN')::int`,
					})
					.from(needs)
					.where(eq(needs.organizationId, organizationId)),
				this.db.query.events.findMany({
					where: eq(events.organizationId, organizationId),
					orderBy: desc(events.createdAt),
					limit: 5,
					columns: {
						id: true,
						title: true,
						status: true,
						startAt: true,
						volunteersNeeded: true,
						acceptedCount: true,
					},
				}),
			]);

		const { organizationCategories: orgCategories, ...rest } = organization;

		return {
			...rest,
			categories: orgCategories.map((oc) => oc.category),
			documents,
			stats: {
				events: eventTotals,
				needs: needTotals,
			},
			recentEvents,
		};
	}

	async reviewOrganization(
		adminId: string,
		organizationId: string,
		input: ReviewOrganizationInput,
	) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: { id: true, verificationStatus: true, organizationName: true },
		});

		if (!organization) {
			throw new NotFoundException("Organization not found");
		}

		const [updated] = await this.db
			.update(organizations)
			.set({
				verificationStatus: input.verificationStatus,
				rejectionReason:
					input.verificationStatus === "REJECTED"
						? (input.reason ?? null)
						: null,
				reviewedBy: adminId,
				reviewedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(organizations.id, organizationId))
			.returning();

		void this.audit.record({
			performedBy: adminId,
			action: `ORG_VERIFICATION_${input.verificationStatus}`,
			entityName: "ORGANIZATION",
			entityId: organizationId,
			oldValue: { verificationStatus: organization.verificationStatus },
			newValue: {
				verificationStatus: input.verificationStatus,
				reason: input.reason,
			},
		});

		return updated;
	}

	async setOrganizationStatus(
		adminId: string,
		organizationId: string,
		input: SetOrgStatusInput,
	) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: { id: true, status: true },
		});

		if (!organization) {
			throw new NotFoundException("Organization not found");
		}

		const updated = await this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(organizations)
				.set({ status: input.status, updatedAt: new Date() })
				.where(eq(organizations.id, organizationId))
				.returning();

			// Suspending an NGO must also pull its content off the public feed,
			// otherwise volunteers keep applying to a suspended organization.
			if (input.status === "SUSPENDED") {
				await tx
					.update(events)
					.set({ status: "CANCELLED", updatedAt: new Date() })
					.where(
						and(
							eq(events.organizationId, organizationId),
							eq(events.status, "PUBLISHED"),
						),
					);

				await tx
					.update(needs)
					.set({ status: "CLOSED", updatedAt: new Date() })
					.where(
						and(
							eq(needs.organizationId, organizationId),
							eq(needs.status, "OPEN"),
						),
					);
			}

			return row;
		});

		void this.audit.record({
			performedBy: adminId,
			action: `ORG_STATUS_${input.status}`,
			entityName: "ORGANIZATION",
			entityId: organizationId,
			oldValue: { status: organization.status },
			newValue: { status: input.status, reason: input.reason },
		});

		return updated;
	}

	// ─── User monitoring ─────────────────────────────────────────────────────

	async listUsers(query: AdminUserQuery) {
		const conditions: SQL[] = [];

		if (query.status) conditions.push(eq(users.status, query.status));
		if (query.verificationStatus) {
			conditions.push(eq(users.verificationStatus, query.verificationStatus));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(users.fullName, term),
				ilike(users.email, term),
				ilike(users.phone, term),
			);
			if (match) conditions.push(match);
		}
		if (query.role) {
			// Role lives in a join table; an EXISTS keeps the row count correct
			// where an inner join would multiply users holding several roles.
			conditions.push(
				sql`exists (
					select 1 from ${userRoles}
					join ${roles} on ${roles.id} = ${userRoles.roleId}
					where ${userRoles.userId} = ${users.id} and ${roles.name} = ${query.role}
				)`,
			);
		}

		const where = conditions.length ? and(...conditions) : undefined;
		const { limit, offset } = toOffset(query);

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: users.id,
					fullName: users.fullName,
					email: users.email,
					phone: users.phone,
					profileImage: users.profileImage,
					city: users.city,
					state: users.state,
					verificationStatus: users.verificationStatus,
					status: users.status,
					onboardedAt: users.onboardedAt,
					createdAt: users.createdAt,
					// Aliased and table-qualified. Interpolating the columns here
					// rendered them unqualified, making "id" ambiguous between
					// user_roles and roles - which made this endpoint throw 500.
					roles: sql<string[]>`coalesce((
						select array_agg(r.name)
						from user_roles ur
						join roles r on r.id = ur.role_id
						where ur.user_id = users.id
					), '{}')`,
					applicationCount: sql<number>`(
						select count(*)::int from event_applications ea
						where ea.volunteer_id = users.id
					)`,
					acceptedCount: sql<number>`(
						select count(*)::int from event_applications ea
						where ea.volunteer_id = users.id and ea.status = 'ACCEPTED'
					)`,
					pledgeCount: sql<number>`(
						select count(*)::int from need_pledges np
						where np.user_id = users.id
					)`,
				})
				.from(users)
				.where(where)
				.orderBy(
					...orderFor(
						query.sort,
						query.dir,
						{
							createdAt: users.createdAt,
							name: users.fullName,
							email: users.email,
							verificationStatus: users.verificationStatus,
							applications: sql`(
								select count(*)::int from event_applications ea
								where ea.volunteer_id = users.id
							)`,
							pledges: sql`(
								select count(*)::int from need_pledges np
								where np.user_id = users.id
							)`,
						},
						users.createdAt,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(users).where(where),
		]);

		return paginate(rows, totals?.value ?? 0, query);
	}

	/** Per-volunteer participation trail - which events, which outcome. */
	async getUserDetail(userId: string) {
		const user = await this.db.query.users.findFirst({
			where: eq(users.id, userId),
			with: { userRoles: { with: { role: true } } },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const [documents, applications, pledges, ownedOrganization] =
			await Promise.all([
				this.db.query.userDocuments.findMany({
					where: eq(userDocuments.userId, userId),
					orderBy: desc(userDocuments.uploadedAt),
				}),
				this.db
					.select({
						id: eventApplications.id,
						status: eventApplications.status,
						appliedAt: eventApplications.appliedAt,
						reviewedAt: eventApplications.reviewedAt,
						event: {
							id: events.id,
							title: events.title,
							startAt: events.startAt,
							city: events.city,
							status: events.status,
						},
						organization: {
							id: organizations.id,
							organizationName: organizations.organizationName,
						},
					})
					.from(eventApplications)
					.innerJoin(events, eq(eventApplications.eventId, events.id))
					.innerJoin(organizations, eq(events.organizationId, organizations.id))
					.where(eq(eventApplications.volunteerId, userId))
					.orderBy(desc(eventApplications.appliedAt))
					.limit(50),
				this.db
					.select({
						id: needPledges.id,
						status: needPledges.status,
						quantity: needPledges.quantity,
						createdAt: needPledges.createdAt,
						need: {
							id: needs.id,
							title: needs.title,
							type: needs.type,
							unit: needs.unit,
						},
						organization: {
							id: organizations.id,
							organizationName: organizations.organizationName,
						},
					})
					.from(needPledges)
					.innerJoin(needs, eq(needPledges.needId, needs.id))
					.innerJoin(organizations, eq(needs.organizationId, organizations.id))
					.where(eq(needPledges.userId, userId))
					.orderBy(desc(needPledges.createdAt))
					.limit(50),
				this.db.query.organizations.findFirst({
					where: eq(organizations.ownerUserId, userId),
					columns: {
						id: true,
						organizationName: true,
						verificationStatus: true,
						status: true,
					},
				}),
			]);

		const { userRoles: assigned, ...rest } = user;

		return {
			...rest,
			roles: assigned.map((ur) => ur.role.name),
			documents,
			applications,
			pledges,
			organization: ownedOrganization ?? null,
			stats: {
				applications: applications.length,
				accepted: applications.filter((a) => a.status === "ACCEPTED").length,
				pledges: pledges.length,
			},
		};
	}

	async setUserStatus(
		adminId: string,
		userId: string,
		input: SetUserStatusInput,
	) {
		if (adminId === userId) {
			throw new BadRequestException(
				"You cannot change your own account status.",
			);
		}

		const user = await this.db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, status: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const [updated] = await this.db
			.update(users)
			.set({
				status: input.status,
				suspendedReason:
					input.status === "ACTIVE" ? null : (input.reason ?? null),
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))
			.returning({
				id: users.id,
				email: users.email,
				status: users.status,
				suspendedReason: users.suspendedReason,
			});

		void this.audit.record({
			performedBy: adminId,
			action: `USER_STATUS_${input.status}`,
			entityName: "USER",
			entityId: userId,
			oldValue: { status: user.status },
			newValue: { status: input.status, reason: input.reason },
		});

		return updated;
	}

	// ─── Document verification ───────────────────────────────────────────────

	async listOrganizationDocuments(query: DocumentQueueQuery) {
		const where = query.status
			? eq(organizationDocuments.verificationStatus, query.status)
			: undefined;
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: organizationDocuments.id,
					documentType: organizationDocuments.documentType,
					documentKey: organizationDocuments.documentKey,
					verificationStatus: organizationDocuments.verificationStatus,
					remarks: organizationDocuments.remarks,
					uploadedAt: organizationDocuments.uploadedAt,
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						verificationStatus: organizations.verificationStatus,
					},
				})
				.from(organizationDocuments)
				.innerJoin(
					organizations,
					eq(organizationDocuments.organizationId, organizations.id),
				)
				.where(where)
				.orderBy(
					...orderFor(
						query.sort,
						query.dir,
						{
							uploadedAt: organizationDocuments.uploadedAt,
							documentType: organizationDocuments.documentType,
							owner: organizations.organizationName,
						},
						organizationDocuments.uploadedAt,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(organizationDocuments)
				.where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async reviewOrganizationDocument(
		adminId: string,
		documentId: string,
		input: ReviewDocumentInput,
	) {
		const document = await this.db.query.organizationDocuments.findFirst({
			where: eq(organizationDocuments.id, documentId),
		});

		if (!document) {
			throw new NotFoundException("Document not found");
		}

		const [updated] = await this.db
			.update(organizationDocuments)
			.set({
				verificationStatus: input.verificationStatus,
				remarks: input.remarks ?? null,
				verifiedBy: adminId,
				verifiedAt: new Date(),
			})
			.where(eq(organizationDocuments.id, documentId))
			.returning();

		void this.audit.record({
			performedBy: adminId,
			action: `ORG_DOCUMENT_${input.verificationStatus}`,
			entityName: "ORGANIZATION_DOCUMENT",
			entityId: documentId,
			oldValue: { verificationStatus: document.verificationStatus },
			newValue: input,
		});

		return updated;
	}

	async listUserDocuments(query: DocumentQueueQuery) {
		const where = query.status
			? eq(userDocuments.verificationStatus, query.status)
			: undefined;
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: userDocuments.id,
					documentType: userDocuments.documentType,
					documentKey: userDocuments.documentKey,
					verificationStatus: userDocuments.verificationStatus,
					remarks: userDocuments.remarks,
					metadata: userDocuments.metadata,
					uploadedAt: userDocuments.uploadedAt,
					user: {
						id: users.id,
						fullName: users.fullName,
						email: users.email,
						verificationStatus: users.verificationStatus,
					},
				})
				.from(userDocuments)
				.innerJoin(users, eq(userDocuments.userId, users.id))
				.where(where)
				.orderBy(
					...orderFor(
						query.sort,
						query.dir,
						{
							uploadedAt: userDocuments.uploadedAt,
							documentType: userDocuments.documentType,
							owner: users.fullName,
						},
						userDocuments.uploadedAt,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(userDocuments).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Reviews one identity document and re-derives the volunteer's own
	 * verification status from their whole document set. A volunteer is only
	 * VERIFIED once a government ID *and* a liveness selfie have both been
	 * approved - approving a single document must never promote the account on
	 * its own, or a selfie-less ID (or an ID-less selfie) would count as
	 * verified. The account status gates trust badges elsewhere in the app.
	 */
	async reviewUserDocument(
		adminId: string,
		documentId: string,
		input: ReviewDocumentInput,
	) {
		const document = await this.db.query.userDocuments.findFirst({
			where: eq(userDocuments.id, documentId),
		});

		if (!document) {
			throw new NotFoundException("Document not found");
		}

		const updated = await this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(userDocuments)
				.set({
					verificationStatus: input.verificationStatus,
					remarks: input.remarks ?? null,
					verifiedBy: adminId,
					verifiedAt: new Date(),
				})
				.where(eq(userDocuments.id, documentId))
				.returning();

			const docs = await tx
				.select({
					documentType: userDocuments.documentType,
					verificationStatus: userDocuments.verificationStatus,
				})
				.from(userDocuments)
				.where(eq(userDocuments.userId, document.userId));

			await tx
				.update(users)
				.set({
					verificationStatus: computeUserVerificationStatus(docs),
					updatedAt: new Date(),
				})
				.where(eq(users.id, document.userId));

			return row;
		});

		void this.audit.record({
			performedBy: adminId,
			action: `USER_DOCUMENT_${input.verificationStatus}`,
			entityName: "USER_DOCUMENT",
			entityId: documentId,
			oldValue: { verificationStatus: document.verificationStatus },
			newValue: input,
		});

		return updated;
	}

	/**
	 * Reviews many documents in one request.
	 *
	 * Sequential rather than one big `UPDATE ... WHERE id IN (...)`, and that is
	 * deliberate on both counts. Each decision has to be audited on its own -
	 * an audit log that records "38 documents approved" cannot answer "who
	 * approved *this* certificate", which is the only question anyone ever asks
	 * of it. And an identity document additionally re-derives its owner's
	 * account status from that owner's whole document set inside a transaction,
	 * which is per-user work a set update cannot express.
	 *
	 * One id failing does not fail the batch: the reviewer selected rows from a
	 * list that may be seconds stale, so "already reviewed" and "deleted
	 * underneath you" are normal, and rolling back thirty-nine good decisions
	 * because of one is the wrong trade. The result names both sides so the
	 * client can say which rows are still waiting.
	 */
	async bulkReviewDocuments(
		adminId: string,
		kind: "organization" | "user",
		input: BulkReviewDocumentsInput,
	): Promise<BulkReviewResult> {
		const review =
			kind === "organization"
				? (id: string) =>
						this.reviewOrganizationDocument(adminId, id, {
							verificationStatus: input.verificationStatus,
							...(input.remarks ? { remarks: input.remarks } : {}),
						})
				: (id: string) =>
						this.reviewUserDocument(adminId, id, {
							verificationStatus: input.verificationStatus,
							...(input.remarks ? { remarks: input.remarks } : {}),
						});

		const reviewed: string[] = [];
		const failed: BulkReviewResult["failed"] = [];

		// Deduplicated: a selection built from several loaded pages can repeat an
		// id, and reviewing one twice writes two audit rows for one decision.
		for (const id of [...new Set(input.ids)]) {
			try {
				await review(id);
				reviewed.push(id);
			} catch (error) {
				failed.push({
					id,
					reason:
						error instanceof Error ? error.message : "Could not be reviewed",
				});
			}
		}

		return { reviewed, failed };
	}

	// ─── Activity timelines ──────────────────────────────────────────────────

	async listOrganizationActivity(
		organizationId: string,
		query: AdminActivityQuery,
	) {
		const organization = await this.db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: { id: true, organizationName: true },
		});
		if (!organization) throw new NotFoundException("Organization not found");

		const { limit, offset } = toOffset(query);
		const fetchLimit = offset + limit;
		const wants = (kind: AdminActivityItem["kind"]) =>
			!query.kind || query.kind === kind;
		const empty = <T>() => Promise.resolve([] as T[]);
		const zero = Promise.resolve([{ value: 0 }]);

		const [
			eventRows,
			needRows,
			announcementRows,
			reportRows,
			documentRows,
			applicationRows,
			pledgeRows,
			donationRows,
			reviewRows,
			postRows,
			eventTotal,
			needTotal,
			announcementTotal,
			reportTotal,
			documentTotal,
			applicationTotal,
			pledgeTotal,
			donationTotal,
			reviewTotal,
			postTotal,
		] = await Promise.all([
			wants("EVENT")
				? this.db.query.events.findMany({
						where: eq(events.organizationId, organizationId),
						orderBy: desc(events.createdAt),
						limit: fetchLimit,
						columns: {
							id: true,
							title: true,
							status: true,
							startAt: true,
							createdAt: true,
							volunteersNeeded: true,
							acceptedCount: true,
						},
					})
				: empty(),
			wants("NEED")
				? this.db.query.needs.findMany({
						where: eq(needs.organizationId, organizationId),
						orderBy: desc(needs.createdAt),
						limit: fetchLimit,
						columns: {
							id: true,
							title: true,
							type: true,
							status: true,
							quantity: true,
							unit: true,
							createdAt: true,
						},
					})
				: empty(),
			wants("ANNOUNCEMENT")
				? this.db.query.announcements.findMany({
						where: eq(announcements.organizationId, organizationId),
						orderBy: desc(announcements.createdAt),
						limit: fetchLimit,
						columns: {
							id: true,
							title: true,
							status: true,
							isPinned: true,
							createdAt: true,
						},
					})
				: empty(),
			wants("REPORT")
				? this.db.query.financialReports.findMany({
						where: eq(financialReports.organizationId, organizationId),
						orderBy: desc(financialReports.createdAt),
						limit: fetchLimit,
						columns: {
							id: true,
							title: true,
							type: true,
							financialYear: true,
							createdAt: true,
						},
					})
				: empty(),
			wants("DOCUMENT")
				? this.db.query.organizationDocuments.findMany({
						where: eq(organizationDocuments.organizationId, organizationId),
						orderBy: desc(organizationDocuments.uploadedAt),
						limit: fetchLimit,
						columns: {
							id: true,
							documentType: true,
							verificationStatus: true,
							uploadedAt: true,
						},
					})
				: empty(),
			wants("APPLICATION")
				? this.db
						.select({
							id: eventApplications.id,
							status: eventApplications.status,
							appliedAt: eventApplications.appliedAt,
							event: { id: events.id, title: events.title },
							actor: {
								id: users.id,
								name: users.fullName,
								email: users.email,
							},
						})
						.from(eventApplications)
						.innerJoin(events, eq(eventApplications.eventId, events.id))
						.innerJoin(users, eq(eventApplications.volunteerId, users.id))
						.where(eq(events.organizationId, organizationId))
						.orderBy(desc(eventApplications.appliedAt))
						.limit(fetchLimit)
				: empty(),
			wants("PLEDGE")
				? this.db
						.select({
							id: needPledges.id,
							status: needPledges.status,
							quantity: needPledges.quantity,
							createdAt: needPledges.createdAt,
							need: { id: needs.id, title: needs.title, unit: needs.unit },
							actor: {
								id: users.id,
								name: users.fullName,
								email: users.email,
							},
						})
						.from(needPledges)
						.innerJoin(needs, eq(needPledges.needId, needs.id))
						.innerJoin(users, eq(needPledges.userId, users.id))
						.where(eq(needs.organizationId, organizationId))
						.orderBy(desc(needPledges.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("DONATION")
				? this.db
						.select({
							id: donations.id,
							status: donations.status,
							amountMinor: donations.amountMinor,
							currency: donations.currency,
							createdAt: donations.createdAt,
							completedAt: donations.completedAt,
							actor: {
								id: users.id,
								name: users.fullName,
								email: users.email,
							},
							donorName: donations.donorName,
							donorEmail: donations.donorEmail,
						})
						.from(donations)
						.leftJoin(users, eq(donations.donorUserId, users.id))
						.where(eq(donations.organizationId, organizationId))
						.orderBy(desc(donations.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("REVIEW")
				? this.db
						.select({
							id: reviews.id,
							rating: reviews.rating,
							body: reviews.body,
							createdAt: reviews.createdAt,
							actor: {
								id: users.id,
								name: users.fullName,
								email: users.email,
							},
						})
						.from(reviews)
						.innerJoin(users, eq(reviews.userId, users.id))
						.where(eq(reviews.organizationId, organizationId))
						.orderBy(desc(reviews.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("POST")
				? this.db.query.posts.findMany({
						where: eq(posts.organizationId, organizationId),
						orderBy: desc(posts.createdAt),
						limit: fetchLimit,
						columns: { id: true, tag: true, text: true, createdAt: true },
					})
				: empty(),
			wants("EVENT")
				? this.db
						.select({ value: count() })
						.from(events)
						.where(eq(events.organizationId, organizationId))
				: zero,
			wants("NEED")
				? this.db
						.select({ value: count() })
						.from(needs)
						.where(eq(needs.organizationId, organizationId))
				: zero,
			wants("ANNOUNCEMENT")
				? this.db
						.select({ value: count() })
						.from(announcements)
						.where(eq(announcements.organizationId, organizationId))
				: zero,
			wants("REPORT")
				? this.db
						.select({ value: count() })
						.from(financialReports)
						.where(eq(financialReports.organizationId, organizationId))
				: zero,
			wants("DOCUMENT")
				? this.db
						.select({ value: count() })
						.from(organizationDocuments)
						.where(eq(organizationDocuments.organizationId, organizationId))
				: zero,
			wants("APPLICATION")
				? this.db
						.select({ value: count() })
						.from(eventApplications)
						.innerJoin(events, eq(eventApplications.eventId, events.id))
						.where(eq(events.organizationId, organizationId))
				: zero,
			wants("PLEDGE")
				? this.db
						.select({ value: count() })
						.from(needPledges)
						.innerJoin(needs, eq(needPledges.needId, needs.id))
						.where(eq(needs.organizationId, organizationId))
				: zero,
			wants("DONATION")
				? this.db
						.select({ value: count() })
						.from(donations)
						.where(eq(donations.organizationId, organizationId))
				: zero,
			wants("REVIEW")
				? this.db
						.select({ value: count() })
						.from(reviews)
						.where(eq(reviews.organizationId, organizationId))
				: zero,
			wants("POST")
				? this.db
						.select({ value: count() })
						.from(posts)
						.where(eq(posts.organizationId, organizationId))
				: zero,
		]);

		const orgRef = {
			id: organization.id,
			organizationName: organization.organizationName,
		};
		const eRows = eventRows as Array<any>;
		const nRows = needRows as Array<any>;
		const aRows = announcementRows as Array<any>;
		const rRows = reportRows as Array<any>;
		const dRows = documentRows as Array<any>;
		const appRows = applicationRows as Array<any>;
		const pRows = pledgeRows as Array<any>;
		const donationActivityRows = donationRows as Array<any>;
		const reviewActivityRows = reviewRows as Array<any>;
		const postActivityRows = postRows as Array<any>;
		const items = [
			...eRows.map((event) =>
				activityItem({
					id: event.id,
					kind: "EVENT",
					occurredAt: event.createdAt.toISOString(),
					title: event.title,
					description: `${event.acceptedCount}/${event.volunteersNeeded} volunteers accepted`,
					status: event.status,
					organization: orgRef,
					subject: { id: event.id, label: event.title, status: event.status },
				}),
			),
			...nRows.map((need) =>
				activityItem({
					id: need.id,
					kind: "NEED",
					occurredAt: need.createdAt.toISOString(),
					title: need.title,
					description: need.quantity
						? `${need.quantity}${need.unit ? ` ${need.unit}` : ""}`
						: null,
					status: need.status,
					organization: orgRef,
					subject: {
						id: need.id,
						label: need.title,
						type: need.type,
						status: need.status,
					},
				}),
			),
			...aRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "ANNOUNCEMENT",
					occurredAt: row.createdAt.toISOString(),
					title: row.title,
					description: row.isPinned ? "Pinned announcement" : null,
					status: row.status,
					organization: orgRef,
					subject: { id: row.id, label: row.title, status: row.status },
				}),
			),
			...rRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "REPORT",
					occurredAt: row.createdAt.toISOString(),
					title: row.title,
					description: `FY ${row.financialYear}`,
					status: null,
					organization: orgRef,
					subject: { id: row.id, label: row.title, type: row.type },
				}),
			),
			...dRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "DOCUMENT",
					occurredAt: row.uploadedAt.toISOString(),
					title: row.documentType,
					description: "Organization document uploaded",
					status: row.verificationStatus,
					organization: orgRef,
					subject: {
						id: row.id,
						label: row.documentType,
						status: row.verificationStatus,
					},
				}),
			),
			...appRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "APPLICATION",
					occurredAt: row.appliedAt.toISOString(),
					title: `${row.actor.name ?? row.actor.email} applied`,
					description: row.event.title,
					status: row.status,
					actor: row.actor,
					organization: orgRef,
					subject: {
						id: row.event.id,
						label: row.event.title,
						status: row.status,
					},
				}),
			),
			...pRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "PLEDGE",
					occurredAt: row.createdAt.toISOString(),
					title: `${row.actor.name ?? row.actor.email} pledged`,
					description: row.quantity
						? `${row.quantity}${row.need.unit ? ` ${row.need.unit}` : ""} · ${row.need.title}`
						: row.need.title,
					status: row.status,
					actor: row.actor,
					organization: orgRef,
					subject: {
						id: row.need.id,
						label: row.need.title,
						status: row.status,
					},
				}),
			),
			...donationActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "DONATION",
					occurredAt: (row.completedAt ?? row.createdAt).toISOString(),
					title:
						row.actor?.name ??
						row.actor?.email ??
						row.donorName ??
						row.donorEmail ??
						"Guest donation",
					description: "Donation",
					status: row.status,
					amountMinor: row.amountMinor,
					currency: row.currency,
					actor: row.actor?.id ? row.actor : null,
					organization: orgRef,
					subject: { id: row.id, label: "Donation", status: row.status },
				}),
			),
			...reviewActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "REVIEW",
					occurredAt: row.createdAt.toISOString(),
					title: `${row.actor.name ?? row.actor.email} reviewed`,
					description: row.body ?? `${row.rating}/5 stars`,
					status: null,
					actor: row.actor,
					organization: orgRef,
					subject: { id: row.id, label: `${row.rating}/5 stars` },
				}),
			),
			...postActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "POST",
					occurredAt: row.createdAt.toISOString(),
					title: row.tag,
					description: row.text,
					status: null,
					organization: orgRef,
					subject: { id: row.id, label: row.tag, type: row.tag },
				}),
			),
		].sort(
			(a, b) =>
				new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
		);

		const total = sumValues([
			...(eventTotal as Array<{ value: number }>),
			...(needTotal as Array<{ value: number }>),
			...(announcementTotal as Array<{ value: number }>),
			...(reportTotal as Array<{ value: number }>),
			...(documentTotal as Array<{ value: number }>),
			...(applicationTotal as Array<{ value: number }>),
			...(pledgeTotal as Array<{ value: number }>),
			...(donationTotal as Array<{ value: number }>),
			...(reviewTotal as Array<{ value: number }>),
			...(postTotal as Array<{ value: number }>),
		]);

		return paginate(items.slice(offset, offset + limit), total, query);
	}

	async listUserActivity(userId: string, query: AdminActivityQuery) {
		const user = await this.db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, fullName: true, email: true },
		});
		if (!user) throw new NotFoundException("User not found");

		const { limit, offset } = toOffset(query);
		const fetchLimit = offset + limit;
		const wants = (kind: AdminActivityItem["kind"]) =>
			!query.kind || query.kind === kind;
		const empty = <T>() => Promise.resolve([] as T[]);
		const zero = Promise.resolve([{ value: 0 }]);
		const actor = { id: user.id, name: user.fullName, email: user.email };

		const [
			applicationRows,
			pledgeRows,
			donationRows,
			reviewRows,
			certificateRows,
			documentRows,
			postRows,
			applicationTotal,
			pledgeTotal,
			donationTotal,
			reviewTotal,
			certificateTotal,
			documentTotal,
			postTotal,
		] = await Promise.all([
			wants("APPLICATION")
				? this.db
						.select({
							id: eventApplications.id,
							status: eventApplications.status,
							appliedAt: eventApplications.appliedAt,
							event: { id: events.id, title: events.title },
							organization: {
								id: organizations.id,
								organizationName: organizations.organizationName,
							},
						})
						.from(eventApplications)
						.innerJoin(events, eq(eventApplications.eventId, events.id))
						.innerJoin(
							organizations,
							eq(events.organizationId, organizations.id),
						)
						.where(eq(eventApplications.volunteerId, userId))
						.orderBy(desc(eventApplications.appliedAt))
						.limit(fetchLimit)
				: empty(),
			wants("PLEDGE")
				? this.db
						.select({
							id: needPledges.id,
							status: needPledges.status,
							quantity: needPledges.quantity,
							createdAt: needPledges.createdAt,
							need: { id: needs.id, title: needs.title, unit: needs.unit },
							organization: {
								id: organizations.id,
								organizationName: organizations.organizationName,
							},
						})
						.from(needPledges)
						.innerJoin(needs, eq(needPledges.needId, needs.id))
						.innerJoin(
							organizations,
							eq(needs.organizationId, organizations.id),
						)
						.where(eq(needPledges.userId, userId))
						.orderBy(desc(needPledges.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("DONATION")
				? this.db
						.select({
							id: donations.id,
							status: donations.status,
							amountMinor: donations.amountMinor,
							currency: donations.currency,
							createdAt: donations.createdAt,
							completedAt: donations.completedAt,
							organization: {
								id: organizations.id,
								organizationName: organizations.organizationName,
							},
						})
						.from(donations)
						.innerJoin(
							organizations,
							eq(donations.organizationId, organizations.id),
						)
						.where(eq(donations.donorUserId, userId))
						.orderBy(desc(donations.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("REVIEW")
				? this.db
						.select({
							id: reviews.id,
							rating: reviews.rating,
							body: reviews.body,
							createdAt: reviews.createdAt,
							organization: {
								id: organizations.id,
								organizationName: organizations.organizationName,
							},
						})
						.from(reviews)
						.innerJoin(
							organizations,
							eq(reviews.organizationId, organizations.id),
						)
						.where(eq(reviews.userId, userId))
						.orderBy(desc(reviews.createdAt))
						.limit(fetchLimit)
				: empty(),
			wants("CERTIFICATE")
				? this.db
						.select({
							id: certificates.id,
							code: certificates.code,
							issuedAt: certificates.issuedAt,
							revokedAt: certificates.revokedAt,
							event: { id: events.id, title: events.title },
							organization: {
								id: organizations.id,
								organizationName: organizations.organizationName,
							},
						})
						.from(certificates)
						.innerJoin(events, eq(certificates.eventId, events.id))
						.innerJoin(
							organizations,
							eq(certificates.organizationId, organizations.id),
						)
						.where(eq(certificates.volunteerId, userId))
						.orderBy(desc(certificates.issuedAt))
						.limit(fetchLimit)
				: empty(),
			wants("DOCUMENT")
				? this.db.query.userDocuments.findMany({
						where: eq(userDocuments.userId, userId),
						orderBy: desc(userDocuments.uploadedAt),
						limit: fetchLimit,
						columns: {
							id: true,
							documentType: true,
							verificationStatus: true,
							uploadedAt: true,
						},
					})
				: empty(),
			wants("POST")
				? this.db.query.posts.findMany({
						where: eq(posts.authorUserId, userId),
						orderBy: desc(posts.createdAt),
						limit: fetchLimit,
						columns: { id: true, tag: true, text: true, createdAt: true },
					})
				: empty(),
			wants("APPLICATION")
				? this.db
						.select({ value: count() })
						.from(eventApplications)
						.where(eq(eventApplications.volunteerId, userId))
				: zero,
			wants("PLEDGE")
				? this.db
						.select({ value: count() })
						.from(needPledges)
						.where(eq(needPledges.userId, userId))
				: zero,
			wants("DONATION")
				? this.db
						.select({ value: count() })
						.from(donations)
						.where(eq(donations.donorUserId, userId))
				: zero,
			wants("REVIEW")
				? this.db
						.select({ value: count() })
						.from(reviews)
						.where(eq(reviews.userId, userId))
				: zero,
			wants("CERTIFICATE")
				? this.db
						.select({ value: count() })
						.from(certificates)
						.where(eq(certificates.volunteerId, userId))
				: zero,
			wants("DOCUMENT")
				? this.db
						.select({ value: count() })
						.from(userDocuments)
						.where(eq(userDocuments.userId, userId))
				: zero,
			wants("POST")
				? this.db
						.select({ value: count() })
						.from(posts)
						.where(eq(posts.authorUserId, userId))
				: zero,
		]);

		const appActivityRows = applicationRows as Array<any>;
		const pledgeActivityRows = pledgeRows as Array<any>;
		const donationActivityRows = donationRows as Array<any>;
		const reviewActivityRows = reviewRows as Array<any>;
		const certificateActivityRows = certificateRows as Array<any>;
		const documentActivityRows = documentRows as Array<any>;
		const postActivityRows = postRows as Array<any>;
		const items = [
			...appActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "APPLICATION",
					occurredAt: row.appliedAt.toISOString(),
					title: `Applied to ${row.event.title}`,
					description: row.organization.organizationName,
					status: row.status,
					actor,
					organization: row.organization,
					subject: {
						id: row.event.id,
						label: row.event.title,
						status: row.status,
					},
				}),
			),
			...pledgeActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "PLEDGE",
					occurredAt: row.createdAt.toISOString(),
					title: `Pledged to ${row.need.title}`,
					description: row.quantity
						? `${row.quantity}${row.need.unit ? ` ${row.need.unit}` : ""}`
						: row.organization.organizationName,
					status: row.status,
					actor,
					organization: row.organization,
					subject: {
						id: row.need.id,
						label: row.need.title,
						status: row.status,
					},
				}),
			),
			...donationActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "DONATION",
					occurredAt: (row.completedAt ?? row.createdAt).toISOString(),
					title: `Donated to ${row.organization.organizationName}`,
					description: "Donation",
					status: row.status,
					amountMinor: row.amountMinor,
					currency: row.currency,
					actor,
					organization: row.organization,
					subject: { id: row.id, label: "Donation", status: row.status },
				}),
			),
			...reviewActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "REVIEW",
					occurredAt: row.createdAt.toISOString(),
					title: `Reviewed ${row.organization.organizationName}`,
					description: row.body ?? `${row.rating}/5 stars`,
					status: null,
					actor,
					organization: row.organization,
					subject: { id: row.id, label: `${row.rating}/5 stars` },
				}),
			),
			...certificateActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "CERTIFICATE",
					occurredAt: row.issuedAt.toISOString(),
					title: `Certificate ${row.code}`,
					description: row.event.title,
					status: row.revokedAt ? "REVOKED" : "ISSUED",
					actor,
					organization: row.organization,
					subject: {
						id: row.event.id,
						label: row.event.title,
						status: row.revokedAt ? "REVOKED" : "ISSUED",
					},
				}),
			),
			...documentActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "DOCUMENT",
					occurredAt: row.uploadedAt.toISOString(),
					title: row.documentType,
					description: "Identity document uploaded",
					status: row.verificationStatus,
					actor,
					subject: {
						id: row.id,
						label: row.documentType,
						status: row.verificationStatus,
					},
				}),
			),
			...postActivityRows.map((row) =>
				activityItem({
					id: row.id,
					kind: "POST",
					occurredAt: row.createdAt.toISOString(),
					title: row.tag,
					description: row.text,
					status: null,
					actor,
					subject: { id: row.id, label: row.tag, type: row.tag },
				}),
			),
		].sort(
			(a, b) =>
				new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
		);

		const total = sumValues([
			...(applicationTotal as Array<{ value: number }>),
			...(pledgeTotal as Array<{ value: number }>),
			...(donationTotal as Array<{ value: number }>),
			...(reviewTotal as Array<{ value: number }>),
			...(certificateTotal as Array<{ value: number }>),
			...(documentTotal as Array<{ value: number }>),
			...(postTotal as Array<{ value: number }>),
		]);

		return paginate(items.slice(offset, offset + limit), total, query);
	}

	// ─── Analytics ───────────────────────────────────────────────────────────

	async getAnalytics(query: AdminAnalyticsQuery): Promise<AdminAnalytics> {
		const limit = query.limit;
		const start = startOfUtcDay(new Date());
		start.setUTCDate(start.getUTCDate() - (query.days - 1));

		const volunteerRoleFilter = sql`exists (
			select 1 from user_roles ur
			join roles r on r.id = ur.role_id
			where ur.user_id = users.id and r.name = 'volunteer'
		)`;

		const toPoints = (
			rows: Array<{ label: string | null; value: number | string }>,
		): AdminAnalyticsPoint[] =>
			rows.map((row) => ({
				label: row.label || "Unknown",
				value: Number(row.value),
			}));

		const [
			orgLocations,
			volunteerLocations,
			orgCategories,
			volunteerCategories,
			applicationFunnel,
			[pendingDocs],
			queueAges,
			topOrganizations,
			donationRows,
			[donationTotals],
		] = await Promise.all([
			this.db
				.select({
					label: sql<string>`coalesce(nullif(${organizations.city}, ''), nullif(${organizations.state}, ''), 'Unknown')`,
					value: sql<number>`count(*)::int`,
				})
				.from(organizations)
				.groupBy(sql`1`)
				.orderBy(desc(sql`count(*)`))
				.limit(limit),
			this.db
				.select({
					label: sql<string>`coalesce(nullif(${users.city}, ''), nullif(${users.state}, ''), 'Unknown')`,
					value: sql<number>`count(*)::int`,
				})
				.from(users)
				.where(volunteerRoleFilter)
				.groupBy(sql`1`)
				.orderBy(desc(sql`count(*)`))
				.limit(limit),
			this.db
				.select({
					label: categories.name,
					value: sql<number>`count(distinct ${organizationCategories.organizationId})::int`,
				})
				.from(organizationCategories)
				.innerJoin(
					categories,
					eq(organizationCategories.categoryId, categories.id),
				)
				.groupBy(categories.name)
				.orderBy(
					desc(sql`count(distinct ${organizationCategories.organizationId})`),
				)
				.limit(limit),
			this.db
				.select({
					label: categories.name,
					value: sql<number>`count(distinct ${userCategories.userId})::int`,
				})
				.from(userCategories)
				.innerJoin(categories, eq(userCategories.categoryId, categories.id))
				.groupBy(categories.name)
				.orderBy(desc(sql`count(distinct ${userCategories.userId})`))
				.limit(limit),
			this.db
				.select({
					label: eventApplications.status,
					value: sql<number>`count(*)::int`,
				})
				.from(eventApplications)
				.groupBy(eventApplications.status),
			this.db
				.select({
					organizationDocuments: sql<number>`count(*) filter (where ${organizationDocuments.verificationStatus} = 'PENDING')::int`,
					userDocuments: sql<number>`(select count(*)::int from user_documents where verification_status = 'PENDING')`,
				})
				.from(organizationDocuments),
			this.db
				.select({
					label: sql<string>`case
						when ${organizationDocuments.uploadedAt} >= now() - interval '1 day' then '<1 day'
						when ${organizationDocuments.uploadedAt} >= now() - interval '3 days' then '1-3 days'
						when ${organizationDocuments.uploadedAt} >= now() - interval '7 days' then '3-7 days'
						else '7+ days'
					end`,
					orgDocuments: sql<number>`count(*) filter (where ${organizationDocuments.verificationStatus} = 'PENDING')::int`,
					userDocuments: sql<number>`0::int`,
				})
				.from(organizationDocuments)
				.where(eq(organizationDocuments.verificationStatus, "PENDING"))
				.groupBy(sql`1`),
			this.db
				.select({
					id: organizations.id,
					organizationName: organizations.organizationName,
					city: organizations.city,
					state: organizations.state,
					events: sql<number>`(select count(*)::int from events e where e.organization_id = organizations.id)`,
					needs: sql<number>`(select count(*)::int from needs n where n.organization_id = organizations.id)`,
					applications: sql<number>`(select count(*)::int from event_applications ea join events e on e.id = ea.event_id where e.organization_id = organizations.id)`,
					donationAmountMinor: sql<number>`coalesce((select sum(d.amount_minor)::int from donations d where d.organization_id = organizations.id and d.status = 'COMPLETED'), 0)`,
				})
				.from(organizations)
				.orderBy(
					desc(sql`(
					(select count(*) from event_applications ea join events e on e.id = ea.event_id where e.organization_id = organizations.id) +
					(select count(*) from need_pledges np join needs n on n.id = np.need_id where n.organization_id = organizations.id) +
					(select count(*) from donations d where d.organization_id = organizations.id and d.status = 'COMPLETED')
				)`),
				)
				.limit(limit),
			this.db
				.select({
					day: sql<string>`to_char(${donations.completedAt}, 'YYYY-MM-DD')`,
					amountMinor: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::int`,
					count: sql<number>`count(*)::int`,
				})
				.from(donations)
				.where(
					and(
						eq(donations.status, "COMPLETED"),
						gte(donations.completedAt, start),
					) as SQL,
				)
				.groupBy(sql`1`),
			this.db
				.select({
					amountMinor: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::int`,
					count: sql<number>`count(*)::int`,
				})
				.from(donations)
				.where(
					and(
						eq(donations.status, "COMPLETED"),
						gte(donations.completedAt, start),
					) as SQL,
				),
		]);

		const userAgeRows = await this.db
			.select({
				label: sql<string>`case
					when ${userDocuments.uploadedAt} >= now() - interval '1 day' then '<1 day'
					when ${userDocuments.uploadedAt} >= now() - interval '3 days' then '1-3 days'
					when ${userDocuments.uploadedAt} >= now() - interval '7 days' then '3-7 days'
					else '7+ days'
				end`,
				orgDocuments: sql<number>`0::int`,
				userDocuments: sql<number>`count(*) filter (where ${userDocuments.verificationStatus} = 'PENDING')::int`,
			})
			.from(userDocuments)
			.where(eq(userDocuments.verificationStatus, "PENDING"))
			.groupBy(sql`1`);

		const ageLabels = ["<1 day", "1-3 days", "3-7 days", "7+ days"];
		const ageBuckets = ageLabels.map((label) => ({
			label,
			orgDocuments: Number(
				queueAges.find((row) => row.label === label)?.orgDocuments ?? 0,
			),
			userDocuments: Number(
				userAgeRows.find((row) => row.label === label)?.userDocuments ?? 0,
			),
		}));

		const donationIndex = indexSeries(donationRows);
		const points = [];
		for (let offset = 0; offset < query.days; offset += 1) {
			const day = new Date(start);
			day.setUTCDate(day.getUTCDate() + offset);
			const key = day.toISOString().slice(0, 10);
			const value = donationIndex.get(key);
			points.push({
				date: key,
				amountMinor: value?.amountMinor ?? 0,
				count: value?.count ?? 0,
			});
		}

		return {
			windowDays: query.days,
			locations: {
				organizations: toPoints(orgLocations),
				volunteers: toPoints(volunteerLocations),
			},
			categories: {
				organizations: toPoints(orgCategories),
				volunteers: toPoints(volunteerCategories),
			},
			applicationFunnel: toPoints(applicationFunnel),
			reviewQueues: {
				pending: {
					organizationDocuments: pendingDocs?.organizationDocuments ?? 0,
					userDocuments: pendingDocs?.userDocuments ?? 0,
				},
				ageBuckets,
			},
			topOrganizations: topOrganizations.map((row) => ({
				...row,
				events: Number(row.events),
				needs: Number(row.needs),
				applications: Number(row.applications),
				donationAmountMinor: Number(row.donationAmountMinor),
			})),
			donations: {
				totalAmountMinor: Number(donationTotals?.amountMinor ?? 0),
				completedCount: Number(donationTotals?.count ?? 0),
				points,
			},
		};
	}

	// ─── Audit trail ─────────────────────────────────────────────────────────

	async listAuditLogs(query: AuditLogQuery) {
		const conditions: SQL[] = [];
		if (query.action) {
			conditions.push(ilike(auditLogs.action, `%${query.action}%`));
		}
		if (query.entityName) {
			conditions.push(eq(auditLogs.entityName, query.entityName));
		}

		const where = conditions.length ? and(...conditions) : undefined;
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: auditLogs.id,
					action: auditLogs.action,
					entityName: auditLogs.entityName,
					entityId: auditLogs.entityId,
					oldValue: auditLogs.oldValue,
					newValue: auditLogs.newValue,
					createdAt: auditLogs.createdAt,
					actor: {
						id: users.id,
						fullName: users.fullName,
						email: users.email,
					},
				})
				.from(auditLogs)
				.leftJoin(users, eq(auditLogs.performedBy, users.id))
				.where(where)
				.orderBy(
					...orderFor(
						query.sort,
						query.dir,
						{
							createdAt: auditLogs.createdAt,
							action: auditLogs.action,
						},
						auditLogs.createdAt,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(auditLogs).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Promotes an existing account to superadmin. Deliberately not exposed over
	 * HTTP - call it from a script or the DB. Kept here so the role name and
	 * audit trail stay consistent with the rest of admin actions.
	 */
	async grantSuperadmin(email: string) {
		const user = await this.db.query.users.findFirst({
			where: eq(users.email, email.toLowerCase()),
		});

		if (!user) {
			throw new NotFoundException(`No user with email ${email}`);
		}

		const superadminRole = await this.db.query.roles.findFirst({
			where: eq(roles.name, "superadmin"),
		});

		if (!superadminRole) {
			throw new NotFoundException("superadmin role missing - run the seed");
		}

		const existing = await this.db.query.userRoles.findMany({
			where: and(
				eq(userRoles.userId, user.id),
				inArray(userRoles.roleId, [superadminRole.id]),
			),
		});

		if (existing.length === 0) {
			await this.db
				.insert(userRoles)
				.values({ userId: user.id, roleId: superadminRole.id });
		}

		return { id: user.id, email: user.email, role: "superadmin" };
	}
}
