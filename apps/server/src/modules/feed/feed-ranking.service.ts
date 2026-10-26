import type { db as dbType } from "@nabhya/db";
import {
	announcements,
	eventApplications,
	events,
	follows,
	needPledges,
	needs,
	organizationCategories,
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
	SavedFeedQuery,
	TrendingFeedQuery,
} from "@nabhya/shared";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { DB_TOKEN } from "../../common/database";
import { STORAGE_TOKEN, type StorageProvider } from "../../common/storage";
import type { AuthUser } from "../../common/types";
import { paginate, toOffset } from "../../common/utils";

type Candidate = {
	id: string;
	type: PostTag;
	isUrgent: boolean;
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
/** How long the viewer-independent candidate pool is reused. */
const POOL_TTL_MS = 15_000;

@Injectable()
export class FeedRankingService {
	constructor(
		@Inject(DB_TOKEN) private readonly db: typeof dbType,
		@Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
	) {}

	async forYou(user: AuthUser | undefined, query: ForYouFeedQuery) {
		const candidates = applyFilters(await this.candidates(user), query);
		const context = await this.viewerContext(user?.id, candidates);
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
		const context = await this.viewerContext(user?.id, candidates);
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
					.select({ id: follows.organizationId })
					.from(follows)
					.where(eq(follows.userId, user.id))
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

	/**
	 * Feed items the caller has saved - the reaction-bar bookmark, not the
	 * NGO-level `bookmarks` table behind `/engagement/bookmarks`. Same
	 * candidate pool as every other lens (so a saved item that has since gone
	 * unpublished or dropped off the source window quietly stops appearing,
	 * same as `following`), filtered down to `viewer.saved` - already computed
	 * by `hydrate()` - and ordered newest-first by the item's own `createdAt`,
	 * same as `following`.
	 */
	async saved(user: AuthUser, query: SavedFeedQuery) {
		const candidates = applyFilters(await this.candidates(user), query);
		const selected = candidates
			.filter((candidate) => candidate.viewer?.saved)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return this.page(selected, selected.length, query, user.id);
	}

	/**
	 * The candidate pool before any viewer is applied, cached for
	 * POOL_TTL_MS. Building it is four queries returning up to 4 x
	 * SOURCE_LIMIT joined rows plus their media, from a database across the
	 * internet - most of a feed request's time - and it is identical for every
	 * caller within seconds. Engagement counts and the viewer's own state are
	 * still computed per request by `hydrate()`, on a clone, so likes, saves
	 * and follows are never stale. Concurrent misses share one load.
	 */
	private pool: { at: number; items: Candidate[] } | null = null;
	private poolLoading: Promise<Candidate[]> | null = null;

	/** Drops the cached pool - after a write that adds or removes a candidate. */
	invalidatePool() {
		this.pool = null;
	}

	private async candidates(user: AuthUser | undefined): Promise<Candidate[]> {
		if (!this.pool || Date.now() - this.pool.at > POOL_TTL_MS) {
			this.poolLoading ??= this.loadPool().finally(() => {
				this.poolLoading = null;
			});
			const items = await this.poolLoading;
			this.pool = { at: Date.now(), items };
		}
		// Callers score and hydrate in place; never let that reach the cache.
		const result = structuredClone(this.pool.items);
		await this.hydrate(result, user?.id);
		return result;
	}

	private async loadPool(): Promise<Candidate[]> {
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
					type: post.type,
					isUrgent: post.isUrgent,
					organizationId: post.organizationId,
					organization: org ? await orgSummary(org, this.storage) : null,
					author: userSummary(author),
					createdAt: post.createdAt,
					city: post.city ?? org?.city ?? null,
					state: post.state ?? org?.state ?? null,
					latitude: numberOrNull(post.latitude ?? org?.latitude),
					longitude: numberOrNull(post.longitude ?? org?.longitude),
					urgency: post.isUrgent ? ("HIGH" as const) : null,
					categoryIds: [],
					engagement: emptyEngagement(),
					viewer: null,
					content: {
						text: post.text,
						media: await Promise.all(
							(mediaByPost.get(post.id) ?? []).map(async (item) => ({
								id: item.id,
								type: item.mediaType,
								// A storage key until `page()` signs it - see `signItem`.
								url: item.objectKey,
								sortOrder: item.sortOrder,
							})),
						),
					},
				})),
			)),
			...(await Promise.all(
				eventRows.map(async ({ event, org, author }) => ({
					id: event.id,
					type: "EVENT" as const,
					isUrgent: event.isUrgent,
					organizationId: event.organizationId,
					organization: await orgSummary(org, this.storage),
					author: author ? userSummary(author) : null,
					createdAt: event.createdAt,
					city: event.city ?? org.city,
					state: event.state ?? org.state,
					latitude: numberOrNull(event.latitude ?? org.latitude),
					longitude: numberOrNull(event.longitude ?? org.longitude),
					urgency: event.isUrgent ? ("HIGH" as const) : null,
					categoryIds: [],
					engagement: emptyEngagement(),
					viewer: null,
					content: {
						title: event.title,
						description: event.description,
						coverImage: event.coverImage ? event.coverImage : null,
						venue: event.venue,
						startAt: event.startAt,
						endAt: event.endAt,
						volunteersNeeded: event.volunteersNeeded,
						acceptedCount: event.acceptedCount,
					},
				})),
			)),
			...(await Promise.all(
				needRows.map(async ({ need, org, author }) => ({
					id: need.id,
					type: "NEED" as const,
					isUrgent: need.urgency === "HIGH",
					organizationId: need.organizationId,
					organization: await orgSummary(org, this.storage),
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
						coverImage: need.coverImage ? need.coverImage : null,
						quantity: need.quantity,
						unit: need.unit,
						fulfilledQuantity: need.fulfilledQuantity,
						expiresAt: need.expiresAt,
					},
				})),
			)),
			...(await Promise.all(
				announcementRows.map(async ({ announcement, org, author }) => ({
					id: announcement.id,
					type: "ANNOUNCEMENT" as const,
					isUrgent: announcement.isUrgent,
					organizationId: announcement.organizationId,
					organization: await orgSummary(org, this.storage),
					author: author ? userSummary(author) : null,
					createdAt: announcement.publishedAt ?? announcement.createdAt,
					city: org.city,
					state: org.state,
					latitude: numberOrNull(org.latitude),
					longitude: numberOrNull(org.longitude),
					urgency: announcement.isUrgent ? ("HIGH" as const) : null,
					categoryIds: [],
					engagement: emptyEngagement(),
					viewer: null,
					content: {
						title: announcement.title,
						body: announcement.body,
						coverImage: announcement.coverImageKey
							? announcement.coverImageKey
							: null,
						isPinned: announcement.isPinned,
					},
				})),
			)),
		];
		return result;
	}

	private async hydrate(candidates: Candidate[], viewerId?: string) {
		const idsByType = new Map<PostTag, string[]>();
		for (const candidate of candidates) {
			const ids = idsByType.get(candidate.type) ?? [];
			ids.push(candidate.id);
			idsByType.set(candidate.type, ids);
		}
		const targets = [...idsByType].map(([type, ids]) =>
			and(
				eq(postInteractions.targetType, type),
				inArray(postInteractions.postId, ids),
			),
		);
		const commentTargets = [...idsByType].map(([type, ids]) =>
			and(eq(postComments.targetType, type), inArray(postComments.postId, ids)),
		);
		const eventIds = idsByType.get("EVENT") ?? [];
		const needIds = idsByType.get("NEED") ?? [];
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
			followingRows,
			viewerRows,
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
			// All-time, not windowed: this is the source for the displayed like/save
			// count and for `viewer.liked`/`viewer.saved` below, not just a scoring
			// signal. A 14-day recency cutoff used to live here, which meant a like
			// older than that silently dropped out of the count and the heart
			// stopped showing filled for the user who made it - while the unique
			// index still blocked them from liking it again, so the client had no
			// way to recover. The impression window in `viewerContext` below is a
			// separate, intentionally recent-only signal - don't conflate the two.
			// Counted by Postgres, not shipped to Node: this used to select every
			// interaction row (impressions included - tens of thousands) and then
			// scan them once per candidate, three times over.
			targets.length
				? this.db
						.select({
							targetType: postInteractions.targetType,
							postId: postInteractions.postId,
							interactionType: postInteractions.interactionType,
							count: sql<number>`count(*)::int`,
						})
						.from(postInteractions)
						.where(
							and(
								inArray(postInteractions.interactionType, [
									"LIKE",
									"SAVE",
									"SHARE",
								]),
								or(...targets),
							),
						)
						.groupBy(
							postInteractions.targetType,
							postInteractions.postId,
							postInteractions.interactionType,
						)
				: [],
			commentTargets.length
				? this.db
						.select({
							targetType: postComments.targetType,
							postId: postComments.postId,
							count: sql<number>`count(*)::int`,
						})
						.from(postComments)
						.where(or(...commentTargets))
						.groupBy(postComments.targetType, postComments.postId)
				: [],
			eventIds.length
				? this.db
						.select({
							id: eventApplications.eventId,
							count: sql<number>`count(*)::int`,
						})
						.from(eventApplications)
						.where(inArray(eventApplications.eventId, eventIds))
						.groupBy(eventApplications.eventId)
				: [],
			needIds.length
				? this.db
						.select({
							id: needPledges.needId,
							count: sql<number>`count(*)::int`,
						})
						.from(needPledges)
						.where(inArray(needPledges.needId, needIds))
						.groupBy(needPledges.needId)
				: [],
			viewerId && organizationIds.length
				? this.db
						.select({ organizationId: follows.organizationId })
						.from(follows)
						.where(
							and(
								eq(follows.userId, viewerId),
								inArray(follows.organizationId, organizationIds),
							),
						)
				: [],
			// Only the viewer's own likes and saves, for the filled heart/bookmark.
			viewerId && targets.length
				? this.db
						.select({
							targetType: postInteractions.targetType,
							postId: postInteractions.postId,
							interactionType: postInteractions.interactionType,
						})
						.from(postInteractions)
						.where(
							and(
								eq(postInteractions.userId, viewerId),
								inArray(postInteractions.interactionType, ["LIKE", "SAVE"]),
								or(...targets),
							),
						)
				: [],
		]);
		const categoryByOrg = Map.groupBy(
			categoryRows,
			(row) => row.organizationId,
		);
		const commentsByTarget = new Map(
			commentRows.map((row) => [`${row.targetType}:${row.postId}`, row.count]),
		);
		const interactionCounts = new Map(
			interactionRows.map((row) => [
				`${row.targetType}:${row.postId}:${row.interactionType}`,
				row.count,
			]),
		);
		const mine = new Set(
			viewerRows.map(
				(row) => `${row.targetType}:${row.postId}:${row.interactionType}`,
			),
		);
		const applicationCounts = new Map(
			applications.map((row) => [row.id, row.count]),
		);
		const pledgeCounts = new Map(pledges.map((row) => [row.id, row.count]));
		const followsSet = new Set(followingRows.map((row) => row.organizationId));
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
			const key = `${candidate.type}:${candidate.id}`;
			candidate.engagement.likes = interactionCounts.get(`${key}:LIKE`) ?? 0;
			candidate.engagement.saves = interactionCounts.get(`${key}:SAVE`) ?? 0;
			candidate.engagement.shares = interactionCounts.get(`${key}:SHARE`) ?? 0;
			if (viewerId)
				candidate.viewer = {
					followsOrganization:
						!!candidate.organizationId &&
						followsSet.has(candidate.organizationId),
					liked: mine.has(`${key}:LIKE`),
					saved: mine.has(`${key}:SAVE`),
				};
		}
	}

	private async viewerContext(
		userId: string | undefined,
		candidates: Candidate[],
	) {
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
		const idsByType = new Map<PostTag, string[]>();
		for (const candidate of candidates) {
			const ids = idsByType.get(candidate.type) ?? [];
			ids.push(candidate.id);
			idsByType.set(candidate.type, ids);
		}
		const impressionTargets = [...idsByType].map(([type, ids]) =>
			and(
				eq(postInteractions.targetType, type),
				inArray(postInteractions.postId, ids),
			),
		);
		const [viewer, interests, impressions] = await Promise.all([
			this.db.query.users.findFirst({ where: eq(users.id, userId) }),
			this.db
				.select({ categoryId: userCategories.categoryId })
				.from(userCategories)
				.where(eq(userCategories.userId, userId)),
			impressionTargets.length
				? this.db
						.select({
							targetType: postInteractions.targetType,
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
								or(...impressionTargets),
							),
						)
				: [],
		]);
		return {
			city: viewer?.city?.toLowerCase() ?? null,
			state: viewer?.state?.toLowerCase() ?? null,
			latitude: numberOrNull(viewer?.latitude),
			longitude: numberOrNull(viewer?.longitude),
			categoryIds: new Set(interests.map((row) => row.categoryId)),
			following: new Set(
				candidates.flatMap((candidate) =>
					candidate.organizationId && candidate.viewer?.followsOrganization
						? [candidate.organizationId]
						: [],
				),
			),
			seen: new Set(
				impressions.map((row) => `${row.targetType}:${row.postId}`),
			),
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

	/**
	 * Slices the ranked list and signs the images of *that page only*.
	 *
	 * Candidates carry storage keys, not URLs. They used to be signed while the
	 * pool was built - every logo, cover and photo of up to 4 x SOURCE_LIMIT
	 * rows, one Supabase round trip each - and then ranking kept ten of them:
	 * the feed took 2.5-3.5s per request, nearly all of it signing images
	 * nobody would see. Signing after the slice is ~10 items' worth.
	 */
	private async page(
		items: Candidate[],
		total: number,
		query: { page: number; limit: number },
		_viewerId?: string,
	) {
		const { limit, offset } = toOffset(query);
		const page = await Promise.all(
			items
				.slice(offset, offset + limit)
				.map(({ score: _score, ...item }) => this.signItem(item)),
		);
		return paginate(page, total, query);
	}

	/** Swaps the keys in one feed item for signed URLs. */
	private async signItem<T extends Omit<Candidate, "score">>(
		item: T,
	): Promise<T> {
		// A missing or unsignable image degrades to no image, never a 500 for
		// the whole page.
		const sign = async (key: unknown): Promise<string | null> => {
			if (typeof key !== "string" || !key) return null;
			try {
				return await this.storage.createDownloadUrl(key);
			} catch {
				return null;
			}
		};
		const content = { ...item.content };
		const [coverImage, logo, media] = await Promise.all([
			"coverImage" in content
				? sign(content.coverImage)
				: Promise.resolve(undefined),
			item.organization
				? sign(item.organization.logo)
				: Promise.resolve(undefined),
			Array.isArray(content.media)
				? Promise.all(
						(content.media as Array<{ url: unknown }>).map(async (entry) => ({
							...entry,
							url: await sign(entry.url),
						})),
					)
				: Promise.resolve(undefined),
		]);
		if ("coverImage" in content) content.coverImage = coverImage ?? null;
		if (media) content.media = media;
		return {
			...item,
			organization: item.organization
				? { ...item.organization, logo: logo ?? null }
				: null,
			content,
		};
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
		if (query.kind && candidate.type !== query.kind) return false;
		if (
			query.categoryIds &&
			!query.categoryIds.some((categoryId) =>
				candidate.categoryIds.includes(categoryId),
			)
		)
			return false;
		if (city && !(candidate.city ?? "").toLowerCase().includes(city))
			return false;
		if (query.urgent && !isUrgent(candidate, now)) return false;
		if (
			query.needType &&
			(candidate.type !== "NEED" || candidate.content.type !== query.needType)
		)
			return false;
		if (
			query.needUrgency &&
			(candidate.type !== "NEED" || candidate.urgency !== query.needUrgency)
		)
			return false;
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
	if (candidate.isUrgent) return true;
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
async function orgSummary(
	org: typeof organizations.$inferSelect,
	_storage: StorageProvider,
) {
	return {
		id: org.id,
		name: org.organizationName,
		// A storage key until `page()` signs it.
		logo: org.logo ?? null,
	};
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
