import type {
	CreateNeedInput,
	CreatePledgeInput,
	OrgNeedQuery,
	PaginationQuery,
	PublicNeedQuery,
	ReviewPledgeInput,
	UpdateNeedInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { needsApi, orgNeedsApi, queryKeys, queryScopes } from "@/lib/api";

// ─── Public / volunteer ──────────────────────────────────────────────────────

export function usePublicNeeds(query: Partial<PublicNeedQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.publicNeeds(query),
		queryFn: () => needsApi.listPublic(query),
	});
}

export function usePublicNeed(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.publicNeed(id ?? ""),
		queryFn: () => needsApi.detail(id as string),
		enabled: !!id,
	});
}

export function useMyPledges(query: Partial<PaginationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.myPledges(query),
		queryFn: () => needsApi.myPledges(query),
	});
}

export function useCreatePledge(needId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreatePledgeInput) => needsApi.pledge(needId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

export function useWithdrawPledge() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ needId }: { needId: string }) =>
			needsApi.withdrawPledge(needId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

// ─── Organisation ────────────────────────────────────────────────────────────

export function useOrgNeeds(query: Partial<OrgNeedQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.orgNeeds(query),
		queryFn: () => orgNeedsApi.list(query),
	});
}

export function useCreateNeed() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateNeedInput) => orgNeedsApi.create(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgNeeds });
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
		},
	});
}

export function useUpdateNeed() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateNeedInput }) =>
			orgNeedsApi.update(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgNeeds });
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
		},
	});
}

export function useDeleteNeed() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => orgNeedsApi.remove(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgNeeds });
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
		},
	});
}

export function useNeedPledges(
	needId: string | undefined,
	query: Partial<PaginationQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.orgNeedPledges(needId ?? "", query),
		queryFn: () => orgNeedsApi.pledges(needId as string, query),
		enabled: !!needId,
	});
}

export function useReviewPledge(needId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			pledgeId,
			input,
		}: {
			pledgeId: string;
			input: ReviewPledgeInput;
		}) => orgNeedsApi.reviewPledge(needId, pledgeId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgNeeds });
		},
	});
}
