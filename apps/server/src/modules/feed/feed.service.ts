import type { db as dbType } from "@nabhya/db";
import type { FeedKind, FeedQuery, Paginated } from "@nabhya/shared";
import { Inject, Injectable } from "@nestjs/common";
import { type SQL, sql } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import { paginate, toOffset } from "../../common/utils";

/**
 * One row of the unified feed as the client receives it. The kind-specific
 * facts sit under a key named after the kind so a card can narrow on `kind`.
 */
export interface FeedItem {
	kind: FeedKind;
	id: string;
	title: string;
	description: string;
	city: string | null;
	state: string | null;
	postedAt: string;
	isUrgent: boolean;
	isFollowing: boolean;
	organization: {
		id: string;
		organizationName: string;
		logo: string | null;
		city: string | null;
		state: string | null;
		verificationStatus: string | null;
	};
	need?: Record<string, unknown>;
	event?: Record<string, unknown>;
	story?: Record<string, unknown>;
}

interface FeedRow {
	kind: FeedKind;
	id: string;
	title: string;
	description: string;
	city: string | null;
	state: string | null;
	posted_at: Date | string;
	urgent: boolean;
	recent_engagement: string | number;
	payload: Record<string, unknown>;
	organization: FeedItem["organization"];
	is_following: boolean;
	total: string | number;
}

/**
 * Written as one SQL statement rather than three Drizzle queries merged in
 * JS: three separately paginated lists cannot be interleaved — page 2 of the
 * merged result is undefined — so the union, the ranking and the offset all
 * have to happen in the database. Literal, table-qualified SQL throughout; see
 * `apps/server/AGENTS.md` on why `${table.column}` inside a select is a trap.
 */
@Injectable()
export class FeedService {
	constructor(@Inject(DB_TOKEN) private readonly db: typeof dbType) {}

	async list(
		query: FeedQuery,
		userId: string | null,
	): Promise<Paginated<FeedItem>> {
		// "Following" is meaningless without a signed-in follower.
		if (query.tab === "following" && !userId) {
			return paginate([], 0, query);
		}

		const { limit, offset } = toOffset(query);
		const conditions: SQL[] = [
			sql`o.verification_status = 'VERIFIED'`,
			sql`o.status = 'ACTIVE'`,
		];

		if (query.categoryId) {
			conditions.push(
				sql`exists (select 1 from organization_categories oc
					where oc.organization_id = o.id and oc.category_id = ${query.categoryId})`,
			);
		}
		if (query.kind) {
			conditions.push(sql`i.kind = ${query.kind}`);
		}
		if (query.city) {
			const term = `%${query.city}%`;
			conditions.push(
				sql`(i.city ilike ${term} or (i.city is null and o.city ilike ${term}))`,
			);
		}
		if (query.search) {
			const term = `%${query.search}%`;
			conditions.push(
				sql`(i.title ilike ${term} or i.description ilike ${term} or o.organization_name ilike ${term})`,
			);
		}

		const following = userId
			? sql`exists (select 1 from bookmarks b
					where b.user_id = ${userId} and b.organization_id = o.id)`
			: sql`false`;

		let orderBy: SQL;
		switch (query.tab) {
			case "following":
				conditions.push(following);
				orderBy = sql`i.posted_at desc`;
				break;
			case "trending":
				// Stories have no engagement signal; a trending list of them would
				// be a ranked list of nothing.
				conditions.push(sql`i.kind <> 'story'`);
				conditions.push(sql`i.recent_engagement > 0`);
				orderBy = sql`i.recent_engagement desc, i.posted_at desc`;
				break;
			case "urgent":
				conditions.push(sql`i.urgent`);
				orderBy = sql`i.posted_at desc`;
				break;
			default: {
				// Interest match outweighs proximity, proximity outweighs urgency,
				// and recency breaks ties. Anonymous callers only have the last two.
				const interest = userId
					? sql`(case when exists (select 1 from organization_categories oc
							join user_categories uc on uc.category_id = oc.category_id
							where oc.organization_id = o.id and uc.user_id = ${userId}) then 3 else 0 end)`
					: sql`0`;
				const proximity = userId
					? sql`(case when coalesce(i.city, o.city) ilike
							(select u.city from users u where u.id = ${userId}) then 2 else 0 end)`
					: sql`0`;
				orderBy = sql`(${interest} + ${proximity} + (case when i.urgent then 1 else 0 end)) desc, i.posted_at desc`;
			}
		}

		const where = sql.join(conditions, sql` and `);

		const statement = sql`
			with items as (
				select 'need' as kind, n.id, n.organization_id, n.title, n.description,
					n.city, n.state, n.created_at as posted_at,
					(n.urgency = 'HIGH') as urgent,
					(select count(*) from need_pledges p
						where p.need_id = n.id and p.created_at > now() - interval '7 days') as recent_engagement,
					json_build_object(
						'type', n.type, 'quantity', n.quantity, 'unit', n.unit,
						'fulfilledQuantity', n.fulfilled_quantity, 'urgency', n.urgency,
						'status', n.status, 'expiresAt', n.expires_at
					) as payload
				from organization_needs n
				where n.status = 'OPEN' and (n.expires_at is null or n.expires_at > now())

				union all

				select 'event', e.id, e.organization_id, e.title, e.description,
					e.city, e.state, e.created_at,
					(coalesce(e.application_deadline, e.start_at) < now() + interval '3 days'),
					(select count(*) from event_applications a
						where a.event_id = e.id and a.applied_at > now() - interval '7 days'),
					json_build_object(
						'coverImage', e.cover_image, 'venue', e.venue, 'startAt', e.start_at,
						'endAt', e.end_at, 'applicationDeadline', e.application_deadline,
						'volunteersNeeded', e.volunteers_needed, 'acceptedCount', e.accepted_count,
						'status', e.status
					)
				from events e
				where e.status = 'PUBLISHED' and e.start_at > now()

				union all

				select 'story', a.id, a.organization_id, a.title, a.body,
					null, null, coalesce(a.published_at, a.created_at),
					false, 0::bigint,
					json_build_object('coverImageKey', a.cover_image_key, 'isPinned', a.is_pinned)
				from announcements a
				where a.status = 'PUBLISHED'
			)
			select i.kind, i.id, i.title, i.description, i.city, i.state, i.posted_at,
				i.urgent, i.recent_engagement, i.payload,
				json_build_object(
					'id', o.id, 'organizationName', o.organization_name, 'logo', o.logo,
					'city', o.city, 'state', o.state, 'verificationStatus', o.verification_status
				) as organization,
				${following} as is_following,
				count(*) over() as total
			from items i
			join organizations o on o.id = i.organization_id
			where ${where}
			order by ${orderBy}
			limit ${limit} offset ${offset}
		`;

		const result = await this.db.execute(statement);
		const rows = result.rows as unknown as FeedRow[];
		const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;

		const items = rows.map((row): FeedItem => {
			const postedAt =
				row.posted_at instanceof Date
					? row.posted_at.toISOString()
					: new Date(row.posted_at).toISOString();
			return {
				kind: row.kind,
				id: row.id,
				title: row.title,
				description: row.description,
				city: row.city,
				state: row.state,
				postedAt,
				isUrgent: row.urgent,
				isFollowing: row.is_following,
				organization: row.organization,
				[row.kind]: row.payload,
			};
		});

		return paginate(items, total, query);
	}
}
