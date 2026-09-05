import { formatFinancialYear } from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	Bookmark,
	FileText,
	MessageSquare,
	Newspaper,
	Star,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { DonateSheet } from "@/components/donate-sheet";
import {
	LoadMoreButton,
	PAGE_SIZE,
	usePagedQuery,
} from "@/components/paged-list";
import { ReviewSheet } from "@/components/review-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2, H3, Label } from "@/components/ui/typography";
import {
	useFinancialReports,
	useOrganization,
	useOrganizationImpact,
} from "@/hooks/use-directory";
import { useOpenDocument } from "@/hooks/use-documents";
import {
	useBookmarks,
	useDeleteMyReview,
	useToggleBookmark,
} from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { Alert } from "@/lib/alert";
import {
	apiErrorMessage,
	engagementApi,
	publishingApi,
	queryKeys,
} from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate, formatRelative } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

type Tab = "about" | "updates" | "reviews" | "transparency";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "about", label: "About" },
	{ value: "updates", label: "Updates" },
	{ value: "reviews", label: "Reviews" },
	{ value: "transparency", label: "Transparency" },
];

/**
 * An NGO's public page. Name and standing first, its record in numbers, then
 * the tabs. Save lives in the header beside back; the one action a visitor is
 * likely to take — donate — is pinned to the bottom.
 */
export default function NgoProfilePage() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("about");
	const [reviewOpen, setReviewOpen] = useState(false);
	const [donateOpen, setDonateOpen] = useState(false);

	const email = useAuthStore((s) => s.email);
	const org = useOrganization(id);
	const impact = useOrganizationImpact(id);
	const toggleBookmark = useToggleBookmark();
	// The detail payload carries no saved flag; the caller's bookmark list is
	// short and already cached, so read it from there.
	const bookmarks = useBookmarks({ limit: 100 });
	const bookmarked =
		!!email &&
		(bookmarks.data?.items ?? []).some((row) => row.organization.id === id);

	const requireSignIn = (next: () => void) => {
		if (!email) {
			router.push("/(auth)/login");
			return;
		}
		next();
	};

	const onBookmark = () =>
		requireSignIn(() =>
			toggleBookmark.mutate(id, {
				onError: (error) =>
					Alert.alert("Could not save", apiErrorMessage(error)),
			}),
		);

	const gutter = spacing[5];
	const desktopWidth = isDesktop
		? ({ maxWidth: 720, width: "100%", alignSelf: "center" } as const)
		: undefined;

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					minHeight: 40,
					paddingHorizontal: gutter,
					paddingTop: insets.top + spacing[2],
					paddingBottom: spacing[2],
				}}
			>
				<BackButton fallbackHref="/ngos" />
				<Pressable
					onPress={onBookmark}
					hitSlop={8}
					disabled={toggleBookmark.isPending}
					accessibilityRole="button"
					accessibilityLabel={
						bookmarked ? "Remove from saved" : "Save this NGO"
					}
					accessibilityState={{
						selected: bookmarked,
						disabled: toggleBookmark.isPending,
					}}
					{...focusable}
					style={({ pressed }) => ({
						width: 40,
						height: 40,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: pressed
							? colors.background.tertiary
							: colors.background.subtle,
					})}
				>
					<Bookmark
						size={20}
						color={colors.text.primary as string}
						fill={bookmarked ? (colors.text.primary as string) : "transparent"}
					/>
				</Pressable>
			</View>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError || !org.data ? (
				<ErrorState
					message={apiErrorMessage(org.error, "This NGO is not available.")}
					onRetry={() => org.refetch()}
				/>
			) : (
				<>
					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							paddingHorizontal: gutter,
							paddingTop: spacing[2],
							paddingBottom: spacing[8],
							...desktopWidth,
						}}
					>
						<H2 accessibilityRole="header" style={{ marginBottom: spacing[2] }}>
							{org.data.organizationName}
						</H2>
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								gap: spacing[2],
								marginBottom: spacing[2],
							}}
						>
							<StatusPill
								label={humanizeStatus(org.data.verificationStatus)}
								tone={verificationTone(org.data.verificationStatus)}
							/>
							{org.data.categories?.map((category) => (
								<StatusPill key={category.id} label={category.name} />
							))}
						</View>
						<Caption color="tertiary" style={{ marginBottom: spacing[5] }}>
							{[org.data.city, org.data.state].filter(Boolean).join(", ") ||
								"Location not set"}
							{org.data.foundingYear ? ` · Since ${org.data.foundingYear}` : ""}
						</Caption>

						{/* Impact is the headline: what this NGO has actually done. */}
						{impact.data && (
							<View style={{ marginBottom: spacing[5] }}>
								<MetricRow
									stats={[
										{
											label: "Volunteers",
											value: impact.data.volunteersEngaged,
										},
										{ label: "Hours given", value: impact.data.volunteerHours },
										{ label: "Events", value: impact.data.eventsHosted },
									]}
								/>
							</View>
						)}

						<FilterChips options={TABS} value={tab} onChange={setTab} />

						{tab === "about" && <AboutTab organization={org.data} />}
						{tab === "updates" && <UpdatesTab organizationId={id} />}
						{tab === "reviews" && (
							<ReviewsTab
								organizationId={id}
								onWrite={() => requireSignIn(() => setReviewOpen(true))}
							/>
						)}
						{tab === "transparency" && <TransparencyTab organizationId={id} />}
					</ScrollView>

					<View
						style={{
							paddingHorizontal: gutter,
							paddingTop: spacing[3],
							paddingBottom: insets.bottom + spacing[3],
							borderTopWidth: 1,
							borderTopColor: colors.border.hairline,
							backgroundColor: colors.background.card,
						}}
					>
						<View style={desktopWidth}>
							<Button
								onPress={() => requireSignIn(() => setDonateOpen(true))}
								accessibilityLabel={`Donate to ${org.data.organizationName}`}
							>
								{email ? "Donate" : "Sign in to donate"}
							</Button>
						</View>
					</View>
				</>
			)}

			<ReviewSheet
				organizationId={id}
				organizationName={org.data?.organizationName ?? ""}
				visible={reviewOpen}
				onClose={() => setReviewOpen(false)}
			/>
			<DonateSheet
				organizationId={id}
				organizationName={org.data?.organizationName ?? ""}
				visible={donateOpen}
				onClose={() => setDonateOpen(false)}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* About                                                                      */
