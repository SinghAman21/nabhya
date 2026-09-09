import type { TrendWindow } from "@nabhya/shared";
import { View } from "react-native";
import {
	ChartCard,
	compactNumber,
	PipelineBar,
	TrendChart,
} from "@/components/admin/charts";
import { vizPalette } from "@/components/admin/viz-tokens";
import {
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminAnalytics } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

/**
 * The dashboard's second layer: what the Overview's point-in-time counts
 * cannot say.
 *
 * Served by `GET /api/admin/analytics?days=7|30|90&limit=10`. The `days` value
 * is the page's own window switch — one control above every chart, so a 7-day
 * line can never sit beside a 30-day bar. `keepPreviousData` holds the old
 * charts up while the next window loads.
 *
 * Form follows the data's job, per the chart rules in `charts.tsx`:
 *
 * - Donations over time → `TrendChart` (the only other real time series).
 * - Application funnel + review-queue age → `PipelineBar` / grouped bars
 *   (ordinal stages, one hue stepping light to dark).
 * - Top locations / causes → `BarList` (categorical counts with a dimension to
 *   plot against — exactly what a stat tile cannot do).
 * - Top organizations → rows, not a chart: a ranking with four numbers per
 *   entry is a table, and drawing it as bars would spend a card restating what
 *   the numbers already say.
 *
 * Series colours come from `viz-tokens.ts` in fixed assignment order and are
 * never cycled or reassigned by rank. Text never wears a series colour — a
 * swatch beside the words carries identity.
 */
export function AnalyticsSections({ days }: { days: TrendWindow }) {
	const { spacing } = useTheme();
	const analytics = useAdminAnalytics({ days, limit: 10 });

	if (analytics.isLoading) {
		return (
			<Surface>
				<LoadingState label="Loading analytics" />
			</Surface>
		);
	}

	if (analytics.isError || !analytics.data) {
		return (
			<Surface>
				<ErrorState
					message={apiErrorMessage(analytics.error)}
					onRetry={() => analytics.refetch()}
				/>
			</Surface>
		);
	}

	const data = analytics.data;
	const donationLabels = data.donations.points.map((point) =>
		new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		}),
	);

	return (
		<View style={{ gap: spacing[4] }}>
			<ChartCard
				title="Donations"
				caption={`₹${(data.donations.totalAmountMinor / 100).toLocaleString("en-IN")} across ${data.donations.completedCount} completed ${data.donations.completedCount === 1 ? "donation" : "donations"} · last ${data.windowDays} days`}
			>
				{data.donations.points.length === 0 ? (
					<Caption color="tertiary">
						No completed donations in this window.
					</Caption>
				) : (
					<TrendChart
						labels={donationLabels}
						series={[
							{
								key: "donations",
								label: "Rupees per day",
								values: data.donations.points.map((point) =>
									Math.round(point.amountMinor / 100),
								),
							},
						]}
						totals={{
							donations: Math.round(data.donations.totalAmountMinor / 100),
						}}
					/>
				)}
			</ChartCard>

			<ChartCard
				title="Application funnel"
				caption="Where volunteer applications currently sit"
			>
				<PipelineBar
					stages={data.applicationFunnel.map((row) => ({
						label: row.label,
						value: row.value,
					}))}
				/>
			</ChartCard>

			<ChartCard
				title="Review queue age"
				caption="How long pending documents have been waiting"
			>
				<QueueAgeBars buckets={data.reviewQueues.ageBuckets} />
			</ChartCard>

			<ChartCard
				title="NGOs by location"
				caption={`Top ${data.locations.organizations.length} cities · last ${data.windowDays} days`}
			>
				<BarList data={data.locations.organizations} seriesIndex={0} />
			</ChartCard>

			<ChartCard
				title="Volunteers by location"
				caption={`Top ${data.locations.volunteers.length} cities · last ${data.windowDays} days`}
			>
				<BarList data={data.locations.volunteers} seriesIndex={1} />
			</ChartCard>

			<ChartCard
				title="NGOs by cause"
				caption={`Top ${data.categories.organizations.length} categories · last ${data.windowDays} days`}
			>
				<BarList data={data.categories.organizations} seriesIndex={0} />
			</ChartCard>

			<ChartCard
				title="Volunteers by cause"
				caption={`Top ${data.categories.volunteers.length} categories · last ${data.windowDays} days`}
			>
				<BarList data={data.categories.volunteers} seriesIndex={1} />
			</ChartCard>

			<View>
				<TopOrganizations orgs={data.topOrganizations} />
			</View>
		</View>
	);
}

/**
 * One categorical count per row: swatch + label + value, with a thin bar
 * behind the proportion. Every value is text, so nothing depends on reading a
 * width; the bar carries shape, not the number.
 */
