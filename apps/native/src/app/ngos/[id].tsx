import { formatFinancialYear } from "@nabhya/shared";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	Bookmark,
	FileText,
	MessageSquare,
	Newspaper,
	ShieldCheck,
	Star,
} from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/back-button";
import { DonateSheet } from "@/components/donate-sheet";
import { InitialAvatar } from "@/components/initial-avatar";
import { OrgLogo } from "@/components/org-branding";
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
import {
	Body,
	Caption,
	H3,
	H4,
	Label,
	Title,
} from "@/components/ui/typography";
import {
	useFinancialReports,
	useOrganization,
	useOrganizationImpact,
	usePublicTeam,
} from "@/hooks/use-directory";
import { useOpenDocument } from "@/hooks/use-documents";
import {
	useDeleteMyReview,
	useMyReview,
	useToggleBookmark,
	useToggleFollow,
} from "@/hooks/use-engagement";
import { useMe } from "@/hooks/use-profile";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
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
import { signInAndReturn } from "@/lib/return-to";
import { verticalScrollbar } from "@/lib/scroll";
import type { ReviewItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * An NGO's public page - the one screen a volunteer or donor judges an
 * organisation by.
 *
 * ## Layout
 *
 * A hero, then two columns on desktop: what you read on the left, what you
 * *do* and look up on the right.
 *
 * The hero is the NGO's own branding - the cover band and logo it uploads on
 * `(ngo)/edit`, drawn through the same `OrgCover` / `OrgLogo` as its private
 * profile so the two cannot drift. Before this the page opened on a bare `H2`:
 * the organisation had somewhere to put a cover photo and a logo and nowhere
 * they appeared.
 *
 * On desktop the aside holds the actions and the registry facts, which does two
 * things. Donate stops being a bar welded to the bottom of a 1000pt window -
 * fine on a phone, odd on a desk - and the details stop being a `ListRow` list
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
	const { colors, spacing, borderRadius } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("about");
	const [reviewOpen, setReviewOpen] = useState(false);
	const [reviewBeingEdited, setReviewBeingEdited] = useState<Pick<
		ReviewItem,
		"id" | "rating" | "body"
	> | null>(null);
	const [donateOpen, setDonateOpen] = useState(false);

	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const org = useOrganization(id);
	const impact = useOrganizationImpact(id);
	const toggleBookmark = useToggleBookmark();
	const toggleFollow = useToggleFollow();
	// The detail carries the caller's own state (`viewer`); null when signed out.
	const bookmarked = !!org.data?.viewer?.bookmarked;
	const following = !!org.data?.viewer?.following;
	// Following and saving are volunteer acts on the server. A signed-out
	// visitor still sees them (they lead to sign-in); an NGO or admin account
	// browsing a peer's page does not, since every press would 403.
	const canEngage = !email || role === "volunteer";

	const requireSignIn = (next: () => void) => {
		if (!email) {
			void signInAndReturn(`/ngos/${id}`);
			return;
		}
		next();
	};

	// "Shortlist", the word Profile and `bookmarks.tsx` use - this page said
	// "Save", which is what the feed calls a different list. The toast says
	// where the shortlist lives, since nothing on this page leads there.
	const onBookmark = () =>
		requireSignIn(() => {
			const name = org.data?.organizationName ?? "This NGO";
			toggleBookmark.mutate(id, {
				onSuccess: () =>
					bookmarked
						? toast.success(`${name} removed from your shortlist.`, {
								label: "Undo",
								onPress: () => toggleBookmark.mutate(id),
							})
						: toast.success(`${name} added to your shortlist.`, {
								label: "View",
								onPress: () => router.push("/bookmarks"),
							}),
				onError: (error) => toast.error(apiErrorMessage(error)),
			});
		});

	const onFollow = () =>
		requireSignIn(() => {
			const name = org.data?.organizationName ?? "this NGO";
			toggleFollow.mutate(
				{ organizationId: id, following },
				{
					onSuccess: () =>
						following
							? toast.success(`Unfollowed ${name}.`, {
									label: "Undo",
									onPress: () =>
										toggleFollow.mutate({
											organizationId: id,
											following: false,
										}),
								})
							: toast.success(
									`Following ${name} - its posts show in your Following feed.`,
								),
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			);
		});

	const data = org.data;
	const gutter = spacing[5];
	const location = [data?.city, data?.state].filter(Boolean).join(", ");
	const verified = data?.verificationStatus === "VERIFIED";
	const name = data?.organizationName ?? "this NGO";

	const donateButton = (
		// No sign-in wall: guests give with a receipt email (optional-auth checkout).
		<Button
			onPress={() => setDonateOpen(true)}
			accessibilityLabel={`Donate to ${name}`}
		>
			Donate
		</Button>
	);

	// Outline in both states: Donate is the page's one filled action, and two
	// orange buttons side by side left neither of them primary.
	const followButton = canEngage ? (
		<Button
			variant="outline"
			size={isDesktop ? "default" : "sm"}
			onPress={onFollow}
			loading={toggleFollow.isPending}
			accessibilityLabel={
				following ? `Following ${name}. Tap to unfollow` : `Follow ${name}`
			}
			accessibilityState={{ selected: following }}
		>
			{following ? "Following" : "Follow"}
		</Button>
	) : null;

	const saveSize = isDesktop ? 48 : 38;
	const saveControl = !canEngage ? null : (
		<Pressable
			onPress={onBookmark}
			hitSlop={isDesktop ? 0 : 4}
			disabled={toggleBookmark.isPending}
			accessibilityRole="button"
			accessibilityLabel={
				bookmarked ? "Remove from your shortlist" : "Add to your shortlist"
			}
			accessibilityState={{
				selected: bookmarked,
				disabled: toggleBookmark.isPending,
			}}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as {
					pressed: boolean;
					hovered?: boolean;
				};
				return {
					width: saveSize,
					height: saveSize,
					borderRadius: borderRadius.lg,
					borderWidth: 1,
					borderColor: colors.border.medium,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor:
						pressed || hovered ? colors.background.tertiary : "transparent",
				};
			}}
		>
			<Bookmark
				size={18}
				strokeWidth={2}
				color={colors.text.primary as string}
				fill={bookmarked ? (colors.text.primary as string) : "transparent"}
			/>
		</Pressable>
	);

	const stats = [
		{ label: "Followers", value: data?.followerCount ?? 0 },
		{ label: "Volunteers", value: impact.data?.volunteersEngaged },
		// "Hours", not "Hours given": four columns on a 390pt phone cut the
		// longer label to "Hours giv…".
		{ label: "Hours", value: impact.data?.volunteerHours },
		{ label: "Events", value: impact.data?.eventsHosted },
	];

	const inset = isDesktop ? spacing[6] : spacing[4];

	/*
	 * The hero is one card: a cover band, the identity row, the stats.
	 *
	 * With no cover the band is a short neutral strip, not a tinted block: the
	 * old placeholder was `primary.tint` at full height, which in dark mode is a
	 * flat brown rectangle that read as a failed image. The logo sits *in* the
	 * identity row, on the card's own padding, instead of hanging half over the
	 * band - the overlap only works when there is a photo for it to sit on, and
	 * most NGOs have none.
	 */
	const hero = data ? (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<NgoCover
				imageKey={data.coverImage}
				height={data.coverImage ? (isDesktop ? 200 : 124) : isDesktop ? 72 : 48}
			/>
			<View style={{ padding: inset, gap: spacing[4] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: isDesktop ? "center" : "flex-start",
						gap: isDesktop ? spacing[5] : spacing[3.5],
					}}
				>
					<OrgLogo
						name={data.organizationName}
						imageKey={data.logo}
						size={isDesktop ? 80 : 60}
					/>
					<View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
						{isDesktop ? (
							<Title accessibilityRole="header" numberOfLines={2}>
								{data.organizationName}
							</Title>
						) : (
							<H3 accessibilityRole="header" numberOfLines={3}>
								{data.organizationName}
							</H3>
						)}
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								alignItems: "center",
								columnGap: spacing[3],
								rowGap: spacing[1],
							}}
						>
							{verified ? (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[1],
									}}
								>
									<ShieldCheck
										size={14}
										strokeWidth={2.2}
										color={colors.success.ink as string}
									/>
									<Caption weight="medium" color={colors.success.ink as string}>
										Verified NGO
									</Caption>
								</View>
							) : (
								<StatusPill
									label={humanizeStatus(data.verificationStatus)}
									tone={verificationTone(data.verificationStatus)}
								/>
							)}
							<Caption color="tertiary">
								{[
									location || null,
									data.foundingYear ? `Since ${data.foundingYear}` : null,
								]
									.filter(Boolean)
									.join(" · ")}
							</Caption>
						</View>
					</View>

					{isDesktop ? (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2],
							}}
						>
							{saveControl}
							{followButton}
							{donateButton}
						</View>
					) : null}
				</View>

				{isDesktop || !canEngage ? null : (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
						}}
					>
						<View style={{ flex: 1 }}>{followButton}</View>
						{saveControl}
					</View>
				)}

				{data.categories?.length ? (
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
					>
						{data.categories.map((category) => (
							<StatusPill key={category.id} label={category.name} />
						))}
					</View>
				) : null}
			</View>

			{/* Four figures in equal columns under one hairline. No dividers
			    between them: a `MetricRow` wraps on a phone and draws a rule
			    down the left edge of its second line. */}
			<View
				style={{
					flexDirection: "row",
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
					paddingHorizontal: inset,
					paddingVertical: spacing[4],
					gap: spacing[3],
				}}
			>
				{stats.map((stat) => (
					<View key={stat.label} style={{ flex: 1, minWidth: 0 }}>
						<H4 numberOfLines={1}>
							{stat.value === undefined ? "-" : String(stat.value)}
						</H4>
						<Caption color="tertiary" numberOfLines={1}>
							{stat.label}
						</Caption>
					</View>
				))}
			</View>
		</Surface>
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
					onWrite={(review) =>
						requireSignIn(() => {
							setReviewBeingEdited(review ?? null);
							setReviewOpen(true);
						})
					}
				/>
			)}
			{tab === "transparency" && <TransparencyTab organizationId={id} />}
		</>
	) : null;

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			{/* The back row says where you are, so the chevron is not a lone
			    glyph floating over the hero. */}
			<View
				style={{
					paddingTop: insets.top + spacing[2],
					paddingBottom: spacing[3],
					paddingHorizontal: gutter,
				}}
			>
				<View
					style={[
						PAGE,
						{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							minHeight: 40,
						},
					]}
				>
					<BackButton fallbackHref="/ngos" />
					<Caption color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
						{data ? `NGOs / ${data.organizationName}` : "NGOs"}
					</Caption>
				</View>
			</View>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError || !data ? (
				<ErrorState
					title="NGO not available"
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
										alignItems: "flex-start",
										gap: spacing[8],
										marginTop: spacing[6],
									}}
								>
									<View style={{ flex: MAIN_COLUMN, minWidth: 0 }}>
										{tabs}
										{panel}
									</View>
									<View
										style={{
											flex: ASIDE_COLUMN,
											minWidth: 0,
											gap: spacing[6],
										}}
									>
										<View>
											<SectionTitle>Details</SectionTitle>
											<OrgFacts organization={data} />
										</View>
										<Caption color="tertiary">
											Donations are collected by Nabhya and passed to the
											organisation. You get a receipt either way.
										</Caption>
									</View>
								</View>
							) : (
								<View style={{ marginTop: spacing[5] }}>
									{tabs}
									{panel}
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
				key={reviewBeingEdited?.id ?? "new-review"}
				organizationId={id}
				organizationName={data?.organizationName ?? ""}
				existingReview={reviewBeingEdited}
				visible={reviewOpen}
				onClose={() => {
					setReviewOpen(false);
					setReviewBeingEdited(null);
				}}
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

/**
 * The cover band, with a neutral fallback. `OrgCover` (shared with the NGO's
 * own editor) fills an empty band with the brand tint and an upload prompt,
 * which is right for the owner and wrong for a visitor.
 */
function NgoCover({
	imageKey,
	height,
}: {
	imageKey: string | null | undefined;
	height: number;
}) {
	const { colors } = useTheme();
	const url = useStoredImageUrl(imageKey);

	return (
		<View style={{ height, backgroundColor: colors.background.subtle }}>
			{url ? (
				<Image
					source={{ uri: url }}
					contentFit="cover"
					style={{ width: "100%", height: "100%" }}
					accessibilityIgnoresInvertColors
				/>
			) : null}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Facts                                                                      */
/* -------------------------------------------------------------------------- */

type Organization = NonNullable<ReturnType<typeof useOrganization>["data"]>;

/** The registration wizard's own labels; `humanizeStatus` printed "Section8". */
const ORG_TYPE_LABELS: Record<string, string> = {
	trust: "Trust",
	society: "Society",
	section8: "Section 8 company",
	others: "Other",
};

/**
 * The registry record. On desktop it lives in the aside; on a phone there is no
 * aside, so `AboutTab` renders it under the prose - one component either way so
 * the two placements cannot say different things.
 */
function OrgFacts({ organization }: { organization: Organization }) {
	const facts: Fact[] = [
		// A missing type is left out, not shown as "Unknown".
		{
			label: "Type",
			value: organization.orgType
				? (ORG_TYPE_LABELS[organization.orgType] ?? null)
				: null,
		},
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
	/** Only on a phone - desktop draws the facts in the aside instead. */
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

			{/* Secondary content: hides itself when empty or failed, so the
			    profile never breaks over it. */}
			<PublicTeamSection organizationId={organization.id} />

			{withFacts ? (
				<View>
					<SectionTitle>Details</SectionTitle>
					<OrgFacts organization={organization} />
				</View>
			) : null}
		</View>
	);
}

/**
 * The people an NGO chose to show publicly (`isPublic` members only).
 *
 * Team is secondary content: while loading it is a small inline spinner, on
 * error it stays silent, and when the list is empty the whole section hides
 * rather than announcing that nobody opted in. Rows match the Updates tab's
 * `ListGroup` language - avatar, name and designation with the role as a
 * pill (`info` for OWNER, `neutral` for everyone else).
 */
function PublicTeamSection({ organizationId }: { organizationId: string }) {
	const { colors, spacing } = useTheme();
	const team = usePublicTeam(organizationId);

	// A failed team fetch must never break the profile around it.
	if (team.isError) return null;
	const members = team.data ?? [];
	if (!team.isLoading && members.length === 0) return null;

	return (
		<View>
			<SectionTitle>Team</SectionTitle>
			<Caption color="tertiary" style={{ marginBottom: spacing[3] }}>
				People this NGO chose to show publicly.
			</Caption>
			{team.isLoading ? (
				<View
					style={{ paddingVertical: spacing[4], alignItems: "center" }}
					accessibilityRole="progressbar"
					accessibilityLabel="Loading team"
				>
					<ActivityIndicator color={colors.text.quaternary as string} />
				</View>
			) : (
				<ListGroup>
					{members.map((member, index) => {
						const role = member.role ?? "MEMBER";
						const subtitle = [
							member.designation,
							member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : null,
						]
							.filter(Boolean)
							.join(" · ");
						return (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: public rows carry no id
								key={`${member.fullName ?? "member"}-${member.joinedAt}-${index}`}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
									paddingHorizontal: spacing[4],
									paddingVertical: spacing[4],
								}}
							>
								<InitialAvatar name={member.fullName} />
								<View style={{ flex: 1, minWidth: 0 }}>
									<Body weight="bold" numberOfLines={1}>
										{member.fullName ?? "Team member"}
									</Body>
									{subtitle ? (
										<Caption color="tertiary" numberOfLines={1}>
											{subtitle}
										</Caption>
									) : null}
								</View>
								<StatusPill
									label={role}
									tone={role === "OWNER" ? "info" : "neutral"}
								/>
							</View>
						);
					})}
				</ListGroup>
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
	onWrite: (review?: Pick<ReviewItem, "id" | "rating" | "body">) => void;
}) {
	const { colors, spacing } = useTheme();
	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const me = useMe(!!email);
	const remove = useDeleteMyReview(organizationId);
	const canReview = role === "volunteer";
	const myReviewQuery = useMyReview(organizationId, canReview);

	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.reviews(organizationId, { limit: PAGE_SIZE }),
		fetchPage: (page) =>
			engagementApi.listReviews(organizationId, { page, limit: PAGE_SIZE }),
	});
	const summary = first?.summary;

	const myUserId = me.data?.id;
	const myReview = canReview ? (myReviewQuery.data ?? undefined) : undefined;
	const hasMine = !!myReview;

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
					{summary?.count ? (
						<View>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[1.5],
								}}
							>
								<H3>{summary.average.toFixed(1)}</H3>
								<Star
									size={16}
									color={colors.warning.ink}
									fill={colors.warning.ink}
								/>
							</View>
							<Caption color="tertiary">
								{summary.count} review{summary.count === 1 ? "" : "s"}
							</Caption>
						</View>
					) : (
						// "- ★ 0 reviews" read as a score of dash; say it plainly.
						<Body weight="medium" color="secondary">
							No ratings yet
						</Body>
					)}
					{!email || canReview ? (
						<Button
							size="sm"
							variant="outline"
							onPress={() => onWrite(myReview)}
							disabled={
								canReview && (myReviewQuery.isLoading || myReviewQuery.isError)
							}
							loading={canReview && myReviewQuery.isLoading}
						>
							{hasMine ? "Edit your review" : "Write a review"}
						</Button>
					) : null}
				</View>
			</Surface>

			{canReview && myReviewQuery.isError ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
						marginBottom: spacing[3],
					}}
				>
					<Caption color="error">
						Couldn't check whether you already reviewed this NGO.
					</Caption>
					<Button
						size="sm"
						variant="outline"
						onPress={() => void myReviewQuery.refetch()}
					>
						Retry
					</Button>
				</View>
			) : null}

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
											<Button
												size="sm"
												variant="outline"
												onPress={() => onWrite(review)}
											>
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
