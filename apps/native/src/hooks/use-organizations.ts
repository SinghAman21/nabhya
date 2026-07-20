import type {
	PaginationQuery,
	UpdateOrganizationInput,
	UploadOrgDocumentInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsApi, queryKeys, queryScopes } from "@/lib/api";

// ─── Public directory ────────────────────────────────────────────────────────

export function usePublicOrganizations(
	query: Partial<PaginationQuery> & { search?: string; city?: string } = {},
) {
	return useQuery({
		queryKey: queryKeys.publicOrganizations(query),
		queryFn: () => organizationsApi.listPublic(query),
	});
}

export function usePublicOrganization(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.organization(id ?? ""),
		queryFn: () => organizationsApi.publicDetail(id as string),
		enabled: !!id,
	});
}

// ─── Owned organization ──────────────────────────────────────────────────────

export function useMyOrganization(enabled = true) {
	return useQuery({
		queryKey: queryKeys.myOrganization,
		queryFn: organizationsApi.mine,
		enabled,
	});
}

export function useUpdateOrganization() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateOrganizationInput) =>
			organizationsApi.update(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.organizations });
			// The profile embeds an organization summary — keep it in step.
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});
}

export function useMyOrgDocuments() {
	return useQuery({
		queryKey: queryKeys.myOrgDocuments,
		queryFn: organizationsApi.myDocuments,
	});
}

export function useUploadOrgDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UploadOrgDocumentInput) =>
			organizationsApi.uploadDocument(input),
		onSuccess: () => {
			// A fresh document can re-open verification for a rejected NGO.
			queryClient.invalidateQueries({ queryKey: queryScopes.organizations });
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus });
		},
	});
}
