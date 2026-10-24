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
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Body, Caption, Title } from "@/components/ui/typography";
import { useMyImpact } from "@/hooks/use-directory";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
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
 * Five figures as a grid of equal tiles - one row on desktop, two-then-three
 * on a phone - rather than two `MetricRow`s: wrapped, those drew a hairline
 * down the left edge of whichever stat started the second line, and the
 * display-face numerals sat at 26pt in a 92pt cell. The numerals are `Title`
 * (sans, tabular enough to read) and stay the loudest thing on the page; no
 * tile is coloured.
 *
 * Under them, on desktop, the application record and a short note on how the
 * figures are counted sit side by side, so the page uses the window instead of
 * floating a 720 column in it.
 */
const COLUMN = { width: "100%", maxWidth: 1040, alignSelf: "center" } as const;
function Impact() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const query = useMyImpact();
	const impact = query.data;

	const nothingYet =
		!!impact &&
		impact.eventsAttended === 0 &&
		impact.itemsDonated === 0 &&
		impact.applicationsSubmitted === 0;

	return (
		<Screen style={COLUMN}>
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
					<View style={{ gap: spacing[3], marginBottom: spacing[6] }}>
						{isDesktop ? (
							<TileRow
								tiles={[
									{ label: "Hours given", value: impact.hoursContributed },
									{ label: "Events attended", value: impact.eventsAttended },
									{ label: "NGOs helped", value: impact.organizationsHelped },
									{ label: "Certificates", value: impact.certificatesEarned },
									{ label: "Items donated", value: impact.itemsDonated },
								]}
							/>
						) : (
							<>
								<TileRow
									tiles={[
										{ label: "Hours given", value: impact.hoursContributed },
										{ label: "Events attended", value: impact.eventsAttended },
									]}
								/>
								<TileRow
									tiles={[
										{ label: "NGOs helped", value: impact.organizationsHelped },
										{ label: "Certificates", value: impact.certificatesEarned },
										{ label: "Items donated", value: impact.itemsDonated },
									]}
								/>
							</>
						)}
					</View>

					<View
						style={{
							flexDirection: isDesktop ? "row" : "column",
							alignItems: "flex-start",
							gap: spacing[6],
						}}
					>
						<View
							style={{
								flex: isDesktop ? 3 : undefined,
								width: "100%",
								minWidth: 0,
							}}
						>
							<SectionTitle>Applications</SectionTitle>
							<ListGroup>
								<ListRow
									label="Submitted"
									value={
										<Body weight="medium">
											{String(impact.applicationsSubmitted)}
										</Body>
									}
								/>
								<ListRow
									label="Acceptance rate"
									hint="Of the applications NGOs have reviewed"
									value={
										<Body weight="medium">{`${impact.acceptanceRate}%`}</Body>
									}
								/>
								<ListRow
									label="Pledges completed"
									hint="Items handed over and confirmed"
									value={
										<Body weight="medium">
											{String(impact.pledgesCompleted)}
										</Body>
									}
								/>
							</ListGroup>
						</View>

						<View
							style={{
								flex: isDesktop ? 2 : undefined,
								width: "100%",
								minWidth: 0,
							}}
						>
							<SectionTitle>How this is counted</SectionTitle>
							<View style={{ gap: spacing[2] }}>
								<Caption color="secondary">
									Hours come from the events an NGO marked you present at, using
									each event's own duration.
								</Caption>
								<Caption color="secondary">
									Items count once the NGO confirms a pledge was handed over.
								</Caption>
								{impact.eventsAttended === 0 ? (
									<Caption color="tertiary">
										Hours and certificates appear once an NGO marks you present
										at an event.
									</Caption>
								) : null}
							</View>
						</View>
					</View>
				</ScrollView>
			)}
		</Screen>
	);
}

/** Equal tiles in one row; each is its own quiet surface, so no row ever wraps. */
function TileRow({
	tiles,
}: {
	tiles: Array<{ label: string; value: number | string }>;
}) {
	const { spacing } = useTheme();

	return (
		<View style={{ flexDirection: "row", gap: spacing[3] }}>
			{tiles.map((tile) => (
				<View key={tile.label} style={{ flex: 1, minWidth: 0 }}>
					<Surface style={{ flex: 1, paddingVertical: spacing[4] }}>
						<Title numberOfLines={1}>{String(tile.value)}</Title>
						<Caption color="tertiary" numberOfLines={2}>
							{tile.label}
						</Caption>
					</Surface>
				</View>
			))}
		</View>
	);
}

export default withAppShell(Impact);
