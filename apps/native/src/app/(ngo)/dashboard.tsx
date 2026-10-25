import type { PostTag } from "@nabhya/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
	Building2,
	CalendarDays,
	ChevronRight,
	FileText,
	HandCoins,
	HeartHandshake,
	type LucideIcon,
	Megaphone,
	PenLine,
	ShieldCheck,
	Star,
	UserPlus,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { EventFormSheet } from "@/components/event-form-sheet";
import { InitialAvatar } from "@/components/initial-avatar";
import { NeedFormSheet } from "@/components/need-form-sheet";
import { NotificationBell } from "@/components/notification-bell";
import { PostComposer } from "@/components/post-composer";
import {
	Banner,
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H3, H5, Label } from "@/components/ui/typography";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMyOrganization, useOrgOverview } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import {
	apiErrorMessage,
	engagementApi,
	orgEventsApi,
	orgNeedsApi,
	queryKeys,
} from "@/lib/api";
import { focusable } from "@/lib/focus";
import { orgVerificationCopy } from "@/lib/org-verification";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * The organisation's home tab, in the order a coordinator needs it:
 *
 * 1. Anything blocking them - verification, while it is not done.
 * 2. Anything waiting on them - pending applicants, pledges and unanswered
 *    reviews, with counts and a tap straight to where the decision is made.
 *    This answers "what needs me now", so it comes before the creation
 *    tiles on a phone too: it used to sit under them, a screen down on a
 *    small device, behind three buttons the coordinator had not come for.
 * 3. Anything they came here to *do* - post, ask for something, run an event.
 *    These open in place, not two navigations away.
 * 4. The numbers - each one a row that opens the list it counts, and public
 *    impact once verified.
 * 5. Whatever the surrounding chrome does not already offer.
 *
 * That last point is why the "Manage" list differs by platform, and it is not
 * an inconsistency: **the list holds what the navigation does not.** On desktop
 * the sidebar already carries nine destinations, so repeating them as an
 * eleven-row list was the same menu twice on one screen, and the two could
 * disagree. On mobile the tab bar carries five, so the other six have to live
 * somewhere and this is it.
 *
 * Everything is composed from `screen-shell`: a handful of surfaces, not
 * eighteen.
 */

