import type {
	BroadcastInput,
	CertificateVerification,
	CreateDonationInput,
	DonationCheckout,
	DonationQuery,
	DonationStats,
	IssueCertificateInput,
	MarkAttendanceInput,
	MarkReadInput,
	NotificationQuery,
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

	listReviews: (organizationId: string, query: Partial<ReviewQuery>) =>
		http.get<Paginated<ReviewItem> & { summary: ReviewSummary }>(
			ENGAGEMENT.reviews(organizationId),
			query,
		),
	upsertReview: (organizationId: string, input: UpsertReviewInput) =>
		http.post<ReviewItem>(ENGAGEMENT.reviews(organizationId), input),
	deleteMyReview: (organizationId: string) =>
		http.delete<{ deleted: boolean }>(ENGAGEMENT.myReview(organizationId)),

	listMyOrgReviews: (query: Partial<ReviewQuery>) =>
		http.get<Paginated<ReviewItem> & { summary: ReviewSummary }>(
			ENGAGEMENT.ORG_REVIEWS,
			query,
		),
	replyToReview: (reviewId: string, input: ReplyToReviewInput) =>
		http.patch<ReviewItem>(ENGAGEMENT.replyToReview(reviewId), input),
};

export const certificatesApi = {
	listMine: (query: Partial<PaginationQuery>) =>
		http.getPage<MyCertificate>(CERTIFICATES.MINE, query),
	pdfUrl: (id: string) => http.get<{ url: string }>(CERTIFICATES.pdf(id)),
	/** Public — no auth required, which is the point of a verification code. */
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
};

export const donationsApi = {
	createCheckout: (input: CreateDonationInput) =>
		http.post<DonationCheckout>(DONATIONS.CHECKOUT, input),
	listMine: (query: Partial<DonationQuery>) =>
		http.getPage<MyDonation>(DONATIONS.MINE, query),
	receipt: (id: string) =>
		http.get<Record<string, unknown>>(DONATIONS.receipt(id)),
	listForOrg: (query: Partial<DonationQuery>) =>
		http.get<Paginated<OrgDonation> & { stats: DonationStats }>(
			DONATIONS.ORG,
			query,
		),
};
