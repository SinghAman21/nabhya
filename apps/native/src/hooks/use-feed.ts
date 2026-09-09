import type {
	FeedCommentsQuery,
	FeedFilterQuery,
	FeedTab,
	NeedType,
	NeedUrgency,
	PostTag,
} from "@nabhya/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { feedApi, queryKeys, queryScopes } from "@/lib/api";
import { KIND_TO_TYPE } from "@/lib/feed-adapter";
import { type ComposerMedia, uploadFeedMedia } from "@/lib/feed-media";
import type { FeedItem, FeedKind } from "@/lib/types";

const PAGE_SIZE = 12;

export interface FeedFilters {
	/** Which lens. Defaults to For You. */
	tab?: FeedTab;
	/** Client kind; mapped to the server's item type. */
	kind?: FeedKind;
	categoryIds?: string[];
	city?: string;
	search?: string;
	needType?: NeedType;
	needUrgency?: NeedUrgency;
}

/**
 * The home feed, page by page.
 *
 * Three of the four lenses are their own endpoints on the server; Urgent is
 * For You with the `urgent` filter on. The server owns the pool, the ranking
 * and the offset, so this only has to pick the endpoint and ask for the next
 * page while `hasMore` holds.
 */
export function useFeed(filters: FeedFilters, enabled = true) {
	const tab = filters.tab ?? "for_you";
	const query: Partial<FeedFilterQuery> = {
		...(filters.kind ? { kind: KIND_TO_TYPE[filters.kind] } : {}),
		...(filters.categoryIds?.length
			? { categoryIds: filters.categoryIds }
			: {}),
		...(filters.city ? { city: filters.city } : {}),
		...(filters.search ? { search: filters.search } : {}),
		...(filters.needType
			? { kind: "NEED" as const, needType: filters.needType }
			: {}),
		...(filters.needUrgency ? { needUrgency: filters.needUrgency } : {}),
		...(tab === "urgent" ? { urgent: true } : {}),
	};
	const fetchPage =
		tab === "following"
			? feedApi.following
			: tab === "trending"
				? feedApi.trending
				: feedApi.forYou;

	return useInfiniteQuery({
		queryKey: queryKeys.feed({ tab, ...query }),
		queryFn: ({ pageParam }) =>
			fetchPage({ ...query, page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
		enabled,
	});
}

/**
 * Feed items the caller has saved (the reaction-bar bookmark on a card, not
 * the NGO-level bookmark behind `useToggleBookmark` / `/bookmarks`). One
 * endpoint, so — unlike `useFeed` — there is no lens to pick; it still takes
 * the shared filters so a future "Saved → Needs only" chip has somewhere to
 * plug in. Included in the same `queryKeys.feed` family as the other lenses,
 * so liking/saving/unsaving anywhere (`useFeedReaction`'s
 * `queryScopes.feed` invalidation) refreshes this list too.
 */
export function useSavedFeed(filters: Omit<FeedFilters, "tab"> = {}) {
	const query: Partial<FeedFilterQuery> = {
		...(filters.kind ? { kind: KIND_TO_TYPE[filters.kind] } : {}),
		...(filters.categoryIds?.length
			? { categoryIds: filters.categoryIds }
			: {}),
		...(filters.city ? { city: filters.city } : {}),
		...(filters.search ? { search: filters.search } : {}),
		...(filters.needType
			? { kind: "NEED" as const, needType: filters.needType }
			: {}),
		...(filters.needUrgency ? { needUrgency: filters.needUrgency } : {}),
	};
	return useInfiniteQuery({
		queryKey: queryKeys.feed({ tab: "saved", ...query }),
		queryFn: ({ pageParam }) =>
			feedApi.saved({ ...query, page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

/**
 * Publish a post: upload the attachments, then create the row.
 *
 * The two steps are one mutation because they are one user action and they
 * fail as one — a post created without its media would be a silent
 * half-success, and media uploaded without a post is orphaned bytes. The
 * media list is threaded through so the composer's tiles can show real
 * per-file progress; `onMediaChange` is called from inside the upload loop.
 *
 * Both `POST /api/feed` and the upload-intent route require a **verified**
 * organisation server-side, so the composer gates itself on verification
 * rather than letting this fail at the end of four uploads.
 */
export function useCreateFeedPost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			text,
			type,
			isUrgent,
			media,
			onMediaChange,
			uploaded,
		}: {
			text: string;
			type: PostTag;
			isUrgent: boolean;
			media: ComposerMedia[];
			onMediaChange: (id: string, patch: Partial<ComposerMedia>) => void;
			uploaded?: { mediaFolder: string; mediaKeys: string[] } | null;
		}) => {
			const uploadedMedia =
				uploaded !== undefined
					? uploaded
					: media.length > 0
						? await uploadFeedMedia(media, onMediaChange)
						: null;

			return feedApi.create({
				text,
				type,
				isUrgent,
				mediaKeys: uploadedMedia?.mediaKeys ?? [],
				// The schema refuses media keys without their folder, so this pair
				// is set together or not at all.
				...(uploadedMedia ? { mediaFolder: uploadedMedia.mediaFolder } : {}),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

/**
 * Delete a post. The server allows it for the post's own author (or a
 * superadmin) and removes the stored media with it, which is why an NGO
 * needs this reachable from the feed: it is the only way to take back
 * something already published.
 */
export function useDeleteFeedPost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => feedApi.remove(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

/** One page as the feed cache holds it: rows already mapped to `FeedItem`. */
interface CachedFeedPage {
	items: FeedItem[];
	meta: { page: number; hasMore: boolean };
}
interface CachedFeed {
	pages: CachedFeedPage[];
	pageParams: unknown[];
}
type FeedSnapshot = [readonly unknown[], CachedFeed | undefined];

/**
 * Rewrites one row everywhere it is cached, and hands back what was there.
 *
 * A row is in as many caches as there are lenses and filter combinations the
 * reader has visited — liking something in For You has to move the same row in
 * Trending, or switching tabs undoes the tap on screen. `queryScopes.feed` is
 * `["feed"]`, which also matches the comment queries (`["feed","comments",…]`),
 * so the page shape is checked rather than assumed.
 */
function patchFeedRow(
	queryClient: ReturnType<typeof useQueryClient>,
	item: FeedItem,
	patch: (row: FeedItem) => FeedItem,
): FeedSnapshot[] {
	const entries = queryClient.getQueriesData<CachedFeed>({
		queryKey: queryScopes.feed,
	});
	const snapshots: FeedSnapshot[] = [];

	for (const [key, data] of entries) {
		if (!data || !Array.isArray(data.pages)) continue;
		snapshots.push([key, data]);
		queryClient.setQueryData<CachedFeed>(key, {
			...data,
			pages: data.pages.map((page) =>
				Array.isArray(page?.items)
					? {
							...page,
							items: page.items.map((row) =>
								row.id === item.id && row.kind === item.kind ? patch(row) : row,
							),
						}
					: page,
			),
		});
	}
	return snapshots;
}

function restoreFeed(
	queryClient: ReturnType<typeof useQueryClient>,
	snapshots: FeedSnapshot[] | undefined,
) {
	for (const [key, data] of snapshots ?? [])
		queryClient.setQueryData(key, data);
}

/** Applies a like or a save to a row, counter included. Idempotent. */
function withReaction(
	item: FeedItem,
	action: "like" | "save",
	on: boolean,
): FeedItem {
	const viewer = {
		liked: item.viewer?.liked ?? false,
		saved: item.viewer?.saved ?? false,
	};
	if (action === "like") {
		if (viewer.liked === on) return item;
		return {
			...item,
			viewer: { ...viewer, liked: on },
			engagement: {
				...item.engagement,
				likes: Math.max(0, item.engagement.likes + (on ? 1 : -1)),
			},
		};
	}
	if (viewer.saved === on) return item;
	return {
		...item,
		viewer: { ...viewer, saved: on },
		engagement: {
			...item.engagement,
			saves: Math.max(0, item.engagement.saves + (on ? 1 : -1)),
		},
	};
}

/**
 * Like or save a feed row. `on` is the state the user wants, not the current
 * one, so the card passes `!liked`.
 *
 * Applied optimistically and **not** invalidated afterwards, which is a
 * deliberate reversal of what this did before. Invalidating `["feed"]` on
 * every tap refetched every page of every lens and re-ran the ranker — so a
 * like could reorder the list, or drop the row the thumb was still on, and the
 * filled heart only appeared once the network came back. The server returns
 * the same two booleans this function computes, so there is nothing to
 * reconcile; a failure rolls the row back and surfaces itself through the
 * caller's `onError`.
 */
export function useFeedReaction(action: "like" | "save") {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ item, on }: { item: FeedItem; on: boolean }) =>
			feedApi.react(KIND_TO_TYPE[item.kind], item.id, action, on),
		onMutate: async ({ item, on }) => {
			// In flight pages would otherwise land after the patch and overwrite it.
			await queryClient.cancelQueries({ queryKey: queryScopes.feed });
			return {
				snapshots: patchFeedRow(queryClient, item, (row) =>
					withReaction(row, action, on),
				),
			};
		},
		onError: (_error, _variables, context) =>
			restoreFeed(queryClient, context?.snapshots),
	});
}

/**
 * Record a share or an impression. Neither shows up anywhere in the UI (no
 * screen renders a share count, and an impression is invisible by
 * definition), so unlike `useFeedReaction` this must not invalidate the feed
 * scope — impressions fire once per card per scroll (`onViewableItemsChanged`
 * dedupes per session, not per request), and invalidating an active
 * `useInfiniteQuery` refetches every page already loaded. That refetch storm
 * is what was blowing through the default rate-limit bucket on `/feed/*`
 * while scrolling.
 */
export function useRecordFeedInteraction(action: "share" | "impression") {
	return useMutation({
		mutationFn: ({ item }: { item: FeedItem }) =>
			feedApi.interact(KIND_TO_TYPE[item.kind], item.id, action),
	});
}

export function useFeedComments(
	item: FeedItem | null,
	query: Partial<FeedCommentsQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.feedComments(item?.id ?? "", query),
		queryFn: () =>
			feedApi.listComments(
				KIND_TO_TYPE[item?.kind as FeedItem["kind"]],
				item?.id as string,
				query,
			),
		enabled: !!item,
	});
}

export function useCreateFeedComment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ item, body }: { item: FeedItem; body: string }) =>
			feedApi.createComment(KIND_TO_TYPE[item.kind], item.id, { body }),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["feed", "comments", variables.item.id],
			});
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

export function useDeleteFeedComment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => feedApi.deleteComment(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["feed", "comments"] });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}
