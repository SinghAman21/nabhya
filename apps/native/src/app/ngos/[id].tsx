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
import { ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { DonateSheet } from "@/components/donate-sheet";
import { OrgCover, OrgLogo } from "@/components/org-branding";
import { PageTabs } from "@/components/page-tabs";
import {
	LoadMoreButton,
	PAGE_SIZE,
	usePagedQuery,
} from "@/components/paged-list";
import { ReviewSheet } from "@/components/review-sheet";
import {
	EmptyState,
	ErrorState,
	type Fact,
	FactList,
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
import { confirm, toast } from "@/components/ui/overlay";
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
import {
	apiErrorMessage,
	engagementApi,
	publishingApi,
	queryKeys,
} from "@/lib/api";
import { focusable } from "@/lib/focus";
import { formatDate, formatRelative } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * An NGO's public page — the one screen a volunteer or donor judges an
 * organisation by.
 *
 * ## Layout
 *
 * A hero, then two columns on desktop: what you read on the left, what you
 * *do* and look up on the right.
 *
 * The hero is the NGO's own branding — the cover band and logo it uploads on
 * `(ngo)/edit`, drawn through the same `OrgCover` / `OrgLogo` as its private
 * profile so the two cannot drift. Before this the page opened on a bare `H2`:
 * the organisation had somewhere to put a cover photo and a logo and nowhere
 * they appeared.
 *
 * On desktop the aside holds the actions and the registry facts, which does two
 * things. Donate stops being a bar welded to the bottom of a 1000pt window —
 * fine on a phone, odd on a desk — and the details stop being a `ListRow` list
 * with the label hard left and a right-aligned value clamped to `maxWidth: 60%`,
 * which is what they were. `FactList` stacks label over value, so a registration
 * number reads the same at any column width.
 *
 * Tabs are `PageTabs`, the same underline row as the NGO's own profile, rather
 * than `FilterChips`. A filled pill says "this list is filtered to a subset";
 * these are four different kinds of content about one subject.
 */

/** Two columns of content, and no wider than a prose column plus its aside. */
const PAGE: ViewStyle = {
	width: "100%",
	maxWidth: 1080,
	alignSelf: "center",
};

const MAIN_COLUMN = 2;
const ASIDE_COLUMN = 1;

type Tab = "about" | "updates" | "reviews" | "transparency";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "about", label: "About" },
	{ value: "updates", label: "Updates" },
	{ value: "reviews", label: "Reviews" },
	{ value: "transparency", label: "Transparency" },
];

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
				onError: (error) => toast.error(apiErrorMessage(error)),
			}),
		);

	const data = org.data;
	const gutter = spacing[5];
	const location =
		[data?.city, data?.state].filter(Boolean).join(", ") || "Location not set";

	const logoSize = isDesktop ? 92 : 72;
	const logoOverlap = Math.round(logoSize * 0.45);

	const donateButton = (
		<Button
			onPress={() => requireSignIn(() => setDonateOpen(true))}
			accessibilityLabel={`Donate to ${data?.organizationName ?? "this NGO"}`}
		>
			{email ? "Donate" : "Sign in to donate"}
		</Button>
	);

	const saveControl = (
		<Pressable
			onPress={onBookmark}
			hitSlop={8}
			disabled={toggleBookmark.isPending}
			accessibilityRole="button"
			accessibilityLabel={bookmarked ? "Remove from saved" : "Save this NGO"}
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
	);

	const hero = data ? (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<OrgCover
				imageKey={data.coverImage}
				height={isDesktop ? 184 : 120}
				empty=""
			/>
			<View style={{ paddingHorizontal: gutter, paddingBottom: spacing[5] }}>
				<View
					style={{
						marginTop: -logoOverlap,
						marginBottom: spacing[3],
						// Paints the logo over the cover it overlaps.
						zIndex: 1,
						alignSelf: "flex-start",
					}}
				>
					<OrgLogo
						name={data.organizationName}
						imageKey={data.logo}
						size={logoSize}
						ring
					/>
				</View>

				<H2 accessibilityRole="header">{data.organizationName}</H2>
				<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
					{location}
					{data.foundingYear ? ` · Since ${data.foundingYear}` : ""}
				</Caption>

				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						gap: spacing[2],
						marginTop: spacing[3],
					}}
				>
					<StatusPill
						label={humanizeStatus(data.verificationStatus)}
						tone={verificationTone(data.verificationStatus)}
					/>
					{data.categories?.map((category) => (
						<StatusPill key={category.id} label={category.name} />
					))}
				</View>
			</View>
		</Surface>
	) : null;

	const metrics = impact.data ? (
		<MetricRow
			stats={[
				{ label: "Volunteers", value: impact.data.volunteersEngaged },
				{ label: "Hours given", value: impact.data.volunteerHours },
				{ label: "Events", value: impact.data.eventsHosted },
			]}
		/>
	) : null;

	const tabs = <PageTabs tabs={TABS} value={tab} onChange={setTab} />;

	const panel = data ? (
		<>
			{tab === "about" && (
				<AboutTab organization={data} withFacts={!isDesktop} />
			)}
			{tab === "updates" && <UpdatesTab organizationId={id} />}
			{tab === "reviews" && (
				<ReviewsTab
					organizationId={id}
					onWrite={() => requireSignIn(() => setReviewOpen(true))}
				/>
			)}
			{tab === "transparency" && <TransparencyTab organizationId={id} />}
		</>
	) : null;

	/**
	 * Desktop only. The two actions a visitor has, in the column they are
	 * looking at rather than welded to the bottom of the window.
	 */
	const actionCard = data ? (
		<Surface>
			<View style={{ gap: spacing[3] }}>
				{donateButton}
				<Button
					variant="outline"
					onPress={onBookmark}
					loading={toggleBookmark.isPending}
					accessibilityState={{ selected: bookmarked }}
				>
					{bookmarked ? "Saved" : "Save this NGO"}
				</Button>
				<Caption color="quaternary">
					Donations are collected by Nabhya and passed to the organisation. You
					get a receipt either way.
				</Caption>
			</View>
		</Surface>
	) : null;

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<View
				style={{
					paddingTop: insets.top + spacing[2],
					paddingBottom: spacing[2],
					paddingHorizontal: gutter,
				}}
			>
				<View
					style={[
						PAGE,
						{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							minHeight: 40,
						},
					]}
				>
					<BackButton fallbackHref="/ngos" />
					{isDesktop ? null : saveControl}
				</View>
			</View>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError || !data ? (
				<ErrorState
					message={apiErrorMessage(org.error, "This NGO is not available.")}
					onRetry={() => org.refetch()}
				/>
			) : (
				<>
					<ScrollView
						{...verticalScrollbar}
						contentContainerStyle={{
							paddingHorizontal: gutter,
							paddingBottom: spacing[8],
						}}
					>
						<View style={PAGE}>
							{hero}

							{isDesktop ? (
								<View
									style={{
										flexDirection: "row",
										gap: spacing[6],
										marginTop: spacing[6],
									}}
								>
									<View
										style={{
											flex: MAIN_COLUMN,
											minWidth: 0,
											gap: spacing[6],
										}}
									>
										{metrics}
										<View>
											{tabs}
											{panel}
										</View>
									</View>
									<View
										style={{
											flex: ASIDE_COLUMN,
											minWidth: 0,
											gap: spacing[6],
										}}
									>
										{actionCard}
										<View>
											<SectionTitle>Details</SectionTitle>
											<OrgFacts organization={data} />
										</View>
									</View>
								</View>
							) : (
								<View style={{ marginTop: spacing[5], gap: spacing[5] }}>
									{metrics}
									<View>
										{tabs}
										{panel}
									</View>
								</View>
							)}
						</View>
					</ScrollView>

					{isDesktop ? null : (
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
							{donateButton}
						</View>
					)}
				</>
			)}

			<ReviewSheet
				organizationId={id}
				organizationName={data?.organizationName ?? ""}
				visible={reviewOpen}
				onClose={() => setReviewOpen(false)}
			/>
			<DonateSheet
				organizationId={id}
				organizationName={data?.organizationName ?? ""}
				visible={donateOpen}
				onClose={() => setDonateOpen(false)}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Facts                                                                      */
