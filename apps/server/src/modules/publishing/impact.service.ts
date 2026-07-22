import type { db as dbType } from "@nabhya/db";
import {
	certificates,
	eventApplications,
	events,
	needPledges,
	organizationNeeds,
	organizations,
} from "@nabhya/db/schema";
import type { OrganizationImpact, VolunteerImpact } from "@nabhya/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";

/**
 * Derived statistics. Nothing here is stored — it is all computed from
 * applications, attendance, pledges and certificates that already exist, so
 * these numbers cannot drift from the underlying records.
 *
 * Hours come from the attended events' own durations rather than a separate
 * field, which means an organization cannot inflate a volunteer's contribution
 * without also changing the event everyone else can see.
 */
@Injectable()
export class ImpactService {
	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

	async getVolunteerImpact(volunteerId: string): Promise<VolunteerImpact> {
		const [participation] = await this.db
			.select({
				applicationsSubmitted: sql<number>`count(*)::int`,
				accepted: sql<number>`count(*) filter (
					where ${eventApplications.status} = 'ACCEPTED')::int`,
				attended: sql<number>`count(*) filter (
					where ${eventApplications.attendedAt} is not null)::int`,
				organizationsHelped: sql<number>`count(distinct ${events.organizationId})
					filter (where ${eventApplications.attendedAt} is not null)::int`,
				// Event duration in hours, summed across attended events only.
				hours: sql<number>`coalesce(round(sum(
					extract(epoch from (${events.endAt} - ${events.startAt})) / 3600
				) filter (where ${eventApplications.attendedAt} is not null)), 0)::int`,
				firstAttended: sql<Date | null>`min(${eventApplications.attendedAt})`,
			})
			.from(eventApplications)
			.innerJoin(events, eq(eventApplications.eventId, events.id))
			.where(eq(eventApplications.volunteerId, volunteerId));

		const [giving] = await this.db
			.select({
				pledgesCompleted: sql<number>`count(*) filter (
					where ${needPledges.status} in ('ACCEPTED', 'COMPLETED'))::int`,
				itemsDonated: sql<number>`coalesce(sum(${needPledges.quantity})
					filter (where ${needPledges.status} in ('ACCEPTED', 'COMPLETED')), 0)::int`,
			})
			.from(needPledges)
			.where(eq(needPledges.userId, volunteerId));

		const [certs] = await this.db
			.select({ value: sql<number>`count(*)::int` })
			.from(certificates)
			.where(
				and(
					eq(certificates.volunteerId, volunteerId),
					sql`${certificates.revokedAt} is null`,
				),
			);

		const submitted = participation?.applicationsSubmitted ?? 0;
		const accepted = participation?.accepted ?? 0;

		return {
			eventsAttended: participation?.attended ?? 0,
			organizationsHelped: participation?.organizationsHelped ?? 0,
			hoursContributed: participation?.hours ?? 0,
			certificatesEarned: certs?.value ?? 0,
			itemsDonated: giving?.itemsDonated ?? 0,
			pledgesCompleted: giving?.pledgesCompleted ?? 0,
			applicationsSubmitted: submitted,
			// Guarded: a new volunteer with no applications is 0%, not NaN.
			acceptanceRate:
				submitted > 0 ? Math.round((accepted / submitted) * 100) : 0,
			firstVolunteeredAt: participation?.firstAttended
				? new Date(participation.firstAttended).toISOString()
				: null,
		};
	}

	/** Public transparency figures shown on an organization's profile. */
	async getOrganizationImpact(
		organizationId: string,
	): Promise<OrganizationImpact> {
		// Public transparency figures are only served for a publicly-visible NGO;
		// a suspended or unverified org must not keep exposing its stats.
		const [org] = await this.db
			.select({
				createdAt: organizations.createdAt,
				verificationStatus: organizations.verificationStatus,
				status: organizations.status,
			})
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		if (
			!org ||
			org.verificationStatus !== "VERIFIED" ||
			org.status !== "ACTIVE"
		) {
			throw new NotFoundException("Organization not found");
		}

		const [hosting] = await this.db
			.select({
				eventsHosted: sql<number>`count(distinct ${events.id}) filter (
					where ${events.status} in ('PUBLISHED', 'COMPLETED'))::int`,
				volunteersEngaged: sql<number>`count(distinct ${eventApplications.volunteerId})
					filter (where ${eventApplications.attendedAt} is not null)::int`,
				volunteerHours: sql<number>`coalesce(round(sum(
					extract(epoch from (${events.endAt} - ${events.startAt})) / 3600
				) filter (where ${eventApplications.attendedAt} is not null)), 0)::int`,
			})
			.from(events)
			.leftJoin(eventApplications, eq(eventApplications.eventId, events.id))
			.where(eq(events.organizationId, organizationId));

		const [giving] = await this.db
			.select({
				needsFulfilled: sql<number>`count(*) filter (
					where ${organizationNeeds.status} = 'FULFILLED')::int`,
				itemsReceived: sql<number>`coalesce(
					sum(${organizationNeeds.fulfilledQuantity}), 0)::int`,
			})
			.from(organizationNeeds)
			.where(eq(organizationNeeds.organizationId, organizationId));

		const [certs] = await this.db
			.select({ value: sql<number>`count(*)::int` })
			.from(certificates)
			.where(eq(certificates.organizationId, organizationId));

		return {
			eventsHosted: hosting?.eventsHosted ?? 0,
			volunteersEngaged: hosting?.volunteersEngaged ?? 0,
			volunteerHours: hosting?.volunteerHours ?? 0,
			certificatesIssued: certs?.value ?? 0,
			needsFulfilled: giving?.needsFulfilled ?? 0,
			itemsReceived: giving?.itemsReceived ?? 0,
			activeSince: org?.createdAt ? org.createdAt.toISOString() : null,
		};
	}

	/**
	 * Marks finished events as COMPLETED.
	 *
	 * Without this nothing ever leaves PUBLISHED, so the "Past" filter stays
	 * empty and finished events keep accepting applications. Called on a
	 * schedule and on demand from the admin console.
	 */
	async closeFinishedEvents(): Promise<{ completed: number }> {
		const updated = await this.db
			.update(events)
			.set({ status: "COMPLETED", updatedAt: new Date() })
			.where(
				and(
					eq(events.status, "PUBLISHED"),
					sql`${events.endAt} < now()`,
					isNotNull(events.endAt),
				),
			)
			.returning({ id: events.id });

		return { completed: updated.length };
	}
}
