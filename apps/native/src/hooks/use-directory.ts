import type {
	CreateFinancialReportInput,
	InviteTeamMemberInput,
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

export function useOrgTeam(query?: { status?: string; includeLeft?: boolean }) {
	return useQuery({
		queryKey: queryKeys.team(query),
		queryFn: () =>
			publishingApi.listTeam(
				query as { status?: "ACTIVE" | "SUSPENDED"; includeLeft?: boolean },
			),
	});
}

export function usePublicTeam(organizationId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.publicTeam(organizationId ?? ""),
		queryFn: () => publishingApi.listPublicTeam(organizationId as string),
		enabled: !!organizationId,
	});
}

/** `enabled` false for roles without `team.invite`, whom the endpoint 403s. */
export function useTeamInvites(enabled = true) {
	return useQuery({
		queryKey: queryKeys.teamInvites,
		queryFn: publishingApi.listTeamInvites,
		enabled,
	});
}

export function useUpdateAdmin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateOrgAdminInput }) =>
			publishingApi.updateAdmin(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useRemoveAdmin() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.removeAdmin(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useCreateTeamInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: InviteTeamMemberInput) =>
			publishingApi.createTeamInvite(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useRevokeTeamInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.revokeTeamInvite(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useResendTeamInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => publishingApi.resendTeamInvite(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useLeaveTeam() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: publishingApi.leaveTeam,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useRequestOwnershipTransfer() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (toMemberId: string) =>
			publishingApi.requestOwnershipTransfer(toMemberId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
		},
	});
}

export function useConfirmOwnershipTransfer() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (token: string) =>
			publishingApi.confirmOwnershipTransfer(token),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({
				queryKey: queryKeys.onboardingStatus,
			});
		},
	});
}

/**
 * `byId`: the value is the invite's id (from a notification) rather than the
 * email link's token - see `app/team/invites/[token].tsx`.
 */
export function useAcceptTeamInvite(byId = false) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (value: string) =>
			byId
				? publishingApi.acceptTeamInviteById(value)
				: publishingApi.acceptTeamInvite(value),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
			queryClient.invalidateQueries({ queryKey: queryKeys.me });
			queryClient.invalidateQueries({
				queryKey: queryKeys.onboardingStatus,
			});
		},
	});
}

export function useDeclineTeamInvite(byId = false) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (value: string) =>
			byId
				? publishingApi.declineTeamInviteById(value)
				: publishingApi.declineTeamInvite(value),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.team });
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