const STICKY_ASIDE = {
	width: 340,
	flexShrink: 0,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

const DESKTOP_MAX_WIDTH = 1280;

export default function NgoDashboard() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const email = useAuthStore((s) => s.email);
	const orgQuery = useMyOrganization();
	const org = orgQuery.data;
	// No draft fallback: the onboarding draft is cleared the moment the
	// organisation is created, so by the time this screen renders the record is
	// the only source of the name.
	const orgName = org?.organizationName || "Your NGO";
	const status = org?.verificationStatus;
	const isVerified = status === "VERIFIED";

	// Whole-org counts from the server. These used to be summed from page 1
	// of the events and needs lists, which undercounted past 20 rows.
	const overviewQuery = useOrgOverview();
	const access = useOrgAccess();
	const impactQuery = useOrganizationImpact(isVerified ? org?.id : undefined);

	/* Creation, in place. Each sheet is the same one its own screen opens, so
	   there is one form per thing in the codebase and not two that drift. */
	const [composerTag, setComposerTag] = useState<PostTag | null>(null);
	const [needFormOpen, setNeedFormOpen] = useState(false);
	const [eventFormOpen, setEventFormOpen] = useState(false);

	const overview = overviewQuery.data;
	const pendingApplications = overview?.pendingApplications ?? 0;
	const eventsWithApplicants = overview?.eventsWithApplicants ?? 0;
	const pendingPledges = overview?.pendingPledges ?? 0;
	const needsWithPledges = overview?.needsWithPledges ?? 0;
	const openNeeds = overview?.openNeeds ?? 0;
	const publishedEvents = overview?.publishedEvents ?? 0;
	const draftEvents = overview?.draftEvents ?? 0;
	const followers = overview?.followers ?? 0;
	const waiting = pendingApplications + pendingPledges;

	/*
	 * "Applicants to review" should open the applicants, not a list of every
	 * event to hunt through. Neither list screen takes a status filter, but both
	 * take `?review=<id>` (the notification deep link), and the overview says
	 * how many parents the pending rows sit on. When that is one, find it on the
	 * first page and go straight to its sheet; when it is several, or the one
	 * is not on page 1, the list is still the honest destination - every row
	 * there carries its own "to review" count. Only fetched when it can help.
	 */
	const pendingEventQuery = useQuery({
		queryKey: queryKeys.orgEvents({ dashboard: "pending-lookup" }),
		queryFn: () => orgEventsApi.list({ page: 1, limit: 20 }),
		enabled: eventsWithApplicants === 1,
		select: (page) =>
			page.items.find((item) => (item.pendingApplications ?? 0) > 0)?.id,
	});
	const pendingNeedQuery = useQuery({
		queryKey: queryKeys.orgNeeds({ dashboard: "pending-lookup" }),
		queryFn: () => orgNeedsApi.list({ page: 1, limit: 20 }),
		enabled: needsWithPledges === 1,
		select: (page) =>
			page.items.find((item) => (item.pendingPledges ?? 0) > 0)?.id,
	});
	/*
	 * Reviews with no public reply. The overview does not count them, but the
	 * org's review list returns `awaitingReplyCount` for the whole org with
	 * any page, so one row is enough. Under the reviews scope, so a reply
	 * anywhere refreshes it. Gated on content.publish: a role that cannot
	 * reply has no decision to make here.
	 */
	const canReply = !access.blocked("content.publish");
	const reviewsQuery = useQuery({
		queryKey: queryKeys.orgReviews({ dashboard: "awaiting-count" }),
		queryFn: () =>
			engagementApi.listMyOrgReviews({ awaitingReply: true, limit: 1 }),
		enabled: canReply,
		select: (page) => page.awaitingReplyCount,
	});
	const awaitingReplies = canReply ? (reviewsQuery.data ?? 0) : 0;

	const pendingEventId =
		eventsWithApplicants === 1 ? pendingEventQuery.data : undefined;
	const pendingNeedId =
		needsWithPledges === 1 ? pendingNeedQuery.data : undefined;

	const refreshing =
		orgQuery.isRefetching ||
		overviewQuery.isRefetching ||
		impactQuery.isRefetching;

	const refetchAll = () => {
		orgQuery.refetch();
		overviewQuery.refetch();
		if (isVerified) impactQuery.refetch();
		if (canReply) reviewsQuery.refetch();
	};

	const impact = impactQuery.data;

	// The counts below all default to 0, so rendering during the first load told
	// an organisation with a dozen people waiting that it was "All caught up".
	// Wait for the queries that feed those numbers before drawing them.
	const isLoading = orgQuery.isLoading || overviewQuery.isLoading;
	const error = orgQuery.error ?? overviewQuery.error;

	/** Shared with `(ngo)/profile.tsx`, which draws the same banner and row. */
	const verificationCopy = orgVerificationCopy(status, org?.rejectionReason);

	// Each tile asks `useOrgAccess` the same question the server will: a post
	// and a need go public on creation, so they need verification as well as
	// the role; an event can be drafted first, so it needs only the role.
	const postBlocked = access.blocked("content.publish", { public: true });
	const needBlocked = postBlocked;
	const eventBlocked =
		access.isSuspended || access.role === "VIEWER"
			? access.blocked("content.publish")
			: null;
	const tileHint = (blocked: string | null, fallback: string) =>
		!blocked
			? fallback
			: !access.isVerified && !access.isSuspended
				? "Verify first"
				: "Ask an admin";
	const roleBlocked =
		access.isVerified && !access.isSuspended ? postBlocked : null;

	const verification = isVerified ? null : (
		<Banner
			tone={verificationCopy.tone}
			title={verificationCopy.title}
			description={verificationCopy.description}
			onPress={() => router.push("/(ngo)/verification")}
		/>
	);

	/*
	 * Three acts on one surface, hairline-divided - the same language as
	 * `MetricRow`, so the page reads as two rows of one thing rather than a
	 * card wall. A post and a need both go public the moment they are created
	 * (the API checks verification on the post, its upload-intent route and
	 * the need), so those two tiles share one gate; only an event can be
	 * drafted before verification, so its tile asks for the role alone.
	 */
	const quickActions = (
		<View>
			<SectionTitle>Create</SectionTitle>
			<Surface padded={false}>
				<View style={{ flexDirection: "row" }}>
					<ActionTile
						icon={PenLine}
						label="Post"
						hint={tileHint(postBlocked, "Share news")}
						disabled={!!postBlocked}
						first
						onPress={() => setComposerTag("POST")}
					/>
					<ActionTile
						icon={HeartHandshake}
						label="Need"
						hint={tileHint(needBlocked, "Ask for items")}
						disabled={!!needBlocked}
						onPress={() => setNeedFormOpen(true)}
					/>
					<ActionTile
						icon={CalendarDays}
						label="Event"
						hint={tileHint(
							eventBlocked,
							access.isVerified ? "Call volunteers" : "Draft one",
						)}
						disabled={!!eventBlocked}
						onPress={() => setEventFormOpen(true)}
					/>
				</View>
			</Surface>
			{roleBlocked ? (
				<Caption color="tertiary" style={{ marginTop: spacing[2] }}>
					{roleBlocked}
				</Caption>
			) : null}
		</View>
	);

	const plural = (n: number, one: string, many = `${one}s`) =>
		`${n} ${n === 1 ? one : many}`;

	/*
	 * The three decisions, always all three, each with its number. They used
	 * to appear only when non-zero, so the section's shape changed with the
	 * data and "All caught up" said nothing about which of the three was
	 * clear. A zero now reads as a zero - muted, "Nothing waiting" - and the
	 * row still opens its list.
	 */
	const openApplicants = () =>
		router.push(
			pendingEventId
				? { pathname: "/(ngo)/my-events", params: { review: pendingEventId } }
				: "/(ngo)/my-events",
		);
	const openPledges = () =>
		router.push(
			pendingNeedId
				? { pathname: "/(ngo)/needs", params: { review: pendingNeedId } }
				: "/(ngo)/needs",
		);
	const openReviews = () =>
		router.push({ pathname: "/(ngo)/reviews", params: { show: "awaiting" } });

	const decisionItems: Array<{
		key: string;
		icon: LucideIcon;
		label: string;
		value: number;
		hint: string;
		onPress: () => void;
	}> = [
		{
			key: "applicants",
			icon: CalendarDays,
			label: "Applicants to review",
			value: pendingApplications,
			hint:
				pendingApplications > 0
					? `Across ${plural(eventsWithApplicants, "event")}`
					: "Nothing waiting",
			onPress: openApplicants,
		},
		{
			key: "pledges",
			icon: HeartHandshake,
			label: "Pledges to review",
			value: pendingPledges,
			hint:
				pendingPledges > 0
					? `On ${plural(needsWithPledges, "post")}`
					: "Nothing waiting",
			onPress: openPledges,
		},
		...(canReply
			? [
					{
						key: "reviews",
						icon: Star,
						label: "Reviews to answer",
						value: awaitingReplies,
						hint:
							awaitingReplies > 0
								? "Your reply shows publicly"
								: "Nothing waiting",
						onPress: openReviews,
					},
				]
			: []),
	];

	const decisions = (
		<View>
			<SectionTitle>
				{waiting + awaitingReplies === 0
					? "Needs your decision - all caught up"
					: "Needs your decision"}
			</SectionTitle>
			{isDesktop ? (
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					{decisionItems.map((item) => (
						<DecisionTile
							key={item.key}
							icon={item.icon}
							label={item.label}
							value={item.value}
							hint={item.hint}
							onPress={item.onPress}
						/>
					))}
				</View>
			) : (
				<ListGroup>
					{decisionItems.map((item) => (
						<ListRow
							key={item.key}
							icon={item.icon}
							label={item.label}
							hint={item.hint}
							value={
								<Count
									value={item.value}
									tone={item.value > 0 ? "warning" : "neutral"}
								/>
							}
							accessibilityLabel={`${item.label}: ${item.value}`}
							onPress={item.onPress}
						/>
					))}
				</ListGroup>
			)}
		</View>
	);

	// Each count is a row that opens the list it counts. Followers has no
	// list of its own, so it is a plain row with no press.
	const numbers = (
		<View>
			<SectionTitle>At a glance</SectionTitle>
			<ListGroup>
				<ListRow
					icon={CalendarDays}
					label="Published events"
					value={<Count value={publishedEvents} tone="neutral" />}
					accessibilityLabel={`${plural(publishedEvents, "published event")}. Open events`}
					onPress={() => router.push("/(ngo)/my-events")}
				/>
				<ListRow
					icon={PenLine}
					label="Draft events"
					hint={draftEvents > 0 ? "Only your team can see these" : undefined}
					value={<Count value={draftEvents} tone="neutral" />}
					accessibilityLabel={`${plural(draftEvents, "draft event")}. Open events`}
					onPress={() => router.push("/(ngo)/my-events")}
				/>
				<ListRow
					icon={HeartHandshake}
					label="Open needs"
					value={<Count value={openNeeds} tone="neutral" />}
					accessibilityLabel={`${plural(openNeeds, "open need")}. Open needs`}
					onPress={() => router.push("/(ngo)/needs")}
				/>
				<ListRow
					icon={UserPlus}
					label="Followers"
					hint="Volunteers who see your posts in Following"
					value={<Count value={followers} tone="neutral" chevron={false} />}
					accessibilityLabel={`${followers} followers`}
					chevron={false}
				/>
			</ListGroup>
		</View>
	);

	const impactBlock =
		isVerified && impact ? (
			<View>
				<SectionTitle>Your impact</SectionTitle>
				<MetricRow
					stats={[
						{ label: "Events hosted", value: impact.eventsHosted ?? 0 },
						{
							label: "Volunteers engaged",
							value: impact.volunteersEngaged ?? 0,
						},
						{ label: "Volunteer hours", value: impact.volunteerHours ?? 0 },
						{
							label: "Certificates issued",
							value: impact.certificatesIssued ?? 0,
						},
						{ label: "Needs fulfilled", value: impact.needsFulfilled ?? 0 },
						{ label: "Items received", value: impact.itemsReceived ?? 0 },
					]}
				/>
			</View>
		) : null;

	const verificationRow = (
		<ListRow
			icon={ShieldCheck}
			label="Verification"
			value={<Caption color="tertiary">{verificationCopy.label}</Caption>}
			onPress={() => router.push("/(ngo)/verification")}
		/>
	);

	// The public page 404s until the NGO is verified and active - there is
	// nothing public to show yet - so the row says so instead of opening it.
	const publicProfileRow = org ? (
		<ListRow
			icon={Building2}
			label="Your public page"
			hint={
				isVerified && !access.isSuspended
					? "Exactly what a volunteer or donor sees"
					: "Goes live once you're verified"
			}
			onPress={
				isVerified && !access.isSuspended
					? () => router.push(`/ngos/${org.id}`)
					: undefined
			}
		/>
	) : null;

	/**
	 * What the chrome does not already offer. Desktop: the sidebar has the nine
	 * destinations, so only these are missing. Mobile: the tab bar has five, so
	 * the rest belong here.
	 */
	const manage = (
		<View>
			<SectionTitle>{isDesktop ? "Also here" : "Manage"}</SectionTitle>
			<ListGroup>
				{isDesktop
					? [verificationRow, publicProfileRow]
					: [
							<ListRow
								key="updates"
								icon={Megaphone}
								label="Updates"
								hint="Announcements on your public profile"
								onPress={() => router.push("/(ngo)/announcements")}
							/>,
							<ListRow
								key="reviews"
								icon={Star}
								label="Reviews"
								hint="Read and reply publicly"
								onPress={() => router.push("/(ngo)/reviews")}
							/>,
							<ListRow
								key="donations"
								icon={HandCoins}
								label="Donations"
								hint="Money received through Nabhya"
								onPress={() => router.push("/(ngo)/donations")}
							/>,
							<ListRow
								key="reports"
								icon={FileText}
								label="Reports"
								hint="Annual reports and audited statements"
								onPress={() => router.push("/(ngo)/reports")}
							/>,
							<ListRow
								key="team"
								icon={Users}
								label="Team"
								hint="Who can act for your NGO"
								onPress={() => router.push("/(ngo)/team")}
							/>,
							verificationRow,
							publicProfileRow,
						]}
			</ListGroup>
		</View>
	);

	const sheets = (
		<>
			<PostComposer
				key={composerTag ?? "POST"}
				visible={!!composerTag}
				onClose={() => setComposerTag(null)}
				{...(composerTag ? { initialTag: composerTag } : {})}
			/>
			<NeedFormSheet
				visible={needFormOpen}
				onClose={() => setNeedFormOpen(false)}
				defaultCity={org?.city}
				defaultState={org?.state}
			/>
			<EventFormSheet
				visible={eventFormOpen}
				event={null}
				onClose={() => setEventFormOpen(false)}
				defaultCity={org?.city}
				defaultState={org?.state}
			/>
		</>
	);

	const body = isLoading ? (
		<LoadingState />
	) : error ? (
		<ErrorState message={apiErrorMessage(error)} onRetry={refetchAll} />
	) : isDesktop ? (
		/*
		 * The decisions run the full width as three tiles, each with its
		 * number - the first thing a coordinator reads, and comparable at a
		 * glance. Under them, two columns: the counts and the public impact
		 * on the left, creation and the leftover destinations in the aside,
		 * where they do not push the numbers below the fold.
		 */
		<View
			style={{
				width: "100%",
				maxWidth: DESKTOP_MAX_WIDTH,
				alignSelf: "center",
				gap: spacing[6],
			}}
		>
			{verification}
			{decisions}
			<View style={{ flexDirection: "row", gap: spacing[6] }}>
				<View style={{ flex: 1, minWidth: 0, gap: spacing[6] }}>
					{numbers}
					{impactBlock}
				</View>
				<View style={[STICKY_ASIDE, { gap: spacing[6] }]}>
					{quickActions}
					{manage}
				</View>
			</View>
		</View>
	) : (
		<>
			{verification}
			{decisions}
			{quickActions}
			{numbers}
			{impactBlock}
			{manage}
		</>
	);

	return (
		<Screen>
			<ScreenHeader
				title="Dashboard"
				subtitle={orgName}
				// The rail carries Notifications on desktop; a phone has only the
				// tab bar, which has no room for a sixth tab.
				action={
					isDesktop ? (
						<InitialAvatar name={orgName || email} square />
					) : (
						<NotificationBell />
					)
				}
			/>

			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[12], gap: spacing[6] }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refetchAll}
						tintColor={colors.text.quaternary as string}
					/>
				}
			>
				{body}
			</ScrollView>

			{sheets}
		</Screen>
	);
}

