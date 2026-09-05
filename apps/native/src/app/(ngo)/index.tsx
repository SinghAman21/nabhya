import { useRouter } from "expo-router";
import {
	CalendarDays,
	FileText,
	HeartHandshake,
	Megaphone,
	PenLine,
	Star,
	Users,
	Wallet,
} from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
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
} from "@/components/screen-shell";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useOrgEvents } from "@/hooks/use-events";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/**
 * The organization's home tab. Surfaces what needs a decision (pending
 * applicants and pledges), public impact once verified, and quick links into
 * the management screens that otherwise only hang off the Profile tab.
 *
 * Everything is composed from `screen-shell`: three surfaces, not eighteen. The
 * previous layout gave every stat and every link its own outlined card, so a
 * summary screen read as a grid of boxes with no order of importance.
 */
export default function NgoDashboard() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const storeProfile = useAuthStore((s) => s.orgProfile);

	const orgQuery = useMyOrganization();
	const org = orgQuery.data;
	const orgName = org?.organizationName || storeProfile.orgName || "Your NGO";
	const isVerified = org?.verificationStatus === "VERIFIED";

	// Page-1 lists carry the per-row pending counts; summing them gives the
	// "needs your attention" figure without a dedicated endpoint.
	const eventsQuery = useOrgEvents();
	const needsQuery = useOrgNeeds();
	const impactQuery = useOrganizationImpact(isVerified ? org?.id : undefined);

	const pendingApplications = (eventsQuery.data?.items ?? []).reduce(
		(sum, event) => sum + (event.pendingApplications ?? 0),
		0,
	);
	const pendingPledges = (needsQuery.data?.items ?? []).reduce(
		(sum, need) => sum + (need.pendingPledges ?? 0),
		0,
	);
	const openNeeds = (needsQuery.data?.items ?? []).filter(
		(need) => need.status === "OPEN",
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

	return (
		<Screen>
			<ScreenHeader
				title="Dashboard"
				subtitle={orgName}
				action={
					<View
						accessible
						accessibilityLabel={orgName}
						style={{
							width: 40,
							height: 40,
							borderRadius: 20,
							backgroundColor: colors.primary.main,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Label weight="bold" color={colors.primary.contrast as string}>
							{(orgName || email || "N")[0]?.toUpperCase()}
						</Label>
					</View>
				}
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
						{!isVerified && (
							<Banner
								tone="warning"
								title="Verification pending"
								description="Upload your legal documents from Profile to publish events, post needs and appear in the public directory."
								onPress={() => router.push("/(ngo)/profile")}
							/>
						)}

						{/* Anything waiting on the organiser goes first. */}
						<View>
							<SectionTitle>Needs your decision</SectionTitle>
							{waiting === 0 ? (
								<View style={{ paddingVertical: spacing[1] }}>
									<H5>All caught up</H5>
									<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
										Nothing is waiting on your review right now.
									</Caption>
								</View>
							) : (
								<ListGroup>
									{pendingApplications > 0 && (
										<ListRow
											label="Applicants to review"
											hint="Across your published events"
											value={<Count value={pendingApplications} />}
											onPress={() => router.push("/(ngo)/events")}
										/>
									)}
									{pendingPledges > 0 && (
										<ListRow
											label="Pledges to review"
											hint="People offering what you asked for"
											value={<Count value={pendingPledges} />}
											onPress={() => router.push("/(ngo)/needs")}
										/>
									)}
								</ListGroup>
							)}
						</View>

						<View>
							<SectionTitle>At a glance</SectionTitle>
							<MetricRow
								stats={[
									{ label: "Events", value: eventsQuery.data?.meta.total ?? 0 },
									{ label: "Open needs", value: openNeeds },
									{
										label: "Waiting on you",
										value: waiting,
										...(waiting > 0 ? { tone: "warning" as const } : {}),
									},
								]}
							/>
						</View>

						{isVerified && (
							<View>
								<SectionTitle>Your impact</SectionTitle>
								<MetricRow
									stats={[
										{
											label: "Events hosted",
											value: impact?.eventsHosted ?? 0,
										},
										{
											label: "Volunteers engaged",
											value: impact?.volunteersEngaged ?? 0,
										},
										{
											label: "Volunteer hours",
											value: impact?.volunteerHours ?? 0,
										},
										{
											label: "Certificates issued",
											value: impact?.certificatesIssued ?? 0,
										},
										{
											label: "Needs fulfilled",
											value: impact?.needsFulfilled ?? 0,
										},
										{
											label: "Items received",
											value: impact?.itemsReceived ?? 0,
										},
									]}
								/>
							</View>
						)}

						<View>
							<SectionTitle>Manage</SectionTitle>
							<ListGroup>
								<ListRow
									icon={PenLine}
									label="Share an update"
									hint="Post to every volunteer's feed"
									onPress={() => router.push("/feed")}
								/>
								<ListRow
									icon={CalendarDays}
									label="Events"
									hint="Create and review applicants"
									onPress={() => router.push("/(ngo)/events")}
								/>
								<ListRow
									icon={HeartHandshake}
									label="Needs and offers"
									hint="Post requests and review pledges"
									onPress={() => router.push("/(ngo)/needs")}
								/>
								<ListRow
									icon={Megaphone}
									label="Announcements"
									hint="Post updates to your followers"
									onPress={() => router.push("/(ngo)/announcements")}
								/>
								<ListRow
									icon={Star}
									label="Reviews"
									hint="Read and reply to reviews"
									onPress={() => router.push("/(ngo)/reviews")}
								/>
								<ListRow
									icon={Users}
									label="Team"
									hint="Manage who can act for your NGO"
									onPress={() => router.push("/(ngo)/team")}
								/>
								<ListRow
									icon={FileText}
									label="Financial reports"
									hint="Publish transparency documents"
									onPress={() => router.push("/(ngo)/reports")}
								/>
								<ListRow
									icon={Wallet}
									label="Donations"
									hint="Track received donations"
									onPress={() => router.push("/(ngo)/donations")}
								/>
							</ListGroup>
						</View>
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
