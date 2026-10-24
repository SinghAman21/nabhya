import type { SearchScope } from "@nabhya/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys, searchApi } from "@/lib/api";

/**
 * One search request. `limit` is the page size - the desktop floating panel
 * asks for a handful, the results page for a full page.
 *
 * `keepPreviousData` holds the last results up while the next keystroke's
 * request is in flight, so the list does not blank to a spinner between
 * "blan" and "blank".
 */
export function useSearch(
	search: string,
	scope: SearchScope,
	enabled = true,
	limit?: number,
) {
	return useQuery({
		queryKey: queryKeys.search({ search, scope, limit }),
		queryFn: () =>
			searchApi.search({ search, scope, ...(limit ? { limit } : {}) }),
		enabled: enabled && search.trim().length > 0,
		placeholderData: keepPreviousData,
	});
}