/**
 * One creation act. Icon over label over consequence - three lines is enough
 * to distinguish "ask for items" from "call volunteers", which is the choice
 * a new coordinator actually finds hard.
 *
 * The icon sits in the brand tint rather than on it: `primary.main` is a fill
 * and fails AA for a glyph, so the well is `primary.tint` and the mark is
 * `primary.ink`.
 */
function ActionTile({
	icon: Icon,
	label,
	hint,
	disabled,
	first,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	hint: string;
	disabled?: boolean;
	/** Suppresses the leading hairline on the first tile in the row. */
	first?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={`${label}. ${hint}`}
			accessibilityState={{ disabled: !!disabled }}
			{...focusable}
			style={({ pressed, hovered }) => ({
				flex: 1,
				alignItems: "center",
				gap: spacing[1.5],
				paddingVertical: spacing[4],
				paddingHorizontal: spacing[2],
				borderLeftWidth: first ? 0 : 1,
				borderLeftColor: colors.border.hairline,
				backgroundColor:
					pressed || hovered ? colors.background.subtle : "transparent",
				opacity: disabled ? 0.45 : 1,
			})}
		>
			<View
				style={{
					width: 36,
					height: 36,
					borderRadius: borderRadius.md,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.primary.tint,
				}}
			>
				<Icon size={18} color={colors.primary.ink as string} strokeWidth={2} />
			</View>
			<Label weight="semibold" numberOfLines={1}>
				{label}
			</Label>
			<Caption color="quaternary" numberOfLines={1}>
				{hint}
			</Caption>
		</Pressable>
	);
}

