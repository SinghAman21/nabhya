import { useRouter } from "expo-router";
import {
	CalendarDays,
	HeartHandshake,
	Megaphone,
	ShieldCheck,
} from "lucide-react-native";
import { View } from "react-native";
import {
	ListGroup,
	ListRow,
	MetricRow,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Caption, H5 } from "@/components/ui/typography";
import { useOrgEvents } from "@/hooks/use-events";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";

/**
 * The third column on NGO desktop: sidebar, feed, then this.
 *
 * The coordinator's peripheral vision — what's waiting on them, the numbers,
 * and the way into each creation flow. Everything here is a shortcut into a
 * screen that owns the real workflow (decisions happen on Events/Needs, the
 * composer sheets live there too); the rail never duplicates a workflow, it
 * only points at it. Mobile never sees this — the Dashboard tab covers the
 * same ground in a single column.
 */
export function NgoRail() {
	const { colors, spacing } = useTheme();
	const router = useRouter();

	const org = useMyOrganization();
	const eventsQuery = useOrgEvents();
	const needsQuery = useOrgNeeds();

	const status = org.data?.verificationStatus;
	const isVerified = status === "VERIFIED";

	const events = eventsQuery.data?.items ?? [];
	const needs = needsQuery.data?.items ?? [];
	const pendingApplications = events.reduce(
		(sum, event) => sum + (event.pendingApplications ?? 0),
		0,
	);
	const pendingPledges = needs.reduce(
		(sum, need) => sum + (need.pendingPledges ?? 0),
		0,
	);
	const waiting = pendingApplications + pendingPledges;
	const publishedEvents = events.filter(
		(event) => event.status === "PUBLISHED",
	).length;
	const openNeeds = needs.filter((need) => need.status === "OPEN").length;

	return (
		<View style={{ gap: spacing[6] }}>
			{waiting > 0 && (
				<View>
					<SectionTitle>Needs your decision</SectionTitle>
					<ListGroup>
						{pendingApplications > 0 && (
							<ListRow
								icon={CalendarDays}
								label={`${pendingApplications} applicant${pendingApplications === 1 ? "" : "s"}`}
								hint="Review on Events"
								value={<Count value={pendingApplications} />}
								onPress={() => router.push("/(ngo)/events" as never)}
							/>
						)}
						{pendingPledges > 0 && (
							<ListRow
								icon={HeartHandshake}
								label={`${pendingPledges} pledge${pendingPledges === 1 ? "" : "s"}`}
								hint="Review on Needs"
								value={<Count value={pendingPledges} />}
								onPress={() => router.push("/(ngo)/needs" as never)}
							/>
						)}
					</ListGroup>
				</View>
			)}

			<View>
				<SectionTitle>At a glance</SectionTitle>
				<MetricRow
					stats={[
						{ label: "Published", value: publishedEvents },
						{ label: "Open needs", value: openNeeds },
						{
							label: "Waiting",
							value: waiting,
							...(waiting > 0 ? { tone: "warning" as const } : {}),
						},
					]}
				/>
			</View>

			<View>
				<SectionTitle>Create</SectionTitle>
				<ListGroup>
					<ListRow
						icon={CalendarDays}
						label="New event"
						hint="Plan and publish"
						onPress={() => router.push("/(ngo)/events" as never)}
					/>
					<ListRow
						icon={HeartHandshake}
						label="New need"
						hint="Ask or offer"
						onPress={() => router.push("/(ngo)/needs" as never)}
					/>
					<ListRow
						icon={Megaphone}
						label="New update"
						hint="Post to your profile"
						onPress={() => router.push("/(ngo)/announcements" as never)}
					/>
				</ListGroup>
			</View>

			{!isVerified && (
				<Surface onPress={() => router.push("/(ngo)/verification" as never)}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
						}}
					>
						<ShieldCheck size={18} color={colors.text.tertiary as string} />
						<View style={{ flex: 1 }}>
							<H5>Verification</H5>
							<Caption color="tertiary">
								{status === "UNDER_REVIEW"
									? "Under review"
									: status === "REJECTED"
										? "Action needed"
										: "Not started"}
							</Caption>
						</View>
					</View>
				</Surface>
			)}
		</View>
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
