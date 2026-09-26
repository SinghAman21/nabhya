import type { UpdateOrganizationInput } from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsApi, queryKeys } from "@/lib/api";

/** The organization owned by the caller. Resolved server-side from the token. */
export function useMyOrganization(enabled = true) {
	return useQuery({
		queryKey: queryKeys.myOrganization,
		queryFn: organizationsApi.mine,
		enabled,
	});
}

/**
 * Whole-org counts for the dashboard (`GET /organizations/me/overview`).
 * Every events/needs mutation invalidates `queryKeys.orgOverview`.
 */
export function useOrgOverview(enabled = true) {
	return useQuery({
		queryKey: queryKeys.orgOverview,
		queryFn: organizationsApi.overview,
		enabled,
	});
}

export function useUpdateMyOrganization() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateOrganizationInput) =>
			organizationsApi.update(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.myOrganization });
			// The profile payload embeds an organization summary used for routing.
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});
}
