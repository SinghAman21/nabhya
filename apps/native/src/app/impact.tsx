import { useRouter } from "expo-router";
import { TrendingUp } from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import {
	EmptyState,
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	Screen,
	ScreenHeader,
	SectionTitle,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useMyImpact } from "@/hooks/use-directory";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The volunteer's contribution summary.
 *
 * Every figure is derived from applications, attendance and pledges rather
 * than stored - hours come from the attended events' own durations, so an
 * organisation cannot inflate someone's record without changing the event
 * everyone else can see.
 *
 * Two metric rows, the loud numbers first (hours, events) and the supporting
 * ones under them, then the application record as plain rows. No coloured
 * tiles: the numerals are the loudest thing on the page.
 */
function Impact() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const query = useMyImpact();
	const impact = query.data;

	const nothingYet =
		!!impact &&
		impact.eventsAttended === 0 &&
		impact.itemsDonated === 0 &&
		impact.applicationsSubmitted === 0;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Your impact"
				subtitle={
					impact?.firstVolunteeredAt
						? `Volunteering since ${formatDate(impact.firstVolunteeredAt)}`
						: "Everything you contribute, in numbers"
				}
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !impact ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : nothingYet ? (
				<EmptyState
					icon={TrendingUp}
					title="Nothing to count yet"
					description="Apply to an event or pledge an item. Once an NGO confirms it, your hours, items and certificates add up here."
					action={
						<Button
							size="sm"
							variant="outline"
							onPress={() => router.push("/(volunteer)")}
						>
							See what's needed
						</Button>
					}
				/>
			) : (
				<ScrollView
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					<View style={{ gap: spacing[3], marginBottom: spacing[5] }}>
						<MetricRow
							stats={[
								{ label: "Hours given", value: impact.hoursContributed },
								{ label: "Events attended", value: impact.eventsAttended },
							]}
						/>
						<MetricRow
							stats={[
								{ label: "NGOs helped", value: impact.organizationsHelped },
								{ label: "Certificates", value: impact.certificatesEarned },
								{ label: "Items donated", value: impact.itemsDonated },
							]}
						/>
					</View>

					<SectionTitle>Applications</SectionTitle>
					<ListGroup>
						<ListRow
							label="Submitted"
							value={<Caption>{String(impact.applicationsSubmitted)}</Caption>}
						/>
						<ListRow
							label="Acceptance rate"
							hint="Of the applications NGOs have reviewed"
							value={<Caption>{`${impact.acceptanceRate}%`}</Caption>}
						/>
						<ListRow
							label="Pledges completed"
							hint="Items handed over and confirmed"
							value={<Caption>{String(impact.pledgesCompleted)}</Caption>}
						/>
					</ListGroup>

					{impact.eventsAttended === 0 && (
						<Caption
							color="tertiary"
							style={{ marginTop: spacing[5], textAlign: "center" }}
						>
							Hours and certificates appear once an NGO marks you present at an
							event.
						</Caption>
					)}
				</ScrollView>
			)}
		</Screen>
	);
}

export default withAppShell(Impact);
