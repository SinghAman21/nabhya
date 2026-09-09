import type {
	AdminActivityQuery,
	AdminAnalyticsQuery,
	AdminOrgQuery,
	AdminUserQuery,
	AuditLogQuery,
	BulkReviewDocumentsInput,
	DocumentQueueQuery,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	SetOrgStatusInput,
	SetUserStatusInput,
	TrendWindow,
} from "@nabhya/shared";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { adminApi, queryKeys, queryScopes } from "@/lib/api";

/**
 * The Overview's time series.
 *
 * Keyed by the window so switching 7/30/90 is a cache hit after the first look
 * rather than a refetch, and `placeholderData: keepPreviousData` holds the last
 * chart up while the next window loads — a skeleton flash on a chart that is
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

export function useAdminAnalytics(query: Partial<AdminAnalyticsQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminAnalytics(query),
		queryFn: () => adminApi.analytics(query),
		placeholderData: keepPreviousData,
	});
}

export function useAdminOrganizations(query: Partial<AdminOrgQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminOrganizations(query),
		queryFn: () => adminApi.organizations(query),
	});
}

export function useAdminOrganization(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.adminOrganization(id ?? ""),
		queryFn: () => adminApi.organization(id as string),
		enabled: !!id,
	});
}

export function useAdminOrganizationActivity(
	id: string | undefined,
	query: Partial<AdminActivityQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.adminOrganizationActivity(id ?? "", query),
		queryFn: () => adminApi.organizationActivity(id as string, query),
		enabled: !!id,
		placeholderData: keepPreviousData,
	});
}

export function useAuditLogs(query: Partial<AuditLogQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminAuditLogs(query),
		queryFn: () => adminApi.auditLogs(query),
	});
}

/**
 * The cross-organization verification queues.
 *
 * The dossier screens show one NGO's documents at a time; these answer the
 * other question a reviewer has — "what is waiting on me right now?" — without
 * opening every organization in turn.
 */
export function useOrgDocumentQueue(query: Partial<DocumentQueueQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminOrgDocuments(query),
		queryFn: () => adminApi.orgDocuments(query),
	});
}

export function useUserDocumentQueue(query: Partial<DocumentQueueQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminUserDocuments(query),
		queryFn: () => adminApi.userDocuments(query),
	});
}

export function useAdminUsers(query: Partial<AdminUserQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.adminUsers(query),
		queryFn: () => adminApi.users(query),
	});
}

export function useAdminUser(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.adminUser(id ?? ""),
		queryFn: () => adminApi.user(id as string),
		enabled: !!id,
	});
}

export function useAdminUserActivity(
	id: string | undefined,
	query: Partial<AdminActivityQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.adminUserActivity(id ?? "", query),
		queryFn: () => adminApi.userActivity(id as string, query),
		enabled: !!id,
		placeholderData: keepPreviousData,
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
 * can tell the reviewer which rows are still waiting — see
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