/* -------------------------------------------------------------------------- */

type Organization = NonNullable<ReturnType<typeof useOrganization>["data"]>;

/**
 * The registry record. On desktop it lives in the aside; on a phone there is no
 * aside, so `AboutTab` renders it under the prose — one component either way so
 * the two placements cannot say different things.
 */
function OrgFacts({ organization }: { organization: Organization }) {
	const facts: Fact[] = [
		{ label: "Type", value: humanizeStatus(organization.orgType) },
		{ label: "Registration number", value: organization.registrationNumber },
		{
			label: "Founded",
			value: organization.foundingYear
				? String(organization.foundingYear)
				: null,
		},
		{
			label: "Team size",
			value: organization.teamSize ? `${organization.teamSize} people` : null,
		},
		{ label: "Website", value: organization.website },
		{
			label: "Address",
			value: [
				organization.address,
				[organization.city, organization.state].filter(Boolean).join(", "),
				organization.pincode,
			]
				.filter(Boolean)
				.join("\n"),
		},
	];

	return <FactList facts={facts} />;
}

/* -------------------------------------------------------------------------- */
/* About                                                                      */
/* -------------------------------------------------------------------------- */

function AboutTab({
	organization,
	withFacts,
}: {
	organization: Organization;
	/** Only on a phone — desktop draws the facts in the aside instead. */
	withFacts?: boolean;
}) {
	const { spacing } = useTheme();

	const hasProse =
		organization.description || organization.mission || organization.vision;

	return (
		<View style={{ gap: spacing[5] }}>
			{hasProse ? (
				<Surface>
					<View style={{ gap: spacing[4] }}>
						{organization.description ? (
							<Body>{organization.description}</Body>
						) : null}
						{organization.mission ? (
							<View style={{ gap: spacing[1] }}>
								<Label color="tertiary">Mission</Label>
								<Body color="secondary">{organization.mission}</Body>
							</View>
						) : null}
						{organization.vision ? (
							<View style={{ gap: spacing[1] }}>
								<Label color="tertiary">Vision</Label>
								<Body color="secondary">{organization.vision}</Body>
							</View>
						) : null}
					</View>
				</Surface>
			) : (
				<EmptyState
					icon={Newspaper}
					title="Nothing written yet"
					description="This NGO has not added a description of its work."
				/>
			)}

			{withFacts ? (
				<View>
					<SectionTitle>Details</SectionTitle>
					<OrgFacts organization={organization} />
				</View>
			) : null}
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

	const confirmDelete = async () => {
		const ok = await confirm({
			title: "Delete your review?",
			message:
				"It will be removed for everyone. You can write a new one later.",
			confirmLabel: "Delete",
			cancelLabel: "Keep it",
		});
		if (!ok) return;
		remove.mutate(undefined, {
			onSuccess: () => toast.success("Review deleted."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
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
			onError: (error) => toast.error(apiErrorMessage(error)),
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
