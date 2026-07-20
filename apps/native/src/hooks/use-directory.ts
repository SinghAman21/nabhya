import type {
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	NearbyQuery,
	PaginationQuery,
	UpsertAnnouncementInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	orgDirectoryApi,
	publishingApi,
	queryKeys,
	queryScopes,
} from "@/lib/api";

// ─── Directory ───────────────────────────────────────────────────────────────

export function useOrganizations(
	query: Partial<PaginationQuery & { search?: string; city?: string }> = {},
) {
	return useQuery({
		queryKey: queryKeys.organizations(query),
		queryFn: () => orgDirectoryApi.list(query),
	});
}

export function useOrganization(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.organization(id ?? ""),
		queryFn: () => orgDirectoryApi.detail(id as string),
		enabled: !!id,
	});
}

/** Only runs once coordinates are known, so it never fires with a null fix. */
export function useNearbyOrganizations(query: NearbyQuery | null) {
	return useQuery({
		queryKey: queryKeys.nearby(query),
		queryFn: () => orgDirectoryApi.nearby(query as NearbyQuery),
		enabled: !!query,
	});
}

// ─── Announcements ───────────────────────────────────────────────────────────

export function useAnnouncements(
	organizationId: string | undefined,
	query: Partial<PaginationQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.announcements(organizationId ?? "", query),
		queryFn: () =>
			publishingApi.listAnnouncements(organizationId as string, query),
		enabled: !!organizationId,
	});
}

export function useMyAnnouncements(query: Partial<PaginationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.myAnnouncements(query),
		queryFn: () => publishingApi.listMyAnnouncements(query),
	});
}

export function useCreateAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpsertAnnouncementInput) =>
			publishingApi.createAnnouncement(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.announcements });
		},
	});
}

export function useUpdateAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: UpsertAnnouncementInput;
		}) => publishingApi.updateAnnouncement(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.announcements });
		},
	});
}

export function useDeleteAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.deleteAnnouncement(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.announcements });
		},
	});
}

// ─── Financial reports ───────────────────────────────────────────────────────

export function useFinancialReports(organizationId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.reports(organizationId ?? ""),
		queryFn: () => publishingApi.listReports(organizationId as string),
		enabled: !!organizationId,
	});
}

export function useCreateFinancialReport() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateFinancialReportInput) =>
			publishingApi.createReport(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.reports });
		},
	});
}

export function useDeleteFinancialReport() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.deleteReport(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.reports });
		},
	});
}

// ─── Team ────────────────────────────────────────────────────────────────────

export function useOrgTeam() {
	return useQuery({
		queryKey: queryKeys.team,
		queryFn: publishingApi.listTeam,
	});
}

export function useInviteAdmin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: InviteOrgAdminInput) =>
			publishingApi.inviteAdmin(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.team });
		},
	});
}

export function useRemoveAdmin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.removeAdmin(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.team });
		},
	});
}

// ─── Impact ──────────────────────────────────────────────────────────────────

export function useMyImpact(enabled = true) {
	return useQuery({
		queryKey: queryKeys.myImpact,
		queryFn: publishingApi.myImpact,
		enabled,
	});
}

export function useOrganizationImpact(organizationId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.orgImpact(organizationId ?? ""),
		queryFn: () => publishingApi.organizationImpact(organizationId as string),
		enabled: !!organizationId,
	});
}
