import type { PostTag } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	Building2,
	CalendarDays,
	FileText,
	HandCoins,
	HeartHandshake,
	type LucideIcon,
	Megaphone,
	PenLine,
	ShieldCheck,
	Star,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { EventFormSheet } from "@/components/event-form-sheet";
import { InitialAvatar } from "@/components/initial-avatar";
import { NeedFormSheet } from "@/components/need-form-sheet";
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
import { Caption, H5, Label } from "@/components/ui/typography";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useOrgEvents } from "@/hooks/use-events";
import { useMyTeamRole } from "@/hooks/use-my-team-role";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { orgVerificationCopy } from "@/lib/org-verification";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * The organisation's home tab, in the order a coordinator needs it:
 *
 * 1. Anything blocking them — verification, while it is not done.
 * 2. Anything they came here to *do* — post, ask for something, run an event.
 *    A dashboard that only reports is a wall the coordinator has to walk
 *    around; these are the three creation acts in the product and they open
 *    in place, not two navigations away.
 * 3. Anything waiting on them — pending applicants and pledges, with counts
 *    and a tap straight to the screen where the decision is made.
 * 4. The numbers — one `MetricRow`, and public impact once verified.
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
	width: 320,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

const DESKTOP_MAX_WIDTH = 1080;

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

	// Page-1 lists carry the per-row pending counts; summing them gives the
	// "needs your attention" figure without a dedicated endpoint.
	const eventsQuery = useOrgEvents();
	const needsQuery = useOrgNeeds();
	const impactQuery = useOrganizationImpact(isVerified ? org?.id : undefined);

	/* Creation, in place. Each sheet is the same one its own screen opens, so
	   there is one form per thing in the codebase and not two that drift. */
	const [composerTag, setComposerTag] = useState<PostTag | null>(null);
	const [needFormOpen, setNeedFormOpen] = useState(false);
	const [eventFormOpen, setEventFormOpen] = useState(false);

	const events = eventsQuery.data?.items ?? [];
	const needs = needsQuery.data?.items ?? [];
	const pendingApplications = events.reduce(
		(sum, event) => sum + (event.pendingApplications ?? 0),
		0,
	);
	const eventsWithApplicants = events.filter(
		(event) => (event.pendingApplications ?? 0) > 0,
	).length;
	const pendingPledges = needs.reduce(
		(sum, need) => sum + (need.pendingPledges ?? 0),
		0,
	);
	const needsWithPledges = needs.filter(
		(need) => (need.pendingPledges ?? 0) > 0,
	).length;
	const openNeeds = needs.filter((need) => need.status === "OPEN").length;
	const publishedEvents = events.filter(
		(event) => event.status === "PUBLISHED",
	).length;
	const waiting = pendingApplications + pendingPledges;

	const refreshing =
		orgQuery.isRefetching ||
		eventsQuery.isRefetching ||
		needsQuery.isRefetching ||
		impactQuery.isRefetching;

	const refetchAll = () => {
		orgQuery.refetch();
		eventsQuery.refetch();
		needsQuery.refetch();
		if (isVerified) impactQuery.refetch();
	};

	const impact = impactQuery.data;

	// The counts below all default to 0, so rendering during the first load told
	// an organisation with a dozen people waiting that it was "All caught up".
	// Wait for the queries that feed those numbers before drawing them.
	const isLoading =
		orgQuery.isLoading || eventsQuery.isLoading || needsQuery.isLoading;
	const error = orgQuery.error ?? eventsQuery.error ?? needsQuery.error;

	/** Shared with `(ngo)/profile.tsx`, which draws the same banner and row. */
	const verificationCopy = orgVerificationCopy(status, org?.rejectionReason);

	// Creating posts, needs and events is `content.publish`: owners, admins
	// and managers. Allowed while the role is still resolving so permitted
	// authors never see a flicker of denial; the server still 403s anything
	// the role cannot do.
	const teamRole = useMyTeamRole();
	const canPublish = teamRole.isLoading
		? true
		: teamRole.can("content.publish");
	const publishGateHint =
		!teamRole.isLoading && !canPublish ? "Ask an admin" : null;

	const verification = isVerified ? null : (
		<Banner
			tone={verificationCopy.tone}
			title={verificationCopy.title}
			description={verificationCopy.description}
			onPress={() => router.push("/(ngo)/verification")}
		/>
	);

	/*
	 * Three acts on one surface, hairline-divided — the same language as
	 * `MetricRow`, so the page reads as two rows of one thing rather than a
	 * card wall. Posting needs a verified org (the API enforces it on both the
	 * post and the upload-intent route); needs and events can be drafted
	 * before that, so only the first tile is gated.
	 */
	const quickActions = (
		<View>
			<SectionTitle>Create</SectionTitle>
			<Surface padded={false}>
				<View style={{ flexDirection: "row" }}>
					<ActionTile
						icon={PenLine}
						label="Post"
						hint={
							isVerified
								? (publishGateHint ?? "Share an update")
								: "Verify first"
						}
						disabled={!isVerified || !canPublish}
						first
						onPress={() => setComposerTag("POST")}
					/>
					<ActionTile
						icon={HeartHandshake}
						label="Need"
						hint={publishGateHint ?? "Ask for items"}
						disabled={!canPublish}
						onPress={() => setNeedFormOpen(true)}
					/>
					<ActionTile
						icon={CalendarDays}
						label="Event"
						hint={publishGateHint ?? "Call volunteers"}
						disabled={!canPublish}
						onPress={() => setEventFormOpen(true)}
					/>
				</View>
			</Surface>
			{publishGateHint ? (
				<Caption color="tertiary" style={{ marginTop: spacing[2] }}>
					Your role doesn't allow publishing. {publishGateHint} to post.
				</Caption>
			) : null}
		</View>
	);

	const decisions = (
		<View>
			<SectionTitle>Needs your decision</SectionTitle>
			{waiting === 0 ? (
				<Surface>
					<H5>All caught up</H5>
					<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
						New applicants and pledges will appear here for review.
					</Caption>
				</Surface>
			) : (
				<ListGroup>
					{pendingApplications > 0 && (
						<ListRow
							icon={CalendarDays}
							label={`${pendingApplications} applicant${pendingApplications === 1 ? "" : "s"} to review`}
							hint={`Across ${eventsWithApplicants} event${eventsWithApplicants === 1 ? "" : "s"}`}
							value={<Count value={pendingApplications} />}
							onPress={() => router.push("/(ngo)/events")}
						/>
					)}
					{pendingPledges > 0 && (
						<ListRow
							icon={HeartHandshake}
							label={`${pendingPledges} pledge${pendingPledges === 1 ? "" : "s"} to review`}
							hint={`On ${needsWithPledges} post${needsWithPledges === 1 ? "" : "s"} — people offering what you asked for`}
							value={<Count value={pendingPledges} />}
							onPress={() => router.push("/(ngo)/needs")}
						/>
					)}
				</ListGroup>
			)}
		</View>
	);

	const numbers = (
		<View>
			<SectionTitle>At a glance</SectionTitle>
			<MetricRow
				stats={[
					{ label: "Published events", value: publishedEvents },
					{ label: "Open needs", value: openNeeds },
					{
						label: "Waiting on you",
						value: waiting,
						...(waiting > 0 ? { tone: "warning" as const } : {}),
					},
				]}
			/>
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

	const publicProfileRow = org ? (
		<ListRow
			icon={Building2}
			label="Your public page"
			hint="Exactly what a volunteer or donor sees"
			onPress={() => router.push(`/ngos/${org.id}`)}
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
		 * Two columns, capped and centred. The decisions and the numbers are
		 * what a coordinator scans; creation and the leftover destinations are
		 * what they reach for, so they sit in the narrow aside where they do not
		 * push the numbers below the fold.
		 */
		<View
			style={{
				width: "100%",
				maxWidth: DESKTOP_MAX_WIDTH,
				alignSelf: "center",
				flexDirection: "row",
				gap: spacing[6],
			}}
		>
			<View style={{ flex: 1, gap: spacing[6] }}>
				{verification}
				{decisions}
				{numbers}
				{impactBlock}
			</View>
			<View style={[STICKY_ASIDE, { gap: spacing[6] }]}>
				{quickActions}
				{manage}
			</View>
		</View>
	) : (
		<>
			{verification}
			{quickActions}
			{decisions}
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
				action={<InitialAvatar name={orgName || email} square />}
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
 * One creation act. Icon over label over consequence — three lines is enough
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

/** A count that reads as a count, not as a badge competing with the label. */
function Count({ value }: { value: number }) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
			}}
		>
			<H5 color={colors.warning.ink}>{value}</H5>
			<View
				style={{
					width: 7,
					height: 7,
					borderRightWidth: 1.5,
					borderTopWidth: 1.5,
					borderColor: colors.text.quaternary as string,
					transform: [{ rotate: "45deg" }],
				}}
			/>
		</View>
	);
}
