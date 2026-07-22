import type { db as dbType } from "@nabhya/db";
import {
	auditLogs,
	eventApplications,
	events,
	needPledges,
	organizationDocuments,
	organizationNeeds,
	organizations,
	roles,
	userDocuments,
	userRoles,
	users,
} from "@nabhya/db/schema";
import {
	type AdminOrgQuery,
	type AdminOverview,
	type AdminUserQuery,
	type AuditLogQuery,
	computeUserVerificationStatus,
	type PaginationQuery,
	type ReviewDocumentInput,
	type ReviewOrganizationInput,
	type SetOrgStatusInput,
	type SetUserStatusInput,
} from "@nabhya/shared";
import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	and,
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
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, toOffset } from "../../common/utils";

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
				open: countWhere(eq(organizationNeeds.status, "OPEN")),
				wants: countWhere(eq(organizationNeeds.type, "WANT")),
				offers: countWhere(eq(organizationNeeds.type, "OFFER")),
			})
			.from(organizationNeeds);

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
						select count(*)::int from organization_needs n
						where n.organization_id = organizations.id
					)`,
				})
				.from(organizations)
				.innerJoin(users, eq(organizations.ownerUserId, users.id))
				.where(where)
				.orderBy(desc(organizations.createdAt))
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
						open: sql<number>`count(*) filter (where ${organizationNeeds.status} = 'OPEN')::int`,
					})
					.from(organizationNeeds)
					.where(eq(organizationNeeds.organizationId, organizationId)),
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
					.update(organizationNeeds)
					.set({ status: "CLOSED", updatedAt: new Date() })
					.where(
						and(
							eq(organizationNeeds.organizationId, organizationId),
							eq(organizationNeeds.status, "OPEN"),
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
					// user_roles and roles — which made this endpoint throw 500.
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
				.orderBy(desc(users.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(users).where(where),
		]);

		return paginate(rows, totals?.value ?? 0, query);
	}

	/** Per-volunteer participation trail — which events, which outcome. */
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
							id: organizationNeeds.id,
							title: organizationNeeds.title,
							type: organizationNeeds.type,
							unit: organizationNeeds.unit,
						},
						organization: {
							id: organizations.id,
							organizationName: organizations.organizationName,
						},
					})
					.from(needPledges)
					.innerJoin(
						organizationNeeds,
						eq(needPledges.needId, organizationNeeds.id),
					)
					.innerJoin(
						organizations,
						eq(organizationNeeds.organizationId, organizations.id),
					)
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

	async listOrganizationDocuments(
		query: PaginationQuery & { status?: "PENDING" | "VERIFIED" | "REJECTED" },
	) {
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
				.orderBy(desc(organizationDocuments.uploadedAt))
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

	async listUserDocuments(
		query: PaginationQuery & { status?: "PENDING" | "VERIFIED" | "REJECTED" },
	) {
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
				.orderBy(desc(userDocuments.uploadedAt))
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
	 * approved — approving a single document must never promote the account on
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
				.orderBy(desc(auditLogs.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(auditLogs).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Promotes an existing account to superadmin. Deliberately not exposed over
	 * HTTP — call it from a script or the DB. Kept here so the role name and
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
			throw new NotFoundException("superadmin role missing — run the seed");
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
