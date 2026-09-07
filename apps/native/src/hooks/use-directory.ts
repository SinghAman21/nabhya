import type {
	CreateFinancialReportInput,
	InviteOrgAdminInput,
	UpdateOrgAdminInput,
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

export function useOrganization(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.organization(id ?? ""),
		queryFn: () => orgDirectoryApi.detail(id as string),
		enabled: !!id,
	});
}

// ─── Announcements ───────────────────────────────────────────────────────────

export function useCreateAnnouncement() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpsertAnnouncementInput) =>
			publishingApi.createAnnouncement(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.announcements });
			// Same reason as needs and events: the composer publishes one from
			// the feed, and the ranking pool holds published announcements.
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
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

export function useUpdateAdmin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateOrgAdminInput }) =>
			publishingApi.updateAdmin(id, input),
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
