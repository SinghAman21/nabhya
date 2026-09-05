import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	ArrowLeft,
	Award,
	Building2,
	CalendarCheck,
	Clock,
	Package,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import { Body, Caption, H2, H3 } from "@/components/ui/typography";
import { useMyImpact } from "@/hooks/use-directory";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * The volunteer's contribution summary.
 *
 * Every figure is derived from applications, attendance and pledges rather
 * than stored — hours come from the attended events' own durations, so an
 * organization cannot inflate someone's record without changing the event
 * everyone else can see.
 */
export default function Impact() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const query = useMyImpact();
	const impact = query.data;

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<H2 style={{ marginBottom: spacing[1] }}>Your impact</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[5] }}>
				{impact?.firstVolunteeredAt
					? `Volunteering since ${formatDate(impact.firstVolunteeredAt)}.`
					: "Everything you contribute shows up here."}
			</Body>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !impact ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					<View style={{ flexDirection: "row", gap: spacing[2] }}>
						<Stat
							icon={Clock}
							value={impact.hoursContributed}
							label="hours given"
							emphasis
						/>
						<Stat
							icon={CalendarCheck}
							value={impact.eventsAttended}
							label="events attended"
							emphasis
						/>
					</View>

					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[2],
						}}
					>
						<Stat
							icon={Building2}
							value={impact.organizationsHelped}
							label="NGOs helped"
						/>
						<Stat
							icon={Award}
							value={impact.certificatesEarned}
							label="certificates"
						/>
						<Stat
							icon={Package}
							value={impact.itemsDonated}
							label="items donated"
						/>
					</View>

					<Surface style={{ marginTop: spacing[5] }}>
						<Caption
							weight="bold"
							color="tertiary"
							style={{
								letterSpacing: 1,
								textTransform: "uppercase",
								marginBottom: spacing[3],
							}}
						>
							Applications
						</Caption>
						<Row
							label="Submitted"
							value={String(impact.applicationsSubmitted)}
						/>
						<Row label="Acceptance rate" value={`${impact.acceptanceRate}%`} />
						<Row
							label="Pledges completed"
							value={String(impact.pledgesCompleted)}
							last
						/>
					</Surface>

					{impact.eventsAttended === 0 && (
						<Surface style={{ marginTop: spacing[4] }}>
							<Body weight="bold">Nothing here yet</Body>
							<Caption color="tertiary">
								Apply to an event — once the NGO confirms you attended, your
								hours and certificate appear here automatically.
							</Caption>
						</Surface>
					)}
				</ScrollView>
			)}
		</View>
	);
}

function Stat({
	icon: Icon,
	value,
	label,
	emphasis,
}: {
	icon: LucideIcon;
	value: number;
	label: string;
	emphasis?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<Surface style={{ flex: 1 }}>
			<Icon
				size={18}
				color={
					emphasis
						? (colors.primary.main as string)
						: (colors.text.tertiary as string)
				}
			/>
			<H3
				style={{ marginTop: spacing[1] }}
				color={emphasis ? (colors.primary.main as string) : undefined}
			>
				{value}
			</H3>
			<Caption color="tertiary">{label}</Caption>
		</Surface>
	);
}

function Row({
	label,
	value,
	last,
}: {
	label: string;
	value: string;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				paddingBottom: last ? 0 : spacing[2],
				marginBottom: last ? 0 : spacing[2],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Caption weight="medium">{value}</Caption>
		</View>
	);
}