/**
 * A count that reads as a count, not as a badge competing with the label.
 * Warning ink for work waiting on the reader; neutral for a plain tally.
 */
function Count({
	value,
	tone = "warning",
	chevron = true,
}: {
	value: number;
	tone?: "warning" | "neutral";
	/** Off for a row that opens nothing. */
	chevron?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
			}}
		>
			<H5 color={tone === "warning" ? colors.warning.ink : undefined}>
				{value}
			</H5>
			{chevron && (
				<ChevronRight
					size={16}
					strokeWidth={1.75}
					color={colors.text.quaternary as string}
				/>
			)}
		</View>
	);
}

/**
 * One decision on desktop: what it is, how many, and where they sit - the
 * whole tile opens the list. The number takes warning ink only when there is
 * something to do, so three tiles reading 0 are three quiet tiles and one
 * reading 4 is the one the eye lands on.
 */
function DecisionTile({
	icon: Icon,
	label,
	value,
	hint,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	value: number;
	hint: string;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View style={{ flex: 1, minWidth: 0 }}>
			<Surface onPress={onPress}>
				<View style={{ gap: spacing[2] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
						}}
					>
						<Icon
							size={16}
							strokeWidth={2}
							color={colors.text.quaternary as string}
						/>
						<Caption
							color="secondary"
							weight="medium"
							numberOfLines={1}
							style={{ flex: 1 }}
						>
							{label}
						</Caption>
						<ChevronRight
							size={16}
							strokeWidth={1.75}
							color={colors.text.quaternary as string}
						/>
					</View>
					<H3 color={value > 0 ? (colors.warning.ink as string) : "quaternary"}>
						{value}
					</H3>
					<Caption color="tertiary" numberOfLines={1}>
						{hint}
					</Caption>
				</View>
			</Surface>
		</View>
	);
}
