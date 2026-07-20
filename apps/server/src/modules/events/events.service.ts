import type { db as dbType } from "@nabhya/db";
import { eventApplications, events, organizations } from "@nabhya/db/schema";
import type {
	ApplicationQuery,
	ApplyToEventInput,
	CreateEventInput,
	OrgEventQuery,
	PublicEventQuery,
	ReviewApplicationInput,
	UpdateEventInput,
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
	asc,
	count,
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
import { paginate, takeFirstOrThrow, toOffset } from "../../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";

/** Columns exposed on the public feed — never the internal review fields. */
const publicEventColumns = {
	id: events.id,
	title: events.title,
	description: events.description,
	coverImage: events.coverImage,
	venue: events.venue,
	address: events.address,
	city: events.city,
	state: events.state,
	startAt: events.startAt,
	endAt: events.endAt,
	applicationDeadline: events.applicationDeadline,
	volunteersNeeded: events.volunteersNeeded,
	acceptedCount: events.acceptedCount,
	status: events.status,
	createdAt: events.createdAt,
	organization: {
		id: organizations.id,
		organizationName: organizations.organizationName,
		logo: organizations.logo,
		city: organizations.city,
		state: organizations.state,
		verificationStatus: organizations.verificationStatus,
	},
};

@Injectable()
export class EventsService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(AuditService) private readonly audit: AuditService,
		@Inject(OrganizationsService)
		private readonly organizationsService: OrganizationsService,
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
	) {}

	// ─── Public feed ─────────────────────────────────────────────────────────

	/**
	 * The volunteer-facing feed. Only PUBLISHED events belonging to verified,
	 * active organizations are ever visible — this is enforced with an inner
	 * join rather than a post-filter so pagination counts stay correct.
	 */
	async listPublic(query: PublicEventQuery) {
		const conditions: SQL[] = [
			eq(events.status, "PUBLISHED"),
			eq(organizations.verificationStatus, "VERIFIED"),
			eq(organizations.status, "ACTIVE"),
		];

		const now = new Date();
		if (query.when === "upcoming") {
			conditions.push(gte(events.startAt, now));
		} else if (query.when === "past") {
			conditions.push(lt(events.startAt, now));
		}

		if (query.city) {
			conditions.push(ilike(events.city, `%${query.city}%`));
		}
		if (query.organizationId) {
			conditions.push(eq(events.organizationId, query.organizationId));
		}
		if (query.search) {
			const term = `%${query.search}%`;
			const match = or(
				ilike(events.title, term),
				ilike(events.description, term),
				ilike(organizations.organizationName, term),
			);
			if (match) conditions.push(match);
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);
		// Past events read best newest-first; upcoming ones soonest-first.
		const order =
			query.when === "past" ? desc(events.startAt) : asc(events.startAt);

		const [items, [totals]] = await Promise.all([
			this.db
				.select(publicEventColumns)
				.from(events)
				.innerJoin(organizations, eq(events.organizationId, organizations.id))
				.where(where)
				.orderBy(order)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(events)
				.innerJoin(organizations, eq(events.organizationId, organizations.id))
				.where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Public event detail. When a volunteer is signed in, their own application
	 * is attached so the screen can render "Applied" instead of "Apply".
	 */
	async getPublicById(eventId: string, viewerId?: string) {
		const [event] = await this.db
			.select(publicEventColumns)
			.from(events)
			.innerJoin(organizations, eq(events.organizationId, organizations.id))
			.where(
				and(
					eq(events.id, eventId),
					eq(events.status, "PUBLISHED"),
					eq(organizations.verificationStatus, "VERIFIED"),
					eq(organizations.status, "ACTIVE"),
				),
			)
			.limit(1);

		if (!event) {
			throw new NotFoundException("Event not found");
		}

		const myApplication = viewerId
			? ((await this.db.query.eventApplications.findFirst({
					where: and(
						eq(eventApplications.eventId, eventId),
						eq(eventApplications.volunteerId, viewerId),
					),
					columns: {
						id: true,
						status: true,
						message: true,
						reviewNote: true,
						appliedAt: true,
					},
				})) ?? null)
			: null;

		return { ...event, myApplication };
	}

	// ─── Organisation-scoped management ──────────────────────────────────────

	async listForMyOrganization(userId: string, query: OrgEventQuery) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const conditions: SQL[] = [eq(events.organizationId, organization.id)];
		if (query.status) {
			conditions.push(eq(events.status, query.status));
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: events.id,
					title: events.title,
					city: events.city,
					state: events.state,
					startAt: events.startAt,
					endAt: events.endAt,
					status: events.status,
					volunteersNeeded: events.volunteersNeeded,
					acceptedCount: events.acceptedCount,
					coverImage: events.coverImage,
					createdAt: events.createdAt,
					// Table-qualified on purpose: an unqualified "id" here binds to
					// event_applications.id, not events.id, and silently returns 0.
					pendingApplications: sql<number>`(
						select count(*)::int from event_applications ea
						where ea.event_id = events.id and ea.status = 'PENDING'
					)`,
				})
				.from(events)
				.where(where)
				.orderBy(desc(events.startAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(events).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async create(userId: string, input: CreateEventInput) {
		// Drafting is always allowed; publishing to the public feed is not.
		const organization =
			input.status === "PUBLISHED"
				? await this.organizationsService.requireVerifiedOrganization(userId)
				: await this.organizationsService.requireOwnedOrganization(userId);

		const inserted = await this.db
			.insert(events)
			.values({
				organizationId: organization.id,
				title: input.title,
				description: input.description,
				coverImage: input.coverImage ?? null,
				venue: input.venue ?? null,
				address: input.address ?? null,
				city: input.city,
				state: input.state,
				startAt: input.startAt,
				endAt: input.endAt,
				applicationDeadline: input.applicationDeadline ?? null,
				volunteersNeeded: input.volunteersNeeded,
				status: input.status,
				createdBy: userId,
			})
			.returning();
		const event = takeFirstOrThrow(inserted, "create event");

		void this.audit.record({
			performedBy: userId,
			action: "CREATE_EVENT",
			entityName: "EVENT",
			entityId: event.id,
			newValue: { title: event.title, status: event.status },
		});

		return event;
	}

	async update(userId: string, eventId: string, input: UpdateEventInput) {
		const { event } = await this.requireOwnedEvent(userId, eventId);

		if (input.status === "PUBLISHED" && event.status !== "PUBLISHED") {
			await this.organizationsService.requireVerifiedOrganization(userId);
		}

		if (
			input.volunteersNeeded !== undefined &&
			input.volunteersNeeded < event.acceptedCount
		) {
			throw new BadRequestException(
				`You have already accepted ${event.acceptedCount} volunteers.`,
			);
		}

		const [updated] = await this.db
			.update(events)
			.set({
				...Object.fromEntries(
					Object.entries(input).filter(([, v]) => v !== undefined),
				),
				updatedAt: new Date(),
			})
			.where(eq(events.id, eventId))
			.returning();

		void this.audit.record({
			performedBy: userId,
			action: "UPDATE_EVENT",
			entityName: "EVENT",
			entityId: eventId,
			oldValue: { status: event.status, title: event.title },
			newValue: input,
		});

		return updated;
	}

	async remove(userId: string, eventId: string) {
		const { event } = await this.requireOwnedEvent(userId, eventId);

		// Volunteers have already been told they're in — cancel, don't delete.
		if (event.acceptedCount > 0) {
			const [cancelled] = await this.db
				.update(events)
				.set({ status: "CANCELLED", updatedAt: new Date() })
				.where(eq(events.id, eventId))
				.returning();

			void this.audit.record({
				performedBy: userId,
				action: "CANCEL_EVENT",
				entityName: "EVENT",
				entityId: eventId,
			});

			return { deleted: false, event: cancelled };
		}

		await this.db.delete(events).where(eq(events.id, eventId));

		void this.audit.record({
			performedBy: userId,
			action: "DELETE_EVENT",
			entityName: "EVENT",
			entityId: eventId,
			oldValue: { title: event.title },
		});

		return { deleted: true, event: null };
	}

	// ─── Applications ────────────────────────────────────────────────────────

	async apply(volunteerId: string, eventId: string, input: ApplyToEventInput) {
		const [event] = await this.db
			.select({
				id: events.id,
				status: events.status,
				startAt: events.startAt,
				applicationDeadline: events.applicationDeadline,
				volunteersNeeded: events.volunteersNeeded,
				acceptedCount: events.acceptedCount,
				organizationId: events.organizationId,
			})
			.from(events)
			.innerJoin(organizations, eq(events.organizationId, organizations.id))
			.where(
				and(
					eq(events.id, eventId),
					eq(events.status, "PUBLISHED"),
					eq(organizations.verificationStatus, "VERIFIED"),
					eq(organizations.status, "ACTIVE"),
				),
			)
			.limit(1);

		if (!event) {
			throw new NotFoundException("Event not found");
		}

		const now = new Date();
		const deadline = event.applicationDeadline ?? event.startAt;
		if (deadline < now) {
			throw new BadRequestException("Applications for this event have closed.");
		}
		if (event.acceptedCount >= event.volunteersNeeded) {
			throw new ConflictException("This event is already full.");
		}

		const existing = await this.db.query.eventApplications.findFirst({
			where: and(
				eq(eventApplications.eventId, eventId),
				eq(eventApplications.volunteerId, volunteerId),
			),
		});

		if (existing) {
			if (existing.status === "WITHDRAWN") {
				// Re-applying after withdrawing reuses the row so the unique index
				// on (event, volunteer) still holds.
				const [reopened] = await this.db
					.update(eventApplications)
					.set({
						status: "PENDING",
						message: input.message ?? null,
						reviewNote: null,
						reviewedBy: null,
						reviewedAt: null,
						updatedAt: new Date(),
					})
					.where(eq(eventApplications.id, existing.id))
					.returning();
				return reopened;
			}
			throw new ConflictException("You have already applied to this event.");
		}

		const application = takeFirstOrThrow(
			await this.db
				.insert(eventApplications)
				.values({
					eventId,
					volunteerId,
					message: input.message ?? null,
					status: "PENDING",
				})
				.returning(),
			"create event application",
		);

		void this.audit.record({
			performedBy: volunteerId,
			action: "APPLY_TO_EVENT",
			entityName: "EVENT_APPLICATION",
			entityId: application.id,
			newValue: { eventId },
		});

		return application;
	}

	async withdraw(volunteerId: string, eventId: string) {
		const application = await this.db.query.eventApplications.findFirst({
			where: and(
				eq(eventApplications.eventId, eventId),
				eq(eventApplications.volunteerId, volunteerId),
			),
		});

		if (!application) {
			throw new NotFoundException("You have not applied to this event.");
		}
		if (application.status === "WITHDRAWN") {
			return application;
		}

		// Withdrawing after acceptance frees the seat back up.
		const withdrawn = await this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(eventApplications)
				.set({ status: "WITHDRAWN", updatedAt: new Date() })
				.where(eq(eventApplications.id, application.id))
				.returning();

			if (application.status === "ACCEPTED") {
				await tx
					.update(events)
					.set({
						acceptedCount: sql`greatest(${events.acceptedCount} - 1, 0)`,
						updatedAt: new Date(),
					})
					.where(eq(events.id, eventId));
			}

			return row;
		});

		void this.audit.record({
			performedBy: volunteerId,
			action: "WITHDRAW_APPLICATION",
			entityName: "EVENT_APPLICATION",
			entityId: application.id,
		});

		return withdrawn;
	}

	async listMyApplications(volunteerId: string, query: ApplicationQuery) {
		const conditions: SQL[] = [eq(eventApplications.volunteerId, volunteerId)];
		if (query.status) {
			conditions.push(eq(eventApplications.status, query.status));
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db
				.select({
					id: eventApplications.id,
					status: eventApplications.status,
					message: eventApplications.message,
					reviewNote: eventApplications.reviewNote,
					appliedAt: eventApplications.appliedAt,
					event: {
						id: events.id,
						title: events.title,
						startAt: events.startAt,
						endAt: events.endAt,
						city: events.city,
						coverImage: events.coverImage,
						status: events.status,
					},
					organization: {
						id: organizations.id,
						organizationName: organizations.organizationName,
						logo: organizations.logo,
					},
				})
				.from(eventApplications)
				.innerJoin(events, eq(eventApplications.eventId, events.id))
				.innerJoin(organizations, eq(events.organizationId, organizations.id))
				.where(where)
				.orderBy(desc(eventApplications.appliedAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(eventApplications).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async listApplicants(
		userId: string,
		eventId: string,
		query: ApplicationQuery,
	) {
		await this.requireOwnedEvent(userId, eventId);

		const conditions: SQL[] = [eq(eventApplications.eventId, eventId)];
		if (query.status) {
			conditions.push(eq(eventApplications.status, query.status));
		}

		const where = and(...conditions);
		const { limit, offset } = toOffset(query);

		const [items, [totals]] = await Promise.all([
			this.db.query.eventApplications.findMany({
				where,
				limit,
				offset,
				orderBy: desc(eventApplications.appliedAt),
				with: {
					volunteer: {
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
			this.db.select({ value: count() }).from(eventApplications).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	/**
	 * Accept or reject an applicant.
	 *
	 * Acceptance re-checks capacity inside the transaction with a locked event
	 * row, so two admins reviewing simultaneously cannot overfill the event.
	 */
	async reviewApplication(
		userId: string,
		eventId: string,
		applicationId: string,
		input: ReviewApplicationInput,
	) {
		await this.requireOwnedEvent(userId, eventId);

		const result = await this.db.transaction(async (tx) => {
			const lockedEvent = takeFirstOrThrow(
				await tx
					.select({
						id: events.id,
						volunteersNeeded: events.volunteersNeeded,
						acceptedCount: events.acceptedCount,
					})
					.from(events)
					.where(eq(events.id, eventId))
					.for("update"),
				"lock event for application review",
			);

			const application = await tx.query.eventApplications.findFirst({
				where: and(
					eq(eventApplications.id, applicationId),
					eq(eventApplications.eventId, eventId),
				),
			});

			if (!application) {
				throw new NotFoundException("Application not found");
			}
			if (application.status === "WITHDRAWN") {
				throw new BadRequestException(
					"This volunteer withdrew their application.",
				);
			}
			if (application.status === input.status) {
				return application;
			}

			if (
				input.status === "ACCEPTED" &&
				lockedEvent.acceptedCount >= lockedEvent.volunteersNeeded
			) {
				throw new ConflictException(
					"All volunteer places for this event are filled.",
				);
			}

			const updatedRows = await tx
				.update(eventApplications)
				.set({
					status: input.status,
					reviewNote: input.reviewNote ?? null,
					reviewedBy: userId,
					reviewedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(eventApplications.id, applicationId))
				.returning();

			// Keep the denormalised counter in step with the status transition.
			const delta =
				input.status === "ACCEPTED"
					? 1
					: application.status === "ACCEPTED"
						? -1
						: 0;

			if (delta !== 0) {
				await tx
					.update(events)
					.set({
						acceptedCount: sql`greatest(${events.acceptedCount} + ${delta}, 0)`,
						updatedAt: new Date(),
					})
					.where(eq(events.id, eventId));
			}

			return takeFirstOrThrow(updatedRows, "review event application");
		});

		void this.notifications.notify({
			userId: result.volunteerId,
			type:
				input.status === "ACCEPTED"
					? "APPLICATION_ACCEPTED"
					: "APPLICATION_REJECTED",
			title:
				input.status === "ACCEPTED"
					? "You're confirmed for an event"
					: "Your application wasn't accepted",
			body: input.reviewNote ?? undefined,
			entityName: "EVENT",
			entityId: eventId,
		});

		void this.audit.record({
			performedBy: userId,
			action: `REVIEW_APPLICATION_${input.status}`,
			entityName: "EVENT_APPLICATION",
			entityId: applicationId,
			newValue: { status: input.status },
		});

		return result;
	}

	// ─── Internals ───────────────────────────────────────────────────────────

	private async requireOwnedEvent(userId: string, eventId: string) {
		const organization =
			await this.organizationsService.requireOwnedOrganization(userId);

		const event = await this.db.query.events.findFirst({
			where: eq(events.id, eventId),
		});

		if (!event) {
			throw new NotFoundException("Event not found");
		}
		if (event.organizationId !== organization.id) {
			throw new ForbiddenException(
				"This event belongs to another organization.",
			);
		}

		return { event, organization };
	}
}