/* -------------------------------------------------------------------------- */

function AboutTab({
	organization,
}: {
	organization: NonNullable<ReturnType<typeof useOrganization>["data"]>;
}) {
	const { spacing } = useTheme();
	const facts = [
		{ label: "Type", value: humanizeStatus(organization.orgType) },
		{ label: "Registration", value: organization.registrationNumber },
		{
			label: "Team size",
			value: organization.teamSize ? String(organization.teamSize) : null,
		},
		{ label: "Website", value: organization.website },
		{ label: "Address", value: organization.address },
	].filter((fact) => fact.value);

	return (
		<View>
			{organization.description && (
				<Body color="secondary" style={{ marginBottom: spacing[5] }}>
					{organization.description}
				</Body>
			)}
			{organization.mission && (
				<View style={{ marginBottom: spacing[5] }}>
					<SectionTitle>Mission</SectionTitle>
					<Body color="secondary">{organization.mission}</Body>
				</View>
			)}
			{facts.length > 0 && (
				<>
					<SectionTitle>Details</SectionTitle>
					<ListGroup>
						{facts.map((fact) => (
							<ListRow
								key={fact.label}
								label={fact.label}
								value={
									<Caption
										color="secondary"
										numberOfLines={2}
										style={{ maxWidth: "60%", textAlign: "right" }}
									>
										{fact.value}
									</Caption>
								}
							/>
						))}
					</ListGroup>
				</>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Updates                                                                    */
/* -------------------------------------------------------------------------- */

function UpdatesTab({ organizationId }: { organizationId: string }) {
	const { spacing } = useTheme();
	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.announcements(organizationId, { limit: PAGE_SIZE }),
		fetchPage: (page) =>
			publishingApi.listAnnouncements(organizationId, {
				page,
				limit: PAGE_SIZE,
			}),
	});

	if (query.isLoading) return <LoadingState />;
	if (query.isError && items.length === 0) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	if (items.length === 0) {
		return (
			<EmptyState
				icon={Newspaper}
				title="No updates yet"
				description="When this NGO posts news about its work, it appears here."
			/>
		);
	}

	return (
		<View>
			<ListGroup>
				{items.map((item) => (
					<View
						key={item.id}
						style={{
							paddingHorizontal: spacing[4],
							paddingVertical: spacing[4],
						}}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2],
								marginBottom: spacing[1],
							}}
						>
							<Label weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
								{item.title}
							</Label>
							{item.isPinned && <StatusPill label="Pinned" tone="info" />}
						</View>
						<Caption color="secondary">{item.body}</Caption>
						<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
							{formatRelative(item.publishedAt ?? item.createdAt)}
						</Caption>
					</View>
				))}
			</ListGroup>
			<LoadMoreButton query={query} loadMore={loadMore} />
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

function ReviewsTab({
	organizationId,
	onWrite,
}: {
	organizationId: string;
	onWrite: () => void;
}) {
	const { colors, spacing } = useTheme();
	const email = useAuthStore((s) => s.email);
	const me = useMe(!!email);
	const remove = useDeleteMyReview(organizationId);

	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.reviews(organizationId, { limit: PAGE_SIZE }),
		fetchPage: (page) =>
			engagementApi.listReviews(organizationId, { page, limit: PAGE_SIZE }),
	});
	const summary = first?.summary;

	// One review per person, so "mine" is whichever row carries my user id.
	const myUserId = me.data?.id;
	const hasMine = !!myUserId && items.some((r) => r.user.id === myUserId);

	const confirmDelete = () => {
		Alert.alert(
			"Delete your review?",
			"It will be removed for everyone. You can write a new one later.",
			[
				{ text: "Keep it", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () =>
						remove.mutate(undefined, {
							onError: (error) =>
								Alert.alert("Could not delete", apiErrorMessage(error)),
						}),
				},
			],
		);
	};

	if (query.isLoading) return <LoadingState />;
	if (query.isError && items.length === 0) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
		<View>
			<Surface style={{ marginBottom: spacing[3] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
					}}
				>
					<View>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[1.5],
							}}
						>
							<H3>{summary?.count ? summary.average.toFixed(1) : "—"}</H3>
							<Star
								size={16}
								color={colors.warning.ink}
								fill={colors.warning.ink}
							/>
						</View>
						<Caption color="tertiary">
							{summary?.count ?? 0} review{summary?.count === 1 ? "" : "s"}
						</Caption>
					</View>
					<Button size="sm" variant="outline" onPress={onWrite}>
						{hasMine ? "Edit your review" : "Write a review"}
					</Button>
				</View>
			</Surface>

			{items.length === 0 ? (
				<EmptyState
					icon={MessageSquare}
					title="No reviews yet"
					description="Volunteered with this NGO? Be the first to say how it went."
				/>
			) : (
				<>
					<ListGroup>
						{items.map((review) => {
							const mine = review.user.id === myUserId;
							return (
								<View
									key={review.id}
									style={{
										paddingHorizontal: spacing[4],
										paddingVertical: spacing[4],
									}}
								>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "space-between",
											gap: spacing[3],
										}}
									>
										<Label
											weight="semibold"
											numberOfLines={1}
											style={{ flex: 1 }}
										>
											{mine ? "You" : (review.user.fullName ?? "Volunteer")}
										</Label>
										<Stars rating={review.rating} />
									</View>
									{review.body && (
										<Caption
											color="secondary"
											style={{ marginTop: spacing[1.5] }}
										>
											{review.body}
										</Caption>
									)}
									<Caption
										color="quaternary"
										style={{ marginTop: spacing[1.5] }}
									>
										{formatRelative(review.createdAt)}
									</Caption>
									{review.reply && (
										<View
											style={{
												marginTop: spacing[3],
												padding: spacing[3],
												borderRadius: 12,
												backgroundColor: colors.background.subtle,
											}}
										>
											<Caption weight="medium" color="tertiary">
												Reply from the NGO
											</Caption>
											<Caption
												color="secondary"
												style={{ marginTop: spacing[0.5] }}
											>
												{review.reply}
											</Caption>
										</View>
									)}

									{mine && (
										<View
											style={{
												flexDirection: "row",
												gap: spacing[2],
												marginTop: spacing[3],
											}}
										>
											<Button size="sm" variant="outline" onPress={onWrite}>
												Edit
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onPress={confirmDelete}
												loading={remove.isPending}
												accessibilityLabel="Delete your review"
											>
												Delete
											</Button>
										</View>
									)}
								</View>
							);
						})}
					</ListGroup>
					<LoadMoreButton query={query} loadMore={loadMore} />
				</>
			)}
		</View>
	);
}

