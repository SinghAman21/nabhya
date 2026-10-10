import type {
	BroadcastInput,
	BulkAttendanceInput,
	DonationQuery,
	MarkReadInput,
	NotificationQuery,
	PaginationQuery,
	ReplyToReviewInput,
	UpsertReviewInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	certificatesApi,
	donationsApi,
	engagementApi,
	notificationsApi,
	queryKeys,
	queryScopes,
} from "@/lib/api";

// ─── Notifications ───────────────────────────────────────────────────────────

export function useNotifications(query: Partial<NotificationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.notifications(query),
		queryFn: () => notificationsApi.list(query),
	});
}

export function useUnreadCount(enabled = true) {
	return useQuery({
		queryKey: queryKeys.unreadCount,
		queryFn: notificationsApi.unreadCount,
		enabled,
		// Cheap enough to keep the badge roughly live without polling hard.
		staleTime: 60 * 1000,
	});
}

export function useMarkNotificationsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: MarkReadInput) => notificationsApi.markRead(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.notifications });
		},
	});
}

export function useBroadcast() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: BroadcastInput) => notificationsApi.broadcast(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.notifications });
		},
	});
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export function useBookmarks(query: Partial<PaginationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.bookmarks(query),
		queryFn: () => engagementApi.listBookmarks(query),
	});
}

export function useToggleBookmark() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (organizationId: string) =>
			engagementApi.toggleBookmark(organizationId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.bookmarks });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
			// The NGO page reads its saved state from the detail's `viewer`.
			queryClient.invalidateQueries({ queryKey: queryScopes.organizations });
		},
	});
}

/**
 * Follow or unfollow an account. The server keeps follows and bookmarks apart;
 * the feed's "Follow" pill is this one, because the Following lens reads
 * `follows`.
 */
export function useToggleFollow() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			organizationId,
			following,
		}: {
			organizationId: string;
			/** The current state - true means this call unfollows. */
			following: boolean;
		}) =>
			following
				? engagementApi.unfollow(organizationId)
				: engagementApi.follow(organizationId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
			queryClient.invalidateQueries({ queryKey: queryScopes.organizations });
			queryClient.invalidateQueries({ queryKey: queryScopes.following });
		},
	});
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function useUpsertReview(organizationId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpsertReviewInput) =>
			engagementApi.upsertReview(organizationId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.reviews });
		},
	});
}

export function useDeleteMyReview(organizationId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => engagementApi.deleteMyReview(organizationId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.reviews });
		},
	});
}

export function useReplyToReview() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			reviewId,
			input,
		}: {
			reviewId: string;
			input: ReplyToReviewInput;
		}) => engagementApi.replyToReview(reviewId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.reviews });
		},
	});
}

// ─── Certificates ────────────────────────────────────────────────────────────

export function useMyCertificates(query: Partial<PaginationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.certificates(query),
		queryFn: () => certificatesApi.listMine(query),
	});
}

export function useCertificatePdf() {
	return useMutation({
		mutationFn: (id: string) => certificatesApi.pdfUrl(id),
	});
}

export function useVerifyCertificate(code: string | undefined) {
	return useQuery({
		queryKey: queryKeys.certificateVerification(code ?? ""),
		queryFn: () => certificatesApi.verify(code as string),
		enabled: !!code,
		retry: false,
	});
}

export function useMarkAttendance(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			applicationId,
			attended,
			hours,
		}: {
			applicationId: string;
			attended: boolean;
			/** Omit to keep what is recorded; null clears (= whole event). */
			hours?: number | null;
		}) =>
			certificatesApi.markAttendance(eventId, applicationId, {
				attended,
				...(hours !== undefined ? { hours } : {}),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
		},
	});
}

/** Mark a selection present, or certify it; returns per-volunteer outcomes. */
export function useBulkAttendance(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: BulkAttendanceInput) =>
			certificatesApi.bulkAttendance(eventId, input),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
		},
	});
}

export function useIssueCertificate(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			applicationId,
			note,
		}: {
			applicationId: string;
			note?: string;
		}) => certificatesApi.issue(eventId, applicationId, { note }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
		},
	});
}

/**
 * Withdraws a certificate that should not have been issued.
 *
 * The record is kept and flagged rather than deleted, so a verification link
 * that has already been shared resolves to "revoked" instead of "not found".
 */
export function useRevokeCertificate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			certificatesApi.revoke(id, { reason }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryKeys.orgOverview });
			queryClient.invalidateQueries({ queryKey: queryScopes.certificates });
		},
	});
}

// ─── Donations ───────────────────────────────────────────────────────────────

export function useCreateDonation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: donationsApi.createCheckout,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.donations });
		},
	});
}

export function useMyDonations(query: Partial<DonationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.myDonations(query),
		queryFn: () => donationsApi.listMine(query),
	});
}

/**
 * Fetched on demand rather than with the list: the server refuses a receipt
 * for anything that has not completed, so asking for every row would 400.
 */
export function useDonationReceipt(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.donationReceipt(id ?? ""),
		queryFn: () => donationsApi.receipt(id as string),
		enabled: !!id,
	});
}