function BarList({
	data,
	seriesIndex,
}: {
	data: Array<{ label: string; value: number }>;
	seriesIndex: 0 | 1 | 2;
}) {
	const { spacing, isDark } = useTheme();
	const viz = vizPalette(isDark);
	const color = viz.series[seriesIndex] ?? viz.series[0];
	const max = Math.max(1, ...data.map((row) => row.value));

	if (data.length === 0) {
		return <Caption color="tertiary">Nothing to show in this window.</Caption>;
	}

	return (
		<View style={{ gap: spacing[2.5] }}>
			{data.map((row) => (
				<View
					key={row.label}
					accessible
					accessibilityRole="text"
					accessibilityLabel={`${row.label}: ${row.value}`}
					style={{ gap: spacing[1] }}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
						}}
					>
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							style={{
								width: 8,
								height: 8,
								borderRadius: 2,
								backgroundColor: color,
							}}
						/>
						<Body style={{ flex: 1 }} numberOfLines={1}>
							{row.label}
						</Body>
						<Caption
							weight="semibold"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{compactNumber(row.value)}
						</Caption>
					</View>
					<View
						style={{
							height: 8,
							borderRadius: 4,
							backgroundColor: viz.track,
							overflow: "hidden",
						}}
					>
						<View
							style={{
								width: `${(row.value / max) * 100}%`,
								height: "100%",
								borderRadius: 4,
								backgroundColor: color,
							}}
						/>
					</View>
				</View>
			))}
		</View>
	);
}

function QueueAgeBars({
	buckets,
}: {
	buckets: Array<{
		label: string;
		orgDocuments: number;
		userDocuments: number;
	}>;
}) {
	const { colors, spacing, isDark } = useTheme();
	const viz = vizPalette(isDark);
	const max = Math.max(
		1,
		...buckets.flatMap((bucket) => [bucket.orgDocuments, bucket.userDocuments]),
	);

	if (buckets.length === 0) {
		return <Caption color="tertiary">No pending documents.</Caption>;
	}

	const rows: Array<{
		label: string;
		value: number;
		color: string;
		hint: string;
	}> = buckets.flatMap((bucket) => [
		{
			label: `${bucket.label} · NGO docs`,
			value: bucket.orgDocuments,
			color: viz.series[0] as string,
			hint: `${bucket.label} — NGO documents`,
		},
		{
			label: `${bucket.label} · IDs`,
			value: bucket.userDocuments,
			color: viz.series[1] as string,
			hint: `${bucket.label} — identity documents`,
		},
	]);

	return (
		<View style={{ gap: spacing[2.5] }}>
			{rows.map((row) => (
				<View
					key={row.label}
					accessible
					accessibilityRole="text"
					accessibilityLabel={`${row.hint}: ${row.value}`}
					style={{ gap: spacing[1] }}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
						}}
					>
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							style={{
								width: 8,
								height: 8,
								borderRadius: 2,
								backgroundColor: row.color,
							}}
						/>
						<Body style={{ flex: 1 }} numberOfLines={1}>
							{row.label}
						</Body>
						<Caption
							weight="semibold"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{compactNumber(row.value)}
						</Caption>
					</View>
					<View
						style={{
							height: 8,
							borderRadius: 4,
							backgroundColor: colors.background.subtle,
							overflow: "hidden",
						}}
					>
						<View
							style={{
								width: `${(row.value / max) * 100}%`,
								height: "100%",
								borderRadius: 4,
								backgroundColor: row.color,
							}}
						/>
					</View>
				</View>
			))}
		</View>
	);
}

function TopOrganizations({
	orgs,
}: {
	orgs: Array<{
		id: string;
		organizationName: string;
		city: string | null;
		state: string | null;
		events: number;
		needs: number;
		applications: number;
		donationAmountMinor: number;
	}>;
}) {
	const { spacing } = useTheme();

	if (orgs.length === 0) {
		return (
			<Surface>
				<Caption color="tertiary">
					No organizations with activity in this window yet.
				</Caption>
			</Surface>
		);
	}

	return (
		<View style={{ gap: spacing[3] }}>
			<Caption color="tertiary">
				Most active NGOs · events, needs, applications and donations in this
				window
			</Caption>
			<ListGroup>
				{orgs.map((org) => (
					<ListRow
						key={org.id}
						label={org.organizationName}
						hint={[
							[org.city, org.state].filter(Boolean).join(", ") ||
								"Unknown city",
							`${org.events} events`,
							`${org.needs} needs`,
							`${org.applications} applications`,
						].join(" · ")}
						value={
							<Caption
								weight="semibold"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								₹{(org.donationAmountMinor / 100).toLocaleString("en-IN")}
							</Caption>
						}
						chevron={false}
					/>
				))}
			</ListGroup>
		</View>
	);
}
