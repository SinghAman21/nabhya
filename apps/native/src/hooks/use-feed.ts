import type { FeedQuery } from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { feedApi, queryKeys } from "@/lib/api";

const PAGE_SIZE = 12;

export type FeedFilters = Partial<Omit<FeedQuery, "page" | "limit">>;

/**
 * The home feed, page by page. The server owns the union, the ranking and the
 * offset, so this only has to ask for the next page while `hasMore` holds.
 */
export function useFeed(filters: FeedFilters) {
	return useInfiniteQuery({
		queryKey: queryKeys.feed(filters),
		queryFn: ({ pageParam }) =>
			feedApi.list({ ...filters, page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}
