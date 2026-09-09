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

/**
 * Like or save a feed row. `on` is the state the user wants, not the current
 * one, so the card passes `!liked`. Invalidates every feed query so counts and
 * the filled icon update on the next page render.
 */
export function useFeedReaction(action: "like" | "save") {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ item, on }: { item: FeedItem; on: boolean }) =>
			feedApi.react(KIND_TO_TYPE[item.kind], item.id, action, on),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

export function useRecordFeedInteraction(action: "share" | "impression") {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ item }: { item: FeedItem }) =>
			feedApi.interact(KIND_TO_TYPE[item.kind], item.id, action),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
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
