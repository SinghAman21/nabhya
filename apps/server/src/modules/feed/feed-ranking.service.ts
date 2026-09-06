import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	eventApplications,
	events,
	needPledges,
	needs,
	organizationCategories,
	organizationFollows,
	organizations,
	postComments,
	postInteractions,
	posts,
	postsMedia,
	userCategories,
	users,
} from "@nabhya/db/schema";
import type {
	FeedFilterQuery,
	FollowingFeedQuery,
	ForYouFeedQuery,
	PostTag,
	TrendingFeedQuery,
} from "@nabhya/shared";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import { STORAGE_TOKEN, type StorageProvider } from "../../common/storage";
import type { AuthUser } from "../../common/types";
import { paginate, toOffset } from "../../common/utils";

type Candidate = {
	id: string;
	type: PostTag;
	organizationId: string | null;
	organization: { id: string; name: string; logo: string | null } | null;
	author: {
		id: string;
		fullName: string | null;
		profileImage: string | null;
	} | null;
	createdAt: Date;
	city: string | null;
	state: string | null;
	latitude: number | null;
	longitude: number | null;
	urgency: "LOW" | "MEDIUM" | "HIGH" | null;
	content: Record<string, unknown>;
	categoryIds: string[];
	engagement: {
		likes: number;
		saves: number;
		shares: number;
		comments: number;
		applications: number;
		pledges: number;
	};
	viewer: {
		followsOrganization: boolean;
		liked: boolean;
		saved: boolean;
	} | null;
	score?: number;
};

const SOURCE_LIMIT = 150;
const RECENT_INTERACTION_DAYS = 14;

