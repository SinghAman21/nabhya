import type { db as dbType } from "@nabhya/db";
import { needPledges, needs, organizations } from "@nabhya/db/schema";
import type {
	CreateNeedInput,
	CreatePledgeInput,
	OrgNeedQuery,
	PaginationQuery,
	PublicNeedQuery,
	ReviewPledgeInput,
	UpdateNeedInput,
} from "@nabhya/shared";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	and,
	count,
	desc,
	eq,
	gt,
	ilike,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";

const publicNeedColumns = {
	id: needs.id,
	type: needs.type,
	title: needs.title,
	description: needs.description,
	quantity: needs.quantity,
	unit: needs.unit,
	fulfilledQuantity: needs.fulfilledQuantity,
	urgency: needs.urgency,
	status: needs.status,
	city: needs.city,
	state: needs.state,
	expiresAt: needs.expiresAt,
	createdAt: needs.createdAt,
	organization: {
		id: organizations.id,
		organizationName: organizations.organizationName,
		logo: organizations.logo,
		city: organizations.city,
		state: organizations.state,
	},
};

@Injectable()
export class NeedsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
	) {}

	// ─── Public feed ─────────────────────────────────────────────────────────

	async listPublic(query: PublicNeedQuery) {
		const conditions: SQL[] = [
			eq(needs.status, "OPEN"),
			eq(organizations.verificationStatus, "VERIFIED"),
			eq(organizations.status, "ACTIVE"),
		];

		// An expired post stays in the org's own list but drops off the feed.
		const notExpired = or(
			isNull(needs.expiresAt),
			gt(needs.expiresAt, new Date()),
		);
		if (notExpired) conditions.push(notExpired);

		if (query.type) conditions.push(eq(needs.type, query.type));
		if (query.urgency) {
			conditions.push(eq(needs.urgency, query.urgency));
		}
		if (query.city) {
			conditions.push(ilike(needs.city, `%${query.city}%`));
		}
		if (query.organizationId) {
			conditions.push(eq(needs.organizationId, query.organizationId));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(needs.title, term),
				ilike(needs.description, term),
				ilike(organizations.organizationName, term),
			);
			if (match) conditions.push(match);
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select(publicNeedColumns)
				.from(needs)
				.innerJoin(organizations, eq(needs.organizationId, organizations.id))
				.where(where)
				// Urgent posts first, then most recent.
				.orderBy(
					sql`case ${needs.urgency}
						when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end`,
					desc(needs.createdAt),
				)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(needs)
				.innerJoin(organizations, eq(needs.organizationId, organizations.id))
				.where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async getPublicById(needId: string, viewerId?: string) {
		const [need] = await this.db
			.select(publicNeedColumns)
			.from(needs)
			.innerJoin(organizations, eq(needs.organizationId, organizations.id))
			.where(
				and(
					eq(needs.id, needId),
					eq(organizations.verificationStatus, "VERIFIED"),
					eq(organizations.status, "ACTIVE"),
				),
			)
			.limit(1);

		if (!need) {
			throw new NotFoundException("Post not found");
		}

		const myPledge = viewerId
			? ((await this.db.query.needPledges.findFirst({
					where: and(
						eq(needPledges.needId, needId),
						eq(needPledges.userId, viewerId),
					),
					columns: {
						id: true,
						status: true,
						quantity: true,
						message: true,
						createdAt: true,
					},
				})) ?? null)
			: null;

		return { ...need, myPledge };
	}

	// ─── Organisation-scoped management ──────────────────────────────────────

	async listForMyOrganization(userId: string, query: OrgNeedQuery) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const conditions: SQL[] = [eq(needs.organizationId, organization.id)];
		if (query.type) conditions.push(eq(needs.type, query.type));
		if (query.status) {
			conditions.push(eq(needs.status, query.status));
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: needs.id,
					type: needs.type,
					title: needs.title,
					description: needs.description,
					quantity: needs.quantity,
					unit: needs.unit,
					fulfilledQuantity: needs.fulfilledQuantity,
					urgency: needs.urgency,
					status: needs.status,
					city: needs.city,
					expiresAt: needs.expiresAt,
					createdAt: needs.createdAt,
					// Table-qualified: see the note in EventsService — an unqualified
					// "id" binds to need_pledges.id and the count is always zero.
					pendingPledges: sql<number>`(
						select count(*)::int from need_pledges np
						where np.need_id = organization_needs.id and np.status = 'PENDING'
					)`,
				})
				.from(needs)
				.where(where)
				.orderBy(desc(needs.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(needs).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async create(userId: string, input: CreateNeedInput) {
		const organization =
			await this.organizationsService.requireVerifiedOrganization(userId);

		const inserted = await this.db
			.insert(needs)
			.values({
				organizationId: organization.id,
				type: input.type,
				title: input.title,
				description: input.description,
				quantity: input.quantity ?? null,
				unit: input.unit ?? null,
				urgency: input.urgency,
				city: input.city,
				state: input.state,
				expiresAt: input.expiresAt ?? null,
				status: "OPEN",
				createdBy: userId,
			})
			.returning();
		const need = takeFirstOrThrow(inserted, "create need");

		void this.audit.record({
			performedBy: userId,
			action: "CREATE_NEED",
			entityName: "ORGANIZATION_NEED",
			entityId: need.id,
			newValue: { type: need.type, title: need.title },
		});

		return need;
	}

	async update(userId: string, needId: string, input: UpdateNeedInput) {
		const need = await this.requireOwnedNeed(userId, needId);

		if (
			input.quantity !== undefined &&
			input.quantity < need.fulfilledQuantity
		) {
			throw new BadRequestException(
				`${need.fulfilledQuantity} ${need.unit ?? "items"} have already been committed.`,
			);
		}

		const [updated] = await this.db
			.update(needs)
			.set({
				...Object.fromEntries(
					Object.entries(input).filter(([, v]) => v !== undefined),
				),
				updatedAt: new Date(),
			})
			.where(eq(needs.id, needId))
			.returning();

		void this.audit.record({
			performedBy: userId,
			action: "UPDATE_NEED",
			entityName: "ORGANIZATION_NEED",
			entityId: needId,
			newValue: input,
		});

		return updated;
	}

	async remove(userId: string, needId: string) {
		const need = await this.requireOwnedNeed(userId, needId);

		// People have committed against this post — close it rather than erase
		// the record of what they pledged.
		const [committed] = await this.db
			.select({ value: count() })
			.from(needPledges)
			.where(
				and(
					eq(needPledges.needId, needId),
					or(
						eq(needPledges.status, "ACCEPTED"),
						eq(needPledges.status, "COMPLETED"),
					),
				),
			);

		if ((committed?.value ?? 0) > 0) {
			const [closed] = await this.db
				.update(needs)
				.set({ status: "CLOSED", updatedAt: new Date() })
				.where(eq(needs.id, needId))
				.returning();

			void this.audit.record({
				performedBy: userId,
				action: "CLOSE_NEED",
				entityName: "ORGANIZATION_NEED",
				entityId: needId,
			});

			return { deleted: false, need: closed };
		}

		await this.db.delete(needs).where(eq(needs.id, needId));

		void this.audit.record({
			performedBy: userId,
			action: "DELETE_NEED",
			entityName: "ORGANIZATION_NEED",
			entityId: needId,
			oldValue: { title: need.title },
		});

		return { deleted: true, need: null };
	}

	// ─── Pledges ─────────────────────────────────────────────────────────────

	async pledge(userId: string, needId: string, input: CreatePledgeInput) {
		const [need] = await this.db
			.select({
				id: needs.id,
				status: needs.status,
				expiresAt: needs.expiresAt,
				organizationId: needs.organizationId,
				quantity: needs.quantity,
				unit: needs.unit,
			})
			.from(needs)
			.innerJoin(organizations, eq(needs.organizationId, organizations.id))
			.where(
				and(
					eq(needs.id, needId),
					eq(organizations.verificationStatus, "VERIFIED"),
					eq(organizations.status, "ACTIVE"),
				),
			)
			.limit(1);

		if (!need) {
			throw new NotFoundException("Post not found");
		}
		if (need.status !== "OPEN") {
			throw new BadRequestException("This post is no longer accepting offers.");
		}
		if (need.expiresAt && need.expiresAt < new Date()) {
			throw new BadRequestException("This post has expired.");
		}

		// A quantified need tracks progress through `fulfilledQuantity`, which
		// advances by the pledged amount. A pledge without one would be accepted
		// but count for nothing, so the need could never reach FULFILLED.
		if (need.quantity !== null && !input.quantity) {
			throw new BadRequestException(
				`Tell us how many ${need.unit ?? "items"} you can provide.`,
			);
		}

		const existing = await this.db.query.needPledges.findFirst({
			where: and(
				eq(needPledges.needId, needId),
				eq(needPledges.userId, userId),
			),
		});

		if (existing && existing.status !== "CANCELLED") {
			throw new ConflictException("You have already responded to this post.");
		}

		if (existing) {
			const [reopened] = await this.db
				.update(needPledges)
				.set({
					status: "PENDING",
					quantity: input.quantity ?? null,
					message: input.message ?? null,
					reviewNote: null,
					reviewedBy: null,
					reviewedAt: null,
					updatedAt: new Date(),
				})
				.where(eq(needPledges.id, existing.id))
				.returning();
			return reopened;
		}

		const pledge = takeFirstOrThrow(
			await this.db
				.insert(needPledges)
				.values({
					needId,
					userId,
					quantity: input.quantity ?? null,
					message: input.message ?? null,
					status: "PENDING",
				})
				.returning(),
			"create need pledge",
		);

		void this.audit.record({
			performedBy: userId,
			action: "CREATE_PLEDGE",
			entityName: "NEED_PLEDGE",
			entityId: pledge.id,
			newValue: { needId, quantity: input.quantity },
		});

		return pledge;
	}

	async listMyPledges(userId: string, query: PaginationQuery) {
		const where = eq(needPledges.userId, userId);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: needPledges.id,
					status: needPledges.status,
					quantity: needPledges.quantity,
					message: needPledges.message,
					reviewNote: needPledges.reviewNote,
					createdAt: needPledges.createdAt,
					need: {
						id: needs.id,
						type: needs.type,
						title: needs.title,
						unit: needs.unit,
						status: needs.status,
					},
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
					},
				})
				.from(needPledges)
				.innerJoin(needs, eq(needPledges.needId, needs.id))
				.innerJoin(organizations, eq(needs.organizationId, organizations.id))
				.where(where)
				.orderBy(desc(needPledges.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(needPledges).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async listPledges(userId: string, needId: string, query: PaginationQuery) {
		await this.requireOwnedNeed(userId, needId);

		const where = eq(needPledges.needId, needId);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db.query.needPledges.findMany({
				where,
				limit,
				offset,
				orderBy: desc(needPledges.createdAt),
				with: {
					user: {
						columns: {
							id: true,
							fullName: true,
							email: true,
							phone: true,
							profileImage: true,
							city: true,
							verificationStatus: true,
						},
					},
				},
			}),
			this.db.select({ value: count() }).from(needPledges).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Accept, reject or complete a pledge.
	 *
	 * `fulfilledQuantity` moves only on transitions into and out of the
	 * committed states, and the need row is locked so concurrent reviews cannot
	 * double-count. The need auto-closes once the target is met.
	 */
	async reviewPledge(
		userId: string,
		needId: string,
		pledgeId: string,
		input: ReviewPledgeInput,
	) {
		await this.requireOwnedNeed(userId, needId);

		const result = await this.db.transaction(async (tx) => {
			const lockedNeed = takeFirstOrThrow(
				await tx
					.select({
						id: needs.id,
						quantity: needs.quantity,
						fulfilledQuantity: needs.fulfilledQuantity,
						status: needs.status,
					})
					.from(needs)
					.where(eq(needs.id, needId))
					.for("update"),
				"lock need for pledge review",
			);

			const pledge = await tx.query.needPledges.findFirst({
				where: and(
					eq(needPledges.id, pledgeId),
					eq(needPledges.needId, needId),
				),
			});

			if (!pledge) {
				throw new NotFoundException("Pledge not found");
			}
			if (pledge.status === "CANCELLED") {
				throw new BadRequestException("This pledge was cancelled.");
			}
			if (pledge.status === input.status) {
				return pledge;
			}

			const updatedRows = await tx
				.update(needPledges)
				.set({
					status: input.status,
					reviewNote: input.reviewNote ?? null,
					reviewedBy: userId,
					reviewedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(needPledges.id, pledgeId))
				.returning();

			const committed = (status: string) =>
				status === "ACCEPTED" || status === "COMPLETED";

			const wasCommitted = committed(pledge.status);
			const isCommitted = committed(input.status);
			const amount = pledge.quantity ?? 0;

			let fulfilled = lockedNeed.fulfilledQuantity;
			if (!wasCommitted && isCommitted) fulfilled += amount;
			if (wasCommitted && !isCommitted)
				fulfilled = Math.max(fulfilled - amount, 0);

			if (fulfilled !== lockedNeed.fulfilledQuantity) {
				const reachedTarget =
					lockedNeed.quantity !== null && fulfilled >= lockedNeed.quantity;

				// A manually CLOSED need stays closed — rejecting a pledge that drops
				// the count below target must not resurrect it to OPEN. Only auto-flip
				// between OPEN and FULFILLED.
				const nextStatus = reachedTarget
					? "FULFILLED"
					: lockedNeed.status === "CLOSED"
						? "CLOSED"
						: "OPEN";

				await tx
					.update(needs)
					.set({
						fulfilledQuantity: fulfilled,
						status: nextStatus,
						updatedAt: new Date(),
					})
					.where(eq(needs.id, needId));
			}

			return takeFirstOrThrow(updatedRows, "review need pledge");
		});

		void this.notifications.notify({
			userId: result.userId,
			type: input.status === "REJECTED" ? "PLEDGE_REJECTED" : "PLEDGE_ACCEPTED",
			title:
				input.status === "REJECTED"
					? "Your offer wasn't accepted"
					: input.status === "COMPLETED"
						? "Your donation was received"
						: "Your offer was accepted",
			body: input.reviewNote ?? undefined,
			entityName: "ORGANIZATION_NEED",
			entityId: needId,
		});

		void this.audit.record({
			performedBy: userId,
			action: `REVIEW_PLEDGE_${input.status}`,
			entityName: "NEED_PLEDGE",
			entityId: pledgeId,
			newValue: { status: input.status },
		});

		return result;
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private async requireOwnedNeed(userId: string, needId: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const need = await this.db.query.needs.findFirst({
			where: eq(needs.id, needId),
		});

		if (!need) {
			throw new NotFoundException("Post not found");
		}
		if (need.organizationId !== organization.id) {
			throw new ForbiddenException(
				"This post belongs to another organization.",
			);
		}

		return need;
	}
}
