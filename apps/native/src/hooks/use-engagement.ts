import type {
	BroadcastInput,
	DonationQuery,
	MarkReadInput,
	NotificationQuery,
	PaginationQuery,
	ReplyToReviewInput,
	ReviewQuery,
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
		},
	});
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function useReviews(
	organizationId: string | undefined,
	query: Partial<ReviewQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.reviews(organizationId ?? "", query),
		queryFn: () => engagementApi.listReviews(organizationId as string, query),
		enabled: !!organizationId,
	});
}

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

export function useMyOrgReviews(query: Partial<ReviewQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.orgReviews(query),
		queryFn: () => engagementApi.listMyOrgReviews(query),
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
		}: {
			applicationId: string;
			attended: boolean;
		}) => certificatesApi.markAttendance(eventId, applicationId, { attended }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
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

export function useOrgDonations(query: Partial<DonationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.orgDonations(query),
		queryFn: () => donationsApi.listForOrg(query),
	});
}
