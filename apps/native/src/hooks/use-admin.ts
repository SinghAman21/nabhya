import type {
	AdminAnalyticsQuery,
	AuditLogQuery,
	BulkReviewDocumentsInput,
	CreateCategoryInput,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	SetOrgStatusInput,
	SetUserStatusInput,
	TrendWindow,
	UpdateCategoryInput,
} from "@nabhya/shared";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { adminApi, categoriesApi, queryKeys, queryScopes } from "@/lib/api";

/**
 * The Overview's time series.
 *
 * Keyed by the window so switching 7/30/90 is a cache hit after the first look
 * rather than a refetch, and `placeholderData: keepPreviousData` holds the last
 * chart up while the next window loads - a skeleton flash on a chart that is
 * about to be nearly identical is worse than a moment of stale data, and it
 * jumps the page's layout.
 */
export function useAdminTrends(days: TrendWindow) {
	return useQuery({
		queryKey: queryKeys.adminTrends(days),
		queryFn: () => adminApi.trends({ days }),
		placeholderData: keepPreviousData,
	});
}

export function useAdminOverview() {
	return useQuery({
		queryKey: queryKeys.adminOverview,
		queryFn: adminApi.overview,
	});
}

/**
 * Documents waiting on a superadmin, for the Queue row's badge in the rail.
 *
 * The overview's own query with a `select`, not a new endpoint: same cache
 * entry as the dashboard, so the badge and the dashboard's tiles can never
 * disagree, and every moderation mutation's `queryScopes.admin` invalidation
 * already refreshes it. `enabled` so a rail without the row never asks.
 */
export function usePendingDocumentCount(enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.adminOverview,
		queryFn: adminApi.overview,
		enabled,
		select: (overview) =>
			overview.documents.pendingOrgDocuments +
			overview.documents.pendingUserDocuments,
	});
}

export function useAdminAnalytics(query: Partial<AdminAnalyticsQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminAnalytics(query),
		queryFn: () => adminApi.analytics(query),
		placeholderData: keepPreviousData,
	});
}

export function useAdminOrganization(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.adminOrganization(id ?? ""),
		queryFn: () => adminApi.organization(id as string),
		enabled: !!id,
	});
}

export function useAuditLogs(query: Partial<AuditLogQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminAuditLogs(query),
		queryFn: () => adminApi.auditLogs(query),
	});
}

export function useAdminUser(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.adminUser(id ?? ""),
		queryFn: () => adminApi.user(id as string),
		enabled: !!id,
	});
}

/**
 * Moderation mutations invalidate the whole admin scope: approving an NGO moves
 * counters on the overview, its row in the list, and its dossier at once.
 */
export function useReviewOrganization() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: ReviewOrganizationInput;
		}) => adminApi.reviewOrganization(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
		},
	});
}

export function useSetOrganizationStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: SetOrgStatusInput }) =>
			adminApi.setOrganizationStatus(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
		},
	});
}

export function useAdminDeletePost() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => adminApi.deletePost(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

/**
 * Approving an identity document also promotes the user's own verification
 * status server-side, so the whole admin scope is invalidated rather than just
 * the document list.
 */
export function useReviewDocument(kind: "organization" | "user") {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: ReviewDocumentInput }) =>
			kind === "organization"
				? adminApi.reviewOrgDocument(id, input)
				: adminApi.reviewUserDocument(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
		},
	});
}

/**
 * Approving or rejecting a whole selection.
 *
 * The server reports per-document outcomes rather than a count, so the caller
 * can tell the reviewer which rows are still waiting - see
 * `bulkReviewDocumentsSchema` in `@nabhya/shared`. Invalidating the whole
 * `admin` scope is right here even though the single-document path does the
 * same: a batch can move an NGO's own verification state and re-derive several
 * volunteers' account statuses, so the queue, the directories and the overview
 * counters are all stale afterwards.
 */
export function useBulkReviewDocuments(kind: "organization" | "user") {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: BulkReviewDocumentsInput) =>
			adminApi.bulkReviewDocuments(kind, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
		},
	});
}

export function useSetUserStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: SetUserStatusInput }) =>
			adminApi.setUserStatus(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.admin });
		},
	});
}

export function useAdminCategories() {
	return useQuery({
		queryKey: queryKeys.adminCategories,
		queryFn: categoriesApi.adminList,
	});
}

export function useCreateAdminCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateCategoryInput) => categoriesApi.create(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
			queryClient.invalidateQueries({ queryKey: queryKeys.categories });
		},
	});
}

export function useUpdateAdminCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
			categoriesApi.update(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
			queryClient.invalidateQueries({ queryKey: queryKeys.categories });
		},
	});
}

export function useArchiveAdminCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: categoriesApi.archive,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
			queryClient.invalidateQueries({ queryKey: queryKeys.categories });
		},
	});
}
