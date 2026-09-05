import type {
	AdminOrgQuery,
	AdminUserQuery,
	AuditLogQuery,
	DocumentQueueQuery,
	Paginated,
} from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminApi, queryKeys } from "@/lib/api";

/**
 * The admin lists, page by page.
 *
 * `use-admin.ts` fetches page 1 of each list with `useQuery`; these are the
 * same endpoints through `useInfiniteQuery`, so a reviewer working through a
 * queue of hundreds is never told "20 documents" when there are 300. Same
 * `queryKeys` family (tagged `infinite` so the two cache shapes never share a
 * slot) and therefore the same invalidation: every moderation mutation clears
 * `queryScopes.admin`, which refreshes every loaded page here too.
 */

const PAGE_SIZE = 20;

type Fetcher<Q, T> = (query: Partial<Q>) => Promise<Paginated<T>>;

function usePagedAdminList<Q extends object, T>(
	queryKey: readonly unknown[],
	fetcher: Fetcher<Q, T>,
	query: Partial<Q>,
) {
	const result = useInfiniteQuery({
		queryKey,
		queryFn: ({ pageParam }) =>
			fetcher({ ...query, page: pageParam, limit: PAGE_SIZE } as Partial<Q>),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});

	const items = useMemo(
		() => result.data?.pages.flatMap((page) => page.items) ?? [],
		[result.data],
	);
	const total = result.data?.pages[0]?.meta.total ?? 0;

	return { ...result, items, total };
}

export function useAdminOrganizationsPaged(query: Partial<AdminOrgQuery> = {}) {
	return usePagedAdminList(
		queryKeys.adminOrganizations({ ...query, infinite: true }),
		adminApi.organizations,
		query,
	);
}

export function useAdminUsersPaged(query: Partial<AdminUserQuery> = {}) {
	return usePagedAdminList(
		queryKeys.adminUsers({ ...query, infinite: true }),
		adminApi.users,
		query,
	);
}

export function useOrgDocumentQueuePaged(
	query: Partial<DocumentQueueQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminOrgDocuments({ ...query, infinite: true }),
		adminApi.orgDocuments,
		query,
	);
}

export function useUserDocumentQueuePaged(
	query: Partial<DocumentQueueQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminUserDocuments({ ...query, infinite: true }),
		adminApi.userDocuments,
		query,
	);
}

export function useAuditLogsPaged(query: Partial<AuditLogQuery> = {}) {
	return usePagedAdminList(
		queryKeys.adminAuditLogs({ ...query, infinite: true }),
		adminApi.auditLogs,
		query,
	);
}
