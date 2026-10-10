import type { TrendWindow } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AnalyticsSections } from "@/components/admin/analytics-sections";
import { AuditRow } from "@/components/admin/audit-row";
import { BroadcastSheet } from "@/components/admin/broadcast-sheet";
import {
	ChartCard,
	PipelineBar,
	RangeSwitch,
	StatTile,
	TrendChart,
} from "@/components/admin/charts";
import { AdminScreen } from "@/components/admin/list-chrome";
import { StatList } from "@/components/admin/stat-list";
import { AppearanceRow } from "@/components/appearance-row";
import {
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import {
	useAdminOverview,
	useAdminTrends,
	useAuditLogs,
} from "@/hooks/use-admin";
import { useSignOut } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/**
 * The superadmin dashboard.
 *
 * It was a stack of `MetricRow`s - nineteen numbers in three surfaces, which is
 * a readout, not a dashboard. What it is now, top to bottom, and why each piece
 * is the form it is:
 *
 * 1. **Three queue tiles.** What is waiting on me, as `StatTile`s that are also
 *    the way into the list that clears each one. A single current value is a
 *    stat tile, not a one-bar bar chart - drawing "12 documents" as a bar is a
 *    picture of a number. The amber left edge and amber numeral appear only
 *    above zero, because a status colour that is always on says nothing.
 * 2. **Two charts, and only where there is a dimension to plot against.**
 *    Signups per day (NGOs and volunteers) and platform activity per day
 *    (events created, applications made). These are the *only* real time series
 *    the API has, which is why they were worth adding server-side: everything
 *    else on this page is a point-in-time count, and a count has nothing to
 *    plot against. One window switch above both, so the page can never show a
 *    7-day line beside a 30-day one.
 * 3. **The verification pipeline**, as one ordinal stacked bar. Pending → In
 *    review → Verified is a funnel, so the colour steps light to dark and the
 *    order carries the meaning; Rejected is terminal, not further along, so it
 *    takes the neutral. Not a pie - comparing two close slices by angle is the
 *    thing pies are worst at.
 * 4. **What just happened** - the last few audit entries, with a way to the log.
 * 5. **The remaining counters** in the aside as a `StatList`, because they are
 *    context rather than work: nobody opens this page to learn how many events
 *    exist. Given the whole width as `MetricRow`s they pushed the activity feed
 *    a screen and a half down; given the 320 aside they wrapped 3 + 1 and put a
 *    28px zero on its own line.
 *
 * The chart palette is not the brand palette, and `viz-tokens.ts` says why -
 * `#FF7E40` is a fill and fails the contrast a 2px line mark needs, and the
 * remaining tones are status colours whose meaning is reserved.
 */
export default function AdminOverviewScreen() {
	const { spacing } = useTheme();
	const router = useRouter();
	const [broadcasting, setBroadcasting] = useState(false);
	const [window, setWindow] = useState<TrendWindow>(30);

	const { isDesktop } = useMedia();
	const query = useAdminOverview();
	const trends = useAdminTrends(window);
	const recent = useAuditLogs({ limit: 6 });
	const signOut = useSignOut();
	const user = useAuthStore((s) => s.user);

	const overview = query.data;
	const points = trends.data?.points ?? [];
	// `d MMM` - short enough that three of them fit under a 90-day axis.
	const labels = points.map((point) =>
		new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		}),
	);

	const delta = (key: "organizations" | "volunteers") => {
		const now = trends.data?.totals[key] ?? 0;
		const before = trends.data?.previousTotals[key] ?? 0;
		return now - before;
	};

	const queues = (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				gap: spacing[3],
			}}
		>
			{[
				{
					label: "NGOs awaiting verification",
					hint: "Pending and under review",
					count: overview
						? overview.organizations.pending +
							overview.organizations.underReview
						: 0,
					// Filtered to exactly what this tile counts. It opened the bare
					// list, which defaulted to Pending alone - so the tile and the
					// list it led to disagreed whenever an NGO was under review.
					go: () =>
						router.push({
							pathname: "/(admin)/organizations",
							params: { verification: "AWAITING" },
						}),
				},
				{
					label: "NGO documents",
					hint: "Registration, PAN, 12A and 80G",
					count: overview?.documents.pendingOrgDocuments ?? 0,
					go: () =>
						router.push({
							pathname: "/(admin)/queue",
							params: { kind: "organization" },
						}),
				},
				{
					label: "Identity documents",
					hint: "Volunteer IDs and liveness selfies",
					count: overview?.documents.pendingUserDocuments ?? 0,
					go: () =>
						router.push({
							pathname: "/(admin)/queue",
							params: { kind: "user" },
						}),
				},
			].map((queue) => (
				<View
					key={queue.label}
					style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}
				>
					<StatTile
						label={queue.label}
						value={queue.count}
						hint={queue.count > 0 ? queue.hint : "Nothing waiting"}
						onPress={queue.go}
						{...(queue.count > 0 ? { tone: "warning" as const } : {})}
					/>
				</View>
			))}
		</View>
	);

	const charts = (
		<View style={{ gap: spacing[4] }}>
			<ChartCard
				title="New accounts"
				caption={`Per day over the last ${window} days`}
				action={<RangeSwitch value={window} onChange={setWindow} />}
			>
				{trends.isLoading ? (
					<LoadingState />
				) : trends.isError ? (
					<ErrorState
						message={apiErrorMessage(trends.error)}
						onRetry={() => trends.refetch()}
					/>
				) : (
					<TrendChart
						labels={labels}
						series={[
							{
								key: "organizations",
								label: "NGOs",
								values: points.map((point) => point.organizations),
							},
							{
								key: "volunteers",
								label: "Volunteers",
								values: points.map((point) => point.volunteers),
							},
						]}
						emptyNote={`No signups in the last ${window} days`}
						totals={{
							organizations: trends.data?.totals.organizations ?? 0,
							volunteers: trends.data?.totals.volunteers ?? 0,
						}}
					/>
				)}
			</ChartCard>

			<ChartCard
				title="Platform activity"
				caption={"Events created and applications made, per day"}
			>
				{trends.isLoading ? (
					<LoadingState />
				) : trends.isError ? (
					// The same request as the chart above, so the same retry: a
					// sentence with no way out left the reviewer reloading the page.
					<ErrorState
						message={apiErrorMessage(trends.error)}
						onRetry={() => trends.refetch()}
					/>
				) : (
					<TrendChart
						labels={labels}
						series={[
							{
								key: "events",
								label: "Events",
								values: points.map((point) => point.events),
							},
							{
								key: "applications",
								label: "Applications",
								values: points.map((point) => point.applications),
							},
						]}
						emptyNote={`No events or applications in the last ${window} days`}
						totals={{
							events: trends.data?.totals.events ?? 0,
							applications: trends.data?.totals.applications ?? 0,
						}}
					/>
				)}
			</ChartCard>
		</View>
	);

	const pipeline = overview ? (
		<ChartCard
			title="Verification pipeline"
			caption="Where every registered NGO currently sits"
		>
			<PipelineBar
				stages={[
					{ label: "Pending", value: overview.organizations.pending },
					// "Under review", as the pills and the NGO filter say it.
					{ label: "Under review", value: overview.organizations.underReview },
					{ label: "Verified", value: overview.organizations.verified },
					{
						label: "Rejected",
						value: overview.organizations.rejected,
						off: true,
					},
				]}
			/>
		</ChartCard>
	) : null;

	const growth = trends.data ? (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
			<View style={{ flexGrow: 1, flexBasis: 180, minWidth: 0 }}>
				<StatTile
					label="New NGOs"
					value={trends.data.totals.organizations}
					delta={delta("organizations")}
					deltaLabel={`vs previous ${window} days`}
					series={points.map((point) => point.organizations)}
				/>
			</View>
			<View style={{ flexGrow: 1, flexBasis: 180, minWidth: 0 }}>
				<StatTile
					label="New volunteers"
					value={trends.data.totals.volunteers}
					delta={delta("volunteers")}
					deltaLabel={`vs previous ${window} days`}
					series={points.map((point) => point.volunteers)}
				/>
			</View>
		</View>
	) : null;

	const activity = (
		<View>
			<SectionTitle
				action={
					<TextAction
						label="See all"
						tone="brand"
						onPress={() => router.push("/(admin)/audit")}
						accessibilityLabel="See all activity"
					/>
				}
			>
				Recent activity
			</SectionTitle>
			{recent.isLoading ? (
				<Surface>
					<LoadingState />
				</Surface>
			) : recent.isError ? (
				<Surface>
					<ErrorState
						message={apiErrorMessage(recent.error)}
						onRetry={() => recent.refetch()}
					/>
				</Surface>
			) : (recent.data?.items.length ?? 0) === 0 ? (
				<Surface>
					<Caption color="tertiary">
						Moderation and lifecycle actions appear here as they happen.
					</Caption>
				</Surface>
			) : (
				<ListGroup>
					{(recent.data?.items ?? []).map((entry) => (
						<AuditRow key={entry.id} entry={entry} />
					))}
				</ListGroup>
			)}
		</View>
	);

	const numbers = overview ? (
		<View style={{ gap: spacing[5] }}>
			<View>
				<SectionTitle>People</SectionTitle>
				<StatList
					stats={[
						{ label: "Accounts", value: overview.users.total },
						{ label: "Volunteers", value: overview.users.volunteers },
						{ label: "NGO accounts", value: overview.users.organisations },
						{
							label: "Suspended",
							value: overview.users.suspended,
							...(overview.users.suspended === 0 ? { muted: true } : {}),
						},
					]}
				/>
			</View>

			<View>
				<SectionTitle>Programmes</SectionTitle>
				<StatList
					stats={[
						{ label: "Events", value: overview.events.total },
						{ label: "Upcoming", value: overview.events.upcoming },
						{ label: "Open needs", value: overview.needs.open },
						{
							label: "Applications pending",
							value: overview.applications.pending,
							...(overview.applications.pending > 0
								? { tone: "warning" as const }
								: { muted: true }),
						},
					]}
				/>
			</View>
		</View>
	) : null;

	const account = (
		<View>
			<SectionTitle>Account</SectionTitle>
			<ListGroup>
				<AppearanceRow />
				<ListRow
					icon={LogOut}
					label="Sign out"
					hint={user?.email ?? undefined}
					value={<View />}
					onPress={() => {
						if (signOut.isPending) return;
						signOut.mutate(undefined, {
							onSettled: () => router.replace("/(auth)/login"),
						});
					}}
				/>
			</ListGroup>
		</View>
	);

	const body = isDesktop ? (
		<View style={{ flexDirection: "row", gap: spacing[6] }}>
			<View style={{ flex: 1, minWidth: 0, gap: spacing[6] }}>
				{queues}
				{charts}
				{pipeline}
				<AnalyticsSections days={window} />
				{activity}
			</View>
			{/* Not sticky: the aside is now taller than a viewport on a laptop, and
			    a sticky column taller than the scroller just pins its own top and
			    hides its own bottom. */}
			<View style={{ width: 320, flexGrow: 0, flexShrink: 0, gap: spacing[6] }}>
				{growth}
				{numbers}
				{account}
			</View>
		</View>
	) : (
		<View style={{ gap: spacing[6] }}>
			{queues}
			{growth}
			{charts}
			{pipeline}
			<AnalyticsSections days={window} />
			{numbers}
			{activity}
			{account}
		</View>
	);

	return (
		<AdminScreen
			title="Overview"
			subtitle="Superadmin console"
			action={
				// A labelled button, not a lone megaphone. An icon-only control
				// ships with a visible word unless it sits in a fixed toolbar of
				// them, and this one notifies every account on the platform.
				<Button size="sm" onPress={() => setBroadcasting(true)}>
					Broadcast
				</Button>
			}
			refreshing={query.isRefetching}
			onRefresh={() => {
				query.refetch();
				trends.refetch();
				recent.refetch();
			}}
		>
			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !overview ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				body
			)}

			<BroadcastSheet
				visible={broadcasting}
				onClose={() => setBroadcasting(false)}
			/>
		</AdminScreen>
	);
}
