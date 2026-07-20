import type {
	AdminOrgQuery,
	AdminUserQuery,
	ReviewDocumentInput,
	ReviewOrganizationInput,
	SetOrgStatusInput,
	SetUserStatusInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, queryKeys, queryScopes } from "@/lib/api";

export function useAdminOverview() {
	return useQuery({
		queryKey: queryKeys.adminOverview,
		queryFn: adminApi.overview,
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
