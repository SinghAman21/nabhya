import type { db as dbType } from "@nabhya/db";
import {
	certificates,
	eventApplications,
	events,
	organizations,
} from "@nabhya/db/schema";
import type {
	ApplicationQuery,
	ApplicationStatusCounts,
	ApplyToEventInput,
	BulkResult,
	BulkReviewApplicationsInput,
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
	inArray,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { AuditService } from "../../common/audit";
import { DB_TOKEN } from "../../common/database";
import {
	assertIdentityVerified,
	paginate,
	takeFirstOrThrow,
	toOffset,
} from "../../common/utils";
import { orderBySort } from "../../common/utils/order";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { UploadsService } from "../uploads/uploads.service";

/** Columns exposed on the public feed - never the internal review fields. */
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
	isUrgent: events.isUrgent,
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
		@Inject(UploadsService) private readonly uploads: UploadsService,
	) {}

	// ─── Public feed ─────────────────────────────────────────────────────────

	/**
	 * The volunteer-facing feed. Only PUBLISHED events belonging to verified,
	 * active organizations are ever visible - this is enforced with an inner
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
					isUrgent: events.isUrgent,
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
				.orderBy(
					...orderBySort(
						query.sort,
						query.dir,
						{
							startAt: events.startAt,
							title: events.title,
							status: events.status,
							accepted: events.acceptedCount,
							// Literal and table-qualified, like the select above: an
							// interpolated column here would bind to the subquery's own
							// table and every row would sort as zero.
							pending: sql`(
								select count(*)::int from event_applications ea
								where ea.event_id = events.id and ea.status = 'PENDING'
							)`,
							createdAt: events.createdAt,
						},
						{ column: events.startAt, dir: "desc" },
						events.id,
					),
				)
				.limit(limit)
				.offset(offset),
			this.db.select({ value: count() }).from(events).where(where),
		]);

		return paginate(items, totals?.value ?? 0, query);
	}

	async create(userId: string, input: CreateEventInput) {
		// Drafting is allowed for active members; publishing is permission-gated.
		if (input.status === "PUBLISHED") {
			await this.organizationsService.requireOrgPermission(
				userId,
				"content.publish",
			);
		} else {
			await this.requireCanDraft(userId);
		}
		const organization =
			input.status === "PUBLISHED"
				? await this.organizationsService.requireVerifiedOrganization(userId)
				: await this.organizationsService.requireOwnedOrganization(userId);
		if (input.coverImage) {
			await this.uploads.assertUploaded(input.coverImage, {
				purpose: "EVENT_COVER",
				ownerId: organization.id,
			});
		}

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
				isUrgent: input.isUrgent,
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

	/**
	 * Full detail of one of the caller's own events. The list endpoint only
	 * carries summary fields, so the edit form needs this to pre-fill
	 * `description`, `venue` and `address` instead of blanking them.
	 */
	async getMyEvent(userId: string, eventId: string) {
		const { event } = await this.requireOwnedEvent(userId, eventId);
		return event;
	}

	async update(userId: string, eventId: string, input: UpdateEventInput) {
		const { event, organization } = await this.requireOwnedEvent(
			userId,
			eventId,
		);
		if (input.coverImage) {
			await this.uploads.assertUploaded(input.coverImage, {
				purpose: "EVENT_COVER",
				ownerId: organization.id,
			});
		}

		if (input.status === "PUBLISHED" && event.status !== "PUBLISHED") {
			await this.organizationsService.requireOrgPermission(
				userId,
				"content.publish",
			);
			await this.organizationsService.requireVerifiedOrganization(userId);
		} else if (event.status !== "DRAFT") {
			// Anything already in front of volunteers - its dates, its headcount,
			// cancelling it - is publishing, whoever typed it. Only a draft may be
			// worked on without the permission.
			await this.organizationsService.requireOrgPermission(
				userId,
				"content.publish",
			);
		} else {
			await this.requireCanDraft(userId);
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

	/**
	 * Drafts are open to the whole team except viewers, whose role is
	 * read-only (`ROLE_PERMISSIONS.VIEWER` grants only `money.view`). There is
	 * no `content.draft` action, so this is the one role check made by name.
	 */
	private async requireCanDraft(userId: string) {
		const membership =
			await this.organizationsService.getActiveMembership(userId);
		if (membership?.role === "VIEWER") {
			throw new ForbiddenException(
				"Viewers can't create or edit events - ask an admin.",
			);
		}
	}

	async remove(userId: string, eventId: string) {
		await this.organizationsService.requireOrgPermission(
			userId,
			"content.delete",
		);
		const { event } = await this.requireOwnedEvent(userId, eventId);

		// Volunteers have already been told they're in - cancel, don't delete.
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
				title: events.title,
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

		await assertIdentityVerified(this.db, volunteerId);

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
				this.notifyNewApplicant(event);
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
		this.notifyNewApplicant(event);

		return application;
	}

	/**
	 * `NEW_APPLICATION` was in the enum and never sent, so an NGO only found
	 * applicants by opening the event. Goes to whoever can review them.
	 */
	private notifyNewApplicant(event: {
		id: string;
		title: string;
		organizationId: string;
	}) {
		void this.notifications.notifyOrganizationTeam(
			event.organizationId,
			{
				type: "NEW_APPLICATION",
				title: `New applicant for ${event.title}`,
				body: "Open it to accept or decline the application.",
				entityName: "EVENT",
				entityId: event.id,
			},
			{ permission: "people.review" },
		);
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
		const counts = await this.applicationCounts(eventId);

		// Attached with a second bounded query rather than a correlated subquery:
		// the relational builder aliases its FROM, so hand-written qualified SQL
		// cannot reliably reference it. Without this the organization has no way
		// to see - or revoke - a certificate it has already issued.
		const issued = items.length
			? await this.db
					.select({
						id: certificates.id,
						code: certificates.code,
						applicationId: certificates.applicationId,
						revokedAt: certificates.revokedAt,
					})
					.from(certificates)
					.where(
						inArray(
							certificates.applicationId,
							items.map((item) => item.id),
						),
					)
			: [];

		const byApplication = new Map(
			issued.map((row) => [row.applicationId, row]),
		);

		return {
			...paginate(
				items.map((item) => ({
					...item,
					certificate: byApplication.get(item.id) ?? null,
				})),
				totals?.value ?? 0,
				query,
			),
			counts,
		};
	}

	/**
	 * Every state's count on one event, ignoring the status filter - so the
	 * review drawer's chips can read "Pending 3 / Accepted 2" before either is
	 * pressed, the way `awaitingReplyCount` lets the reviews header say "3
	 * awaiting". One grouped query; a missing state is a zero, not absent.
	 */
	private async applicationCounts(
		eventId: string,
	): Promise<ApplicationStatusCounts> {
		const rows = await this.db
			.select({ status: eventApplications.status, value: count() })
			.from(eventApplications)
			.where(eq(eventApplications.eventId, eventId))
			.groupBy(eventApplications.status);
		const counts: ApplicationStatusCounts = {
			PENDING: 0,
			ACCEPTED: 0,
			REJECTED: 0,
			WITHDRAWN: 0,
			all: 0,
		};
		for (const row of rows) {
			counts[row.status] = row.value;
			counts.all += row.value;
		}
		return counts;
	}

	/**
	 * Accept or reject an applicant.
	 *
	 * Acceptance re-checks capacity inside the transaction with a locked event
	 * row, so two admins reviewing simultaneously cannot overfill the event.
	 */
	/**
	 * Accept or reject a selection, in order, one transaction each - so places
	 * fill exactly as they would one tap at a time, and whoever is past the last
	 * place comes back as a failure with the reason rather than a silent skip.
	 * The role check runs once up front: a teammate who cannot review gets one
	 * 403, not fifty identical failures.
	 */
	async bulkReviewApplications(
		userId: string,
		eventId: string,
		input: BulkReviewApplicationsInput,
	): Promise<BulkResult> {
		await this.organizationsService.requireOrgPermission(
			userId,
			"people.review",
		);
		await this.requireOwnedEvent(userId, eventId);

		const done: string[] = [];
		const failed: BulkResult["failed"] = [];
		// Deduplicated: a selection built across loaded pages can repeat an id.
		for (const id of [...new Set(input.ids)]) {
			try {
				await this.reviewApplication(userId, eventId, id, {
					status: input.status,
					...(input.reviewNote ? { reviewNote: input.reviewNote } : {}),
				});
				done.push(id);
			} catch (error) {
				failed.push({
					id,
					reason:
						error instanceof Error ? error.message : "Could not be reviewed",
				});
			}
		}
		return { done, failed };
	}

	async reviewApplication(
		userId: string,
		eventId: string,
		applicationId: string,
		input: ReviewApplicationInput,
	) {
		await this.organizationsService.requireOrgPermission(
			userId,
			"people.review",
		);
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
