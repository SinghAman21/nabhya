import type { SearchScope } from "@nabhya/shared";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, searchApi } from "@/lib/api";

export function useSearch(search: string, scope: SearchScope, enabled = true) {
	return useQuery({
		queryKey: queryKeys.search({ search, scope }),
		queryFn: () => searchApi.search({ search, scope }),
		enabled: enabled && search.trim().length > 0,
	});
}
