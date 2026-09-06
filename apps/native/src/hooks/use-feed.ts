import type {
	FeedCommentsQuery,
	FeedFilterQuery,
	FeedTab,
	NeedType,
	NeedUrgency,
} from "@nabhya/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { feedApi, queryKeys, queryScopes } from "@/lib/api";
import { KIND_TO_TYPE } from "@/lib/feed-adapter";
import type { FeedItem, FeedKind } from "@/lib/types";

const PAGE_SIZE = 12;

export interface FeedFilters {
	/** Which lens. Defaults to For You. */
	tab?: FeedTab;
	/** Client kind; mapped to the server's item type. */
	kind?: FeedKind;
	categoryId?: string;
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
		...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
		...(filters.city ? { city: filters.city } : {}),
		...(filters.search ? { search: filters.search } : {}),
		...(filters.needType ? { needType: filters.needType } : {}),
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
