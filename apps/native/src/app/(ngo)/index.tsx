import { useRouter } from "expo-router";
import {
	Building2,
	CalendarDays,
	FileText,
	HandCoins,
	HeartHandshake,
	Megaphone,
	PenLine,
	ShieldCheck,
	Star,
	Users,
} from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
import { InitialAvatar } from "@/components/initial-avatar";
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
import { Caption, H5 } from "@/components/ui/typography";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useOrgEvents } from "@/hooks/use-events";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/**
 * The organisation's home tab, in the order a coordinator needs it:
 *
 * 1. Anything blocking them — verification, while it is not done.
 * 2. Anything waiting on them — pending applicants and pledges, with counts
 *    and a tap straight to the screen where the decision is made.
 * 3. The numbers — one `MetricRow`, and public impact once verified.
 * 4. Everything else — one grouped list into the management screens, so no
 *    feature hangs off the Profile tab alone.
 *
 * Everything is composed from `screen-shell`: three surfaces, not eighteen.
 */
export default function NgoDashboard() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const storeProfile = useAuthStore((s) => s.orgProfile);

	const orgQuery = useMyOrganization();
	const org = orgQuery.data;
	const orgName = org?.organizationName || storeProfile.orgName || "Your NGO";
	const status = org?.verificationStatus;
	const isVerified = status === "VERIFIED";

	// Page-1 lists carry the per-row pending counts; summing them gives the
	// "needs your attention" figure without a dedicated endpoint.
	const eventsQuery = useOrgEvents();
	const needsQuery = useOrgNeeds();
	const impactQuery = useOrganizationImpact(isVerified ? org?.id : undefined);

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

	const verification = isVerified ? null : (
		<Banner
			tone={
				status === "REJECTED"
					? "error"
					: status === "UNDER_REVIEW"
						? "info"
						: "warning"
			}
			title={
				status === "REJECTED"
					? "Verification was not approved"
					: status === "UNDER_REVIEW"
						? "Verification under review"
						: "Get verified to go public"
			}
			description={
				status === "REJECTED"
					? (org?.rejectionReason ??
						"See the reviewer's notes and upload corrected documents.")
					: status === "UNDER_REVIEW"
						? "A reviewer is checking your documents. Usually a few days."
						: "Upload your registration certificate and PAN card. Until then, events and needs stay private."
			}
			onPress={() => router.push("/(ngo)/verification")}
		/>
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

	const manage = (
		<View>
			<SectionTitle>Manage</SectionTitle>
			<ListGroup>
				<ListRow
					icon={HeartHandshake}
					label="Needs"
					hint={`${openNeeds} open · post requests and review pledges`}
					onPress={() => router.push("/(ngo)/needs")}
				/>
				<ListRow
					icon={CalendarDays}
					label="Events"
					hint={`${publishedEvents} published · create and review applicants`}
					onPress={() => router.push("/(ngo)/events")}
				/>
				<ListRow
					icon={Megaphone}
					label="Updates"
					hint="Announcements on your public profile"
					onPress={() => router.push("/(ngo)/announcements")}
				/>
				<ListRow
					icon={PenLine}
					label="Feed"
					hint="See other NGOs' posts"
					onPress={() => router.push("/feed")}
				/>
				<ListRow
					icon={Star}
					label="Reviews"
					hint="Read and reply publicly"
					onPress={() => router.push("/(ngo)/reviews")}
				/>
				<ListRow
					icon={HandCoins}
					label="Donations"
					hint="Money received through Nabhya"
					onPress={() => router.push("/(ngo)/donations")}
				/>
				<ListRow
					icon={FileText}
					label="Reports"
					hint="Annual reports and audited statements"
					onPress={() => router.push("/(ngo)/reports")}
				/>
				<ListRow
					icon={Users}
					label="Team"
					hint="Who can act for your NGO"
					onPress={() => router.push("/(ngo)/team")}
				/>
				<ListRow
					icon={ShieldCheck}
					label="Verification"
					value={
						<Caption color="tertiary">
							{isVerified
								? "Verified"
								: status === "UNDER_REVIEW"
									? "Under review"
									: status === "REJECTED"
										? "Action needed"
										: "Not started"}
						</Caption>
					}
					onPress={() => router.push("/(ngo)/verification")}
				/>
				<ListRow
					icon={Building2}
					label="Profile"
					hint="What volunteers and donors see"
					onPress={() => router.push("/(ngo)/profile")}
				/>
			</ListGroup>
		</View>
	);

	return (
		<Screen>
			<ScreenHeader
				title="Dashboard"
				subtitle={orgName}
				action={<InitialAvatar name={orgName || email} square />}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[12], gap: spacing[6] }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refetchAll}
						tintColor={colors.text.quaternary as string}
					/>
				}
			>
				{isLoading ? (
					<LoadingState />
				) : error ? (
					<ErrorState message={apiErrorMessage(error)} onRetry={refetchAll} />
				) : (
					<>
						{verification}
						{decisions}
						{numbers}
						{impactBlock}
						{manage}
					</>
				)}
			</ScrollView>
		</Screen>
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