@Injectable()
export class FeedRankingService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	async forYou(user: AuthUser | undefined, query: ForYouFeedQuery) {
		const candidates = applyFilters(await this.candidates(user), query);
		const context = await this.viewerContext(user?.id);
		for (const candidate of candidates)
			candidate.score = this.forYouScore(candidate, context);
		return this.page(
			this.diversify(candidates.sort(byScore)),
			candidates.length,
			query,
			user?.id,
		);
	}

	async trending(user: AuthUser | undefined, query: TrendingFeedQuery) {
		const candidates = applyFilters(await this.candidates(user), query);
		const context = await this.viewerContext(user?.id);
		for (const candidate of candidates)
			candidate.score = this.trendingScore(candidate, context);
		return this.page(
			this.diversify(candidates.sort(byScore)),
			candidates.length,
			query,
			user?.id,
		);
	}

	async following(user: AuthUser, query: FollowingFeedQuery) {
		const candidates = applyFilters(await this.candidates(user), query);
		const following = new Set(
			(
				await this.db
					.select({ id: organizationFollows.organizationId })
					.from(organizationFollows)
					.where(eq(organizationFollows.userId, user.id))
			).map((row) => row.id),
		);
		const selected = candidates
			.filter(
				(candidate) =>
					candidate.organizationId && following.has(candidate.organizationId),
			)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return this.page(selected, selected.length, query, user.id);
	}

	private async candidates(user: AuthUser | undefined): Promise<Candidate[]> {
		const visibleOrg = and(
			eq(organizations.verificationStatus, "VERIFIED"),
			eq(organizations.status, "ACTIVE"),
		);
		const now = new Date();
		const [postRows, eventRows, needRows, announcementRows] = await Promise.all(
			[
				this.db
					.select({ post: posts, org: organizations, author: users })
					.from(posts)
					.leftJoin(organizations, eq(posts.organizationId, organizations.id))
					.innerJoin(users, eq(posts.authorUserId, users.id))
					.where(sql`(${posts.organizationId} is null or (${visibleOrg}))`)
					.orderBy(desc(posts.createdAt))
					.limit(SOURCE_LIMIT),
				this.db
					.select({ event: events, org: organizations, author: users })
					.from(events)
					.innerJoin(organizations, eq(events.organizationId, organizations.id))
					.leftJoin(users, eq(events.createdBy, users.id))
					.where(
						and(
							visibleOrg,
							eq(events.status, "PUBLISHED"),
							gte(events.endAt, now),
						),
					)
					.orderBy(desc(events.createdAt))
					.limit(SOURCE_LIMIT),
				this.db
					.select({
						need: needs,
						org: organizations,
						author: users,
					})
					.from(needs)
					.innerJoin(organizations, eq(needs.organizationId, organizations.id))
					.leftJoin(users, eq(needs.createdBy, users.id))
					.where(
						and(
							visibleOrg,
							eq(needs.status, "OPEN"),
							sql`(${needs.expiresAt} is null or ${needs.expiresAt} >= ${now})`,
						),
					)
					.orderBy(desc(needs.createdAt))
					.limit(SOURCE_LIMIT),
				this.db
					.select({
						announcement: announcements,
						org: organizations,
						author: users,
					})
					.from(announcements)
					.innerJoin(
						organizations,
						eq(announcements.organizationId, organizations.id),
					)
					.leftJoin(users, eq(announcements.createdBy, users.id))
					.where(and(visibleOrg, eq(announcements.status, "PUBLISHED")))
					.orderBy(desc(announcements.publishedAt))
					.limit(SOURCE_LIMIT),
			],
		);
		const postIds = postRows.map((row) => row.post.id);
		const media = postIds.length
			? await this.db
					.select()
					.from(postsMedia)
					.where(inArray(postsMedia.postId, postIds))
					.orderBy(postsMedia.sortOrder)
			: [];
		const mediaByPost = Map.groupBy(media, (item) => item.postId);
		const result: Candidate[] = [
			...(await Promise.all(
				postRows.map(async ({ post, org, author }) => ({
					id: post.id,
					type: post.tag,
					organizationId: post.organizationId,
					organization: org ? orgSummary(org) : null,
					author: userSummary(author),
					createdAt: post.createdAt,
					city: post.city ?? org?.city ?? null,
					state: post.state ?? org?.state ?? null,
					latitude: numberOrNull(post.latitude ?? org?.latitude),
					longitude: numberOrNull(post.longitude ?? org?.longitude),
					urgency: post.tag === "URGENT" ? ("HIGH" as const) : null,
					categoryIds: [],
					engagement: emptyEngagement(),
					viewer: null,
					content: {
						text: post.text,
						media: await Promise.all(
							(mediaByPost.get(post.id) ?? []).map(async (item) => ({
								id: item.id,
								type: item.mediaType,
								url: await this.storage.createDownloadUrl(item.objectKey),
								sortOrder: item.sortOrder,
							})),
						),
					},
				})),
			)),
			...eventRows.map(({ event, org, author }) => ({
				id: event.id,
				type: "EVENT" as const,
				organizationId: event.organizationId,
				organization: orgSummary(org),
				author: author ? userSummary(author) : null,
				createdAt: event.createdAt,
				city: event.city ?? org.city,
				state: event.state ?? org.state,
				latitude: numberOrNull(event.latitude ?? org.latitude),
				longitude: numberOrNull(event.longitude ?? org.longitude),
				urgency: null,
				categoryIds: [],
				engagement: emptyEngagement(),
				viewer: null,
				content: {
					title: event.title,
					description: event.description,
					coverImage: event.coverImage,
					venue: event.venue,
					startAt: event.startAt,
					endAt: event.endAt,
					volunteersNeeded: event.volunteersNeeded,
					acceptedCount: event.acceptedCount,
				},
			})),
			...needRows.map(({ need, org, author }) => ({
				id: need.id,
				type: "NEED" as const,
				organizationId: need.organizationId,
				organization: orgSummary(org),
				author: author ? userSummary(author) : null,
				createdAt: need.createdAt,
				city: need.city ?? org.city,
				state: need.state ?? org.state,
				latitude: numberOrNull(org.latitude),
				longitude: numberOrNull(org.longitude),
				urgency: need.urgency,
				categoryIds: [],
				engagement: emptyEngagement(),
				viewer: null,
				content: {
					type: need.type,
					title: need.title,
					description: need.description,
					quantity: need.quantity,
					unit: need.unit,
					fulfilledQuantity: need.fulfilledQuantity,
					expiresAt: need.expiresAt,
				},
			})),
			...announcementRows.map(({ announcement, org, author }) => ({
				id: announcement.id,
				type: "ANNOUNCEMENT" as const,
				organizationId: announcement.organizationId,
				organization: orgSummary(org),
				author: author ? userSummary(author) : null,
				createdAt: announcement.publishedAt ?? announcement.createdAt,
				city: org.city,
				state: org.state,
				latitude: numberOrNull(org.latitude),
				longitude: numberOrNull(org.longitude),
				urgency: null,
				categoryIds: [],
				engagement: emptyEngagement(),
				viewer: null,
				content: {
					title: announcement.title,
					body: announcement.body,
					coverImageKey: announcement.coverImageKey,
					isPinned: announcement.isPinned,
				},
			})),
		];
		await this.hydrate(result, user?.id);
		return result;
	}

	private async hydrate(candidates: Candidate[], viewerId?: string) {
		const organizationIds = [
			...new Set(
				candidates.flatMap((candidate) =>
					candidate.organizationId ? [candidate.organizationId] : [],
				),
			),
		];
		const [
			categoryRows,
			interactionRows,
			commentRows,
			applications,
			pledges,
			follows,
		] = await Promise.all([
			organizationIds.length
				? this.db
						.select({
							organizationId: organizationCategories.organizationId,
							categoryId: organizationCategories.categoryId,
						})
						.from(organizationCategories)
						.where(
							inArray(organizationCategories.organizationId, organizationIds),
						)
				: [],
			this.db
				.select()
				.from(postInteractions)
				.where(
					gte(
						postInteractions.createdAt,
						new Date(Date.now() - RECENT_INTERACTION_DAYS * 86_400_000),
					),
				),
			this.db
				.select({
					tag: postComments.tag,
					postId: postComments.postId,
				})
				.from(postComments),
			this.db
				.select({
					id: eventApplications.eventId,
					count: sql<number>`count(*)::int`,
				})
				.from(eventApplications)
				.groupBy(eventApplications.eventId),
			this.db
				.select({ id: needPledges.needId, count: sql<number>`count(*)::int` })
				.from(needPledges)
				.groupBy(needPledges.needId),
			viewerId
				? this.db
						.select({ organizationId: organizationFollows.organizationId })
						.from(organizationFollows)
						.where(eq(organizationFollows.userId, viewerId))
				: [],
		]);
		const categoryByOrg = Map.groupBy(
			categoryRows,
			(row) => row.organizationId,
		);
		const commentsByTarget = countBy(
			commentRows.map((row) => `${row.tag}:${row.postId}`),
		);
		const applicationCounts = new Map(
			applications.map((row) => [row.id, row.count]),
		);
		const pledgeCounts = new Map(pledges.map((row) => [row.id, row.count]));
		const followsSet = new Set(follows.map((row) => row.organizationId));
		for (const candidate of candidates) {
			candidate.categoryIds = (
				categoryByOrg.get(candidate.organizationId ?? "") ?? []
			).map((row) => row.categoryId);
			candidate.engagement.comments =
				commentsByTarget.get(`${candidate.type}:${candidate.id}`) ?? 0;
			candidate.engagement.applications =
				candidate.type === "EVENT"
					? (applicationCounts.get(candidate.id) ?? 0)
					: 0;
			candidate.engagement.pledges =
				candidate.type === "NEED" ? (pledgeCounts.get(candidate.id) ?? 0) : 0;
			for (const interaction of interactionRows)
				if (
					interaction.tag === candidate.type &&
					interaction.postId === candidate.id
				) {
					if (interaction.interactionType === "LIKE")
						candidate.engagement.likes++;
					if (interaction.interactionType === "SAVE")
						candidate.engagement.saves++;
					if (interaction.interactionType === "SHARE")
						candidate.engagement.shares++;
				}
			if (viewerId)
				candidate.viewer = {
					followsOrganization:
						!!candidate.organizationId &&
						followsSet.has(candidate.organizationId),
					liked: interactionRows.some(
						(item) =>
							item.userId === viewerId &&
							item.tag === candidate.type &&
							item.postId === candidate.id &&
							item.interactionType === "LIKE",
					),
					saved: interactionRows.some(
						(item) =>
							item.userId === viewerId &&
							item.tag === candidate.type &&
							item.postId === candidate.id &&
							item.interactionType === "SAVE",
					),
				};
		}
	}

	private async viewerContext(userId?: string) {
		if (!userId)
			return {
				city: null,
				state: null,
				latitude: null,
				longitude: null,
				categoryIds: new Set<string>(),
				following: new Set<string>(),
				seen: new Set<string>(),
			};
		const [viewer, interests, following, impressions] = await Promise.all([
			this.db.query.users.findFirst({ where: eq(users.id, userId) }),
			this.db
				.select({ categoryId: userCategories.categoryId })
				.from(userCategories)
				.where(eq(userCategories.userId, userId)),
			this.db
				.select({ organizationId: organizationFollows.organizationId })
				.from(organizationFollows)
				.where(eq(organizationFollows.userId, userId)),
			this.db
				.select({
					tag: postInteractions.tag,
					postId: postInteractions.postId,
				})
				.from(postInteractions)
				.where(
					and(
						eq(postInteractions.userId, userId),
						eq(postInteractions.interactionType, "IMPRESSION"),
						gte(
							postInteractions.createdAt,
							new Date(Date.now() - 7 * 86_400_000),
						),
					),
				),
		]);
		return {
			city: viewer?.city?.toLowerCase() ?? null,
			state: viewer?.state?.toLowerCase() ?? null,
			latitude: numberOrNull(viewer?.latitude),
			longitude: numberOrNull(viewer?.longitude),
			categoryIds: new Set(interests.map((row) => row.categoryId)),
			following: new Set(following.map((row) => row.organizationId)),
			seen: new Set(impressions.map((row) => `${row.tag}:${row.postId}`)),
		};
	}

	private forYouScore(
		candidate: Candidate,
		context: Awaited<ReturnType<FeedRankingService["viewerContext"]>>,
	) {
		let score = this.baseScore(candidate, context);
		if (context.seen.has(`${candidate.type}:${candidate.id}`)) score -= 35;
		return score;
	}

	private trendingScore(
		candidate: Candidate,
		context: Awaited<ReturnType<FeedRankingService["viewerContext"]>>,
	) {
		const ageHours = Math.max(
			1,
			(Date.now() - candidate.createdAt.getTime()) / 3_600_000,
		);
		const engagement =
			candidate.engagement.likes +
			candidate.engagement.saves * 2 +
			candidate.engagement.shares * 3 +
			candidate.engagement.comments * 3 +
			candidate.engagement.applications * 5 +
			candidate.engagement.pledges * 5;
		return (
			(engagement * 10) / (ageHours + 2) ** 0.7 +
			this.locationScore(candidate, context) * 0.2
		);
	}

	private baseScore(
		candidate: Candidate,
		context: Awaited<ReturnType<FeedRankingService["viewerContext"]>>,
	) {
		const ageHours = Math.max(
			0,
			(Date.now() - candidate.createdAt.getTime()) / 3_600_000,
		);
		const categoryMatches = candidate.categoryIds.filter((id) =>
			context.categoryIds.has(id),
		).length;
		const engagement =
			candidate.engagement.likes +
			candidate.engagement.saves * 2 +
			candidate.engagement.shares * 3 +
			candidate.engagement.comments * 2 +
			candidate.engagement.applications * 5 +
			candidate.engagement.pledges * 5;
		return (
			this.locationScore(candidate, context) +
			categoryMatches * 15 +
			(candidate.organizationId &&
			context.following.has(candidate.organizationId)
				? 12
				: 0) +
			Math.max(0, 24 - ageHours / 6) +
			Math.min(30, engagement * 2) +
			(candidate.urgency === "HIGH"
				? 16
				: candidate.urgency === "MEDIUM"
					? 6
					: 0)
		);
	}

	private locationScore(
		candidate: Candidate,
		context: {
			city: string | null;
			state: string | null;
			latitude: number | null;
			longitude: number | null;
		},
	) {
		if (
			context.latitude !== null &&
			context.longitude !== null &&
			candidate.latitude !== null &&
			candidate.longitude !== null
		) {
			const distance = haversineKm(
				context.latitude,
				context.longitude,
				candidate.latitude,
				candidate.longitude,
			);
			if (distance <= 25) return 45;
			if (distance <= 100) return 35;
			if (distance <= 300) return 20;
		}
		if (context.city && candidate.city?.toLowerCase() === context.city)
			return 40;
		if (context.state && candidate.state?.toLowerCase() === context.state)
			return 22;
		return 0;
	}

	private diversify(candidates: Candidate[]) {
		const selected: Candidate[] = [];
		const remaining = [...candidates];
		while (remaining.length) {
			const previous = selected.at(-1);
			const previousTwo = selected.slice(-2);
			const index = remaining.findIndex(
				(candidate) =>
					!(
						previousTwo.length === 2 &&
						candidate.organizationId &&
						previousTwo.every(
							(item) => item.organizationId === candidate.organizationId,
						)
					) &&
					!(
						previous &&
						previous.type === candidate.type &&
						selected.slice(-3).every((item) => item.type === candidate.type)
					),
			);
			selected.push(...remaining.splice(index === -1 ? 0 : index, 1));
		}
		return selected;
	}

	private page(
		items: Candidate[],
		total: number,
		query: { page: number; limit: number },
		_viewerId?: string,
	) {
		const { limit, offset } = toOffset(query);
		const page = items
			.slice(offset, offset + limit)
			.map(({ score: _score, ...item }) => item);
		return paginate(page, total, query);
	}
}