function Stars({ rating }: { rating: number }) {
	const { colors } = useTheme();
	return (
		<View
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${rating} out of 5 stars`}
			style={{ flexDirection: "row", gap: 2 }}
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					size={13}
					color={n <= rating ? colors.warning.ink : colors.border.dark}
					fill={n <= rating ? colors.warning.ink : "transparent"}
				/>
			))}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Transparency                                                               */
/* -------------------------------------------------------------------------- */

function TransparencyTab({ organizationId }: { organizationId: string }) {
	const query = useFinancialReports(organizationId);
	const openDocument = useOpenDocument();

	if (query.isLoading) return <LoadingState />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}
	const reports = query.data ?? [];

	if (reports.length === 0) {
		return (
			<EmptyState
				icon={FileText}
				title="No financial reports yet"
				description="NGOs can publish annual reports here so donors can see where money goes."
			/>
		);
	}

	const open = (key: string) =>
		openDocument.mutate(key, {
			onError: (error) => Alert.alert("Could not open", apiErrorMessage(error)),
		});

	return (
		<ListGroup>
			{reports.map((report) => (
				<ListRow
					key={report.id}
					icon={FileText}
					label={report.title}
					hint={`${formatFinancialYear(report.financialYear)} · ${formatDate(report.createdAt)}`}
					onPress={() => open(report.documentKey)}
				/>
			))}
		</ListGroup>
	);
}
