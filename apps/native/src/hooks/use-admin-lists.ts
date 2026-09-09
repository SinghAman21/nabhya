import type {
	AdminActivityQuery,
	AdminOrgPostsQuery,
	AdminOrgQuery,
	AdminUserQuery,
	AuditLogQuery,
	DocumentQueueQuery,
	Paginated,
} from "@nabhya/shared";
import { PAGE_SIZE, usePagedQuery } from "@/components/paged-list";
import { adminApi, queryKeys } from "@/lib/api";

/**
 * The admin lists, page by page.
 *
 * `use-admin.ts` fetches page 1 of each list with `useQuery`; these are the
 * same endpoints through `usePagedQuery`, so a reviewer working through a queue
 * of hundreds is never told "20 documents" when there are 300.
 *
 * They used to hand-roll `useInfiniteQuery` here, a second copy of what
 * `components/paged-list.tsx` already does for every other list in the app —
 * with its own `PAGE_SIZE` that could drift from the shared one and its own
 * `infinite: true` marker where `usePagedQuery` appends `"infinite"` to the key
 * itself. Same `queryKeys` family and therefore the same invalidation: every
 * moderation mutation clears `queryScopes.admin`, which reaches these too.
 *
 * `total` is the whole result count from the first page's envelope, not the
 * number of rows loaded — the screens print it in the header, where "1 of 340
 * NGOs pending" is the number a reviewer needs.
 */

function usePagedAdminList<Q extends object, T>(
	queryKey: readonly unknown[],
	fetcher: (query: Partial<Q>) => Promise<Paginated<T>>,
	query: Partial<Q>,
) {
	const {
		query: result,
		items,
		first,
		loadMore,
	} = usePagedQuery({
		queryKey,
		fetchPage: (page) =>
			fetcher({ ...query, page, limit: PAGE_SIZE } as Partial<Q>),
	});

	return {
		query: result,
		items: items as T[],
		total: first?.meta.total ?? 0,
		loadMore,
	};
}

export function useAdminOrganizationsPaged(query: Partial<AdminOrgQuery> = {}) {
	return usePagedAdminList(
		queryKeys.adminOrganizations(query),
		adminApi.organizations,
		query,
	);
}

export function useAdminUsersPaged(query: Partial<AdminUserQuery> = {}) {
	return usePagedAdminList(queryKeys.adminUsers(query), adminApi.users, query);
}

export function useOrgDocumentQueuePaged(
	query: Partial<DocumentQueueQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminOrgDocuments(query),
		adminApi.orgDocuments,
		query,
	);
}

export function useUserDocumentQueuePaged(
	query: Partial<DocumentQueueQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminUserDocuments(query),
		adminApi.userDocuments,
		query,
	);
}

export function useAdminOrganizationActivityPaged(
	id: string | undefined,
	query: Partial<AdminActivityQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminOrganizationActivity(id ?? "", query),
		(pageQuery) => adminApi.organizationActivity(id as string, pageQuery),
		query,
	);
}

export function useAdminOrganizationPostsPaged(
	id: string | undefined,
	query: Partial<AdminOrgPostsQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminOrganizationPosts(id ?? "", query),
		(pageQuery) => adminApi.organizationPosts(id as string, pageQuery),
		query,
	);
}

export function useAdminUserActivityPaged(
	id: string | undefined,
	query: Partial<AdminActivityQuery> = {},
) {
	return usePagedAdminList(
		queryKeys.adminUserActivity(id ?? "", query),
		(pageQuery) => adminApi.userActivity(id as string, pageQuery),
		query,
	);
}

export function useAuditLogsPaged(query: Partial<AuditLogQuery> = {}) {
	return usePagedAdminList(
		queryKeys.adminAuditLogs(query),
		adminApi.auditLogs,
		query,
	);
}