const URGENT_WINDOW_MS = 3 * 86_400_000;

/**
 * Cuts the candidate pool to what the caller asked for, before scoring and
 * before pagination, so `total` reflects the filtered pool and page N is
 * stable. Substring matching is case-insensitive; `city` falls back to the
 * NGO's city because posts and announcements rarely carry their own.
 */
function applyFilters(candidates: Candidate[], query: FeedFilterQuery) {
	const search = query.search?.toLowerCase();
	const city = query.city?.toLowerCase();
	const now = Date.now();
	return candidates.filter((candidate) => {
		if (query.kind) {
			// Urgent posts are still posts to a reader asking for posts.
			const type = candidate.type === "URGENT" ? "POST" : candidate.type;
			if (type !== query.kind && candidate.type !== query.kind) return false;
		}
		if (query.categoryId && !candidate.categoryIds.includes(query.categoryId))
			return false;
		if (city && !(candidate.city ?? "").toLowerCase().includes(city))
			return false;
		if (query.urgent && !isUrgent(candidate, now)) return false;
		if (search) {
			const haystack = [
				candidate.content.title,
				candidate.content.text,
				candidate.content.description,
				candidate.content.body,
				candidate.organization?.name,
			]
				.filter((value): value is string => typeof value === "string")
				.join(" ")
				.toLowerCase();
			if (!haystack.includes(search)) return false;
		}
		return true;
	});
}

