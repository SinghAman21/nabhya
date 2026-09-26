import type {
	CreateNeedInput,
	CreatePledgeInput,
	OrgNeedQuery,
	PaginationQuery,
	ReviewPledgeInput,
	UpdateNeedInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { needsApi, orgNeedsApi, queryKeys, queryScopes } from "@/lib/api";

// ─── Public / volunteer ──────────────────────────────────────────────────────

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

export function useOrgNeeds(
	query: Partial<OrgNeedQuery> = {},
	/** Off for a screen that mounts a consumer it may never open. */
	enabled = true,
) {
	return useQuery({
		queryKey: queryKeys.orgNeeds(query),
		queryFn: () => orgNeedsApi.list(query),
		enabled,
	});
}

export function useCreateNeed() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateNeedInput) => orgNeedsApi.create(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgNeeds });
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
			// The composer can create one of these straight from the feed, and
			// the ranking pool holds open needs, upcoming events and published
			// announcements - so the feed is stale the moment one is written,
			// whichever surface wrote it.
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
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
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
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
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
			queryClient.invalidateQueries({ queryKey: queryScopes.needs });
		},
	});
}

/**
 * One need as the public sees it, plus the viewer's own pledge - the need page
 * and the NGO's "new pledge" deep link. Under the `["needs"]` scope, so
 * pledging and withdrawing refresh it.
 */
export function usePublicNeed(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.publicNeed(id ?? ""),
		queryFn: () => needsApi.detail(id as string),
		enabled: !!id,
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
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
		},
	});
}
