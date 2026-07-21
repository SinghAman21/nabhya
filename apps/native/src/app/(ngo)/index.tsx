import { router } from "expo-router";
import { CalendarDays, HeartHandshake, Users } from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader, Surface } from "@/components/screen-shell";
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useOrgEvents } from "@/hooks/use-events";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/useTheme";
import { formatDateRange } from "@/lib/format";

export default function NgoDashboard() {
	const { colors, spacing } = useTheme();

	const orgQuery = useMyOrganization();
	const eventsQuery = useOrgEvents({});
	const needsQuery = useOrgNeeds({});

	const organization = orgQuery.data;
	const events = eventsQuery.data?.items ?? [];
	const needs = needsQuery.data?.items ?? [];

	const pendingApplications = events.reduce(
		(sum, event) => sum + event.pendingApplications,
		0,
	);
	const pendingPledges = needs.reduce(
		(sum, need) => sum + need.pendingPledges,
		0,
	);
	const toReview = pendingApplications + pendingPledges;

	const upcoming = events
		.filter((event) => event.status === "PUBLISHED")
		.slice(0, 3);

	const refreshing =
		orgQuery.isRefetching ||
		eventsQuery.isRefetching ||
		needsQuery.isRefetching;
	const refetchAll = () => {
		orgQuery.refetch();
		eventsQuery.refetch();
		needsQuery.refetch();
	};

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.background.warm }}
			contentContainerStyle={{
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
				paddingBottom: spacing[10],
			}}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={refetchAll}
					tintColor={colors.primary.main as string}
				/>
			}
		>
			<ScreenHeader
				title={organization?.organizationName ?? "Dashboard"}
				subtitle="Here's how your organization is doing."
				action={
					organization ? (
						<StatusPill
							label={humanizeStatus(
								organization.verificationStatus ?? "PENDING",
							)}
							tone={verificationTone(organization.verificationStatus)}
						/>
					) : undefined
				}
			/>

			{organization && organization.verificationStatus !== "VERIFIED" && (
				<Surface
					style={{
						marginBottom: spacing[4],
						backgroundColor: colors.warning.bg,
						borderColor: colors.warning.main,
					}}
				>
					<Body weight="bold" color={colors.warning.dark as string}>
						{organization.verificationStatus === "REJECTED"
							? "Verification was rejected"
							: "Verification pending"}
					</Body>
					<Caption color="secondary">
						{organization.verificationStatus === "REJECTED"
							? (organization.rejectionReason ??
								"Submit updated documents from the Profile tab to re-open review.")
							: "Submit your legal documents from the Profile tab — publishing unlocks once you're verified."}
					</Caption>
				</Surface>
			)}

			{toReview > 0 && (
				<Surface
					onPress={() =>
						router.navigate(
							pendingApplications >= pendingPledges
								? "/(ngo)/events"
								: "/(ngo)/needs",
						)
					}
					style={{ marginBottom: spacing[4] }}
				>
					<Body weight="bold">
						{toReview} response{toReview === 1 ? "" : "s"} waiting for review
					</Body>
					<Caption color="tertiary">
						{pendingApplications > 0
							? `${pendingApplications} event application${pendingApplications === 1 ? "" : "s"}`
							: ""}
						{pendingApplications > 0 && pendingPledges > 0 ? " · " : ""}
						{pendingPledges > 0
							? `${pendingPledges} pledge${pendingPledges === 1 ? "" : "s"}`
							: ""}
					</Caption>
				</Surface>
			)}

			<View
				style={{
					flexDirection: "row",
					gap: spacing[3],
					marginBottom: spacing[4],
				}}
			>
				<StatTile
					icon={
						<CalendarDays size={18} color={colors.primary.main as string} />
					}
					value={eventsQuery.data?.meta.total}
					label="Events"
					onPress={() => router.navigate("/(ngo)/events")}
				/>
				<StatTile
					icon={
						<HeartHandshake size={18} color={colors.primary.main as string} />
					}
					value={needsQuery.data?.meta.total}
					label="Needs posted"
					onPress={() => router.navigate("/(ngo)/needs")}
				/>
				<StatTile
					icon={<Users size={18} color={colors.primary.main as string} />}
					value={events.reduce((sum, event) => sum + event.acceptedCount, 0)}
					label="Volunteers"
					onPress={() => router.navigate("/(ngo)/events")}
				/>
			</View>

			<H2 style={{ marginBottom: spacing[3] }}>Upcoming events</H2>
			{upcoming.length === 0 ? (
				<Surface>
					<Caption color="tertiary">
						No published events yet. Create one from the Events tab and
						volunteers will find it on the public feed.
					</Caption>
				</Surface>
			) : (
				upcoming.map((event, index) => (
					<Surface
						key={event.id}
						onPress={() => router.navigate("/(ngo)/events")}
						style={{ marginTop: index === 0 ? 0 : spacing[3] }}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: spacing[2],
							}}
						>
							<Body weight="bold" numberOfLines={1} style={{ flex: 1 }}>
								{event.title}
							</Body>
							<StatusPill
								label={humanizeStatus(event.status)}
								tone={eventStatusTone(event.status)}
							/>
						</View>
						<Caption color="tertiary" style={{ marginTop: 2 }}>
							{formatDateRange(event.startAt, event.endAt)}
							{event.city ? ` · ${event.city}` : ""}
						</Caption>
						<Caption color="secondary" style={{ marginTop: spacing[2] }}>
							{event.acceptedCount} of {event.volunteersNeeded} volunteers
							confirmed
							{event.pendingApplications > 0
								? ` · ${event.pendingApplications} to review`
								: ""}
						</Caption>
					</Surface>
				))
			)}
		</ScrollView>
	);
}

function StatTile({
	icon,
	value,
	label,
	onPress,
}: {
	icon: React.ReactNode;
	value: number | undefined;
	label: string;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ flex: 1 }}>
			<Surface onPress={onPress}>
				{icon}
				<Body weight="bold" style={{ marginTop: spacing[2], fontSize: 20 }}>
					{value ?? "—"}
				</Body>
				<Caption color="tertiary">{label}</Caption>
			</Surface>
		</View>
	);
}
