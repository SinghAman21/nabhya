import type {
	BroadcastInput,
	BulkAttendanceInput,
	BulkResult,
	CertificateVerification,
	CreateDonationInput,
	DonationCheckout,
	DonationQuery,
	DonationStats,
	IssueCertificateInput,
	MarkAttendanceInput,
	MarkReadInput,
	NotificationQuery,
	OrgDonationQuery,
	OrgReviewQuery,
	Paginated,
	PaginationQuery,
	ReplyToReviewInput,
	ReviewQuery,
	ReviewSummary,
	RevokeCertificateInput,
	UpsertReviewInput,
} from "@nabhya/shared";
import type {
	BookmarkListItem,
	DonationReceipt,
	MyCertificate,
	MyDonation,
	NotificationItem,
	OrgDonation,
	ReviewItem,
} from "@/lib/types";
import {
	CERTIFICATES,
	DONATIONS,
	ENGAGEMENT,
	NOTIFICATIONS,
} from "./endpoints";
import { http } from "./http";

export const notificationsApi = {
	list: (query: Partial<NotificationQuery>) =>
		http.get<Paginated<NotificationItem> & { unreadCount: number }>(
			NOTIFICATIONS.LIST,
			query,
		),
	unreadCount: () =>
		http.get<{ unreadCount: number }>(NOTIFICATIONS.UNREAD_COUNT),
	markRead: (input: MarkReadInput) =>
		http.post<{ unreadCount: number }>(NOTIFICATIONS.READ, input),
	broadcast: (input: BroadcastInput) =>
		http.post<{ delivered: number }>(NOTIFICATIONS.BROADCAST, input),
};

export const engagementApi = {
	toggleBookmark: (organizationId: string) =>
		http.post<{ bookmarked: boolean }>(ENGAGEMENT.bookmark(organizationId)),
	listBookmarks: (query: Partial<PaginationQuery>) =>
		http.getPage<BookmarkListItem>(ENGAGEMENT.MY_BOOKMARKS, query),
	/** Same row shape as a bookmark: the org plus when it was followed. */
	listFollowing: (query: Partial<PaginationQuery>) =>
		http.getPage<BookmarkListItem>(ENGAGEMENT.MY_FOLLOWING, query),
	/** Following is what the Following feed reads; a bookmark is a private save. */
	follow: (organizationId: string) =>
		http.post<{ following: boolean }>(ENGAGEMENT.follow(organizationId)),
	unfollow: (organizationId: string) =>
		http.delete<{ following: boolean }>(ENGAGEMENT.follow(organizationId)),

	listReviews: (organizationId: string, query: Partial<ReviewQuery>) =>
		http.get<Paginated<ReviewItem> & { summary: ReviewSummary }>(
			ENGAGEMENT.reviews(organizationId),
			query,
		),
	upsertReview: (organizationId: string, input: UpsertReviewInput) =>
		http.post<ReviewItem>(ENGAGEMENT.reviews(organizationId), input),
	deleteMyReview: (organizationId: string) =>
		http.delete<{ deleted: boolean }>(ENGAGEMENT.myReview(organizationId)),

	listMyOrgReviews: (query: Partial<OrgReviewQuery>) =>
		http.get<
			Paginated<ReviewItem> & {
				summary: ReviewSummary;
				/** Across the whole org, not just this page. */
				awaitingReplyCount: number;
			}
		>(ENGAGEMENT.ORG_REVIEWS, query),
	replyToReview: (reviewId: string, input: ReplyToReviewInput) =>
		http.patch<ReviewItem>(ENGAGEMENT.replyToReview(reviewId), input),
};

export const certificatesApi = {
	listMine: (query: Partial<PaginationQuery>) =>
		http.getPage<MyCertificate>(CERTIFICATES.MINE, query),
	pdfUrl: (id: string) => http.get<{ url: string }>(CERTIFICATES.pdf(id)),
	/** Public - no auth required, which is the point of a verification code. */
	verify: (code: string) =>
		http.get<CertificateVerification>(CERTIFICATES.verify(code)),

	markAttendance: (
		eventId: string,
		applicationId: string,
		input: MarkAttendanceInput,
	) =>
		http.patch<{ id: string }>(
			CERTIFICATES.attendance(eventId, applicationId),
			input,
		),
	issue: (
		eventId: string,
		applicationId: string,
		input: IssueCertificateInput,
	) =>
		http.post<MyCertificate>(CERTIFICATES.issue(eventId, applicationId), input),
	revoke: (id: string, input: RevokeCertificateInput) =>
		http.patch<{ id: string }>(CERTIFICATES.revoke(id), input),
	bulkAttendance: (eventId: string, input: BulkAttendanceInput) =>
		http.post<BulkResult>(CERTIFICATES.bulkAttendance(eventId), input),
};

export const donationsApi = {
	createCheckout: (input: CreateDonationInput) =>
		http.post<DonationCheckout>(DONATIONS.CHECKOUT, input),
	listMine: (query: Partial<DonationQuery>) =>
		http.getPage<MyDonation>(DONATIONS.MINE, query),
	receipt: (id: string) => http.get<DonationReceipt>(DONATIONS.receipt(id)),
	listForOrg: (query: Partial<OrgDonationQuery>) =>
		http.get<Paginated<OrgDonation> & { stats: DonationStats }>(
			DONATIONS.ORG,
			query,
		),
};