/** HIGH-urgency needs, urgent posts, and events that start within three days. */
function isUrgent(candidate: Candidate, now: number) {
	if (candidate.type === "URGENT") return true;
	if (candidate.type === "NEED") return candidate.urgency === "HIGH";
	if (candidate.type === "EVENT") {
		const startAt = candidate.content.startAt;
		const start =
			startAt instanceof Date
				? startAt.getTime()
				: typeof startAt === "string"
					? Date.parse(startAt)
					: Number.NaN;
		return (
			Number.isFinite(start) && start >= now && start - now <= URGENT_WINDOW_MS
		);
	}
	return false;
}

function emptyEngagement() {
	return {
		likes: 0,
		saves: 0,
		shares: 0,
		comments: 0,
		applications: 0,
		pledges: 0,
	};
}
function orgSummary(org: typeof organizations.$inferSelect) {
	return { id: org.id, name: org.organizationName, logo: org.logo };
}
function userSummary(user: typeof users.$inferSelect) {
	return {
		id: user.id,
		fullName: user.fullName,
		profileImage: user.profileImage,
	};
}
function numberOrNull(value: unknown) {
	return value === null || value === undefined ? null : Number(value);
}
function countBy(values: string[]) {
	const result = new Map<string, number>();
	for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
	return result;
}
function byScore(a: Candidate, b: Candidate) {
	return (b.score ?? 0) - (a.score ?? 0);
}
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
	const radians = Math.PI / 180;
	const a =
		Math.sin(((lat2 - lat1) * radians) / 2) ** 2 +
		Math.cos(lat1 * radians) *
			Math.cos(lat2 * radians) *
			Math.sin(((lon2 - lon1) * radians) / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
