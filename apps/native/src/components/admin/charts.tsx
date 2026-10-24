import { TREND_WINDOWS, type TrendWindow } from "@nabhya/shared";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { vizPalette } from "@/components/admin/viz-tokens";
import { Surface } from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H4, Label, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";

/**
 * The console's charts.
 *
 * Three forms, each chosen for a job rather than for looking like a dashboard:
 *
 * | The data | Form here | Why not something else |
 * |---|---|---|
 * | One current count | `StatTile` | A one-bar bar chart is a picture of a number |
 * | Counts per day | `TrendChart` (line + wash) | The only real time series the API has |
 * | Stages of a funnel | `PipelineBar` (stacked, ordinal) | A pie can't be compared, and a 2-slice pie is a stat |
 *
 * **The counters are deliberately not charts.** "16 accounts, 5 volunteers, 9
 * NGO accounts" is four numbers with no dimension to plot against; drawing them
 * as bars would spend a whole card restating a number the reader can already
 * read, which is the commonest way a dashboard misses its point. They stay as
 * tiles and as `StatList` rows.
 *
 * Shared rules, all from the mark spec and none of them optional:
 *
 * - **2px lines, ≥8px end markers with a 2px surface ring**, area wash at ~10%
 *   opacity - never a saturated block.
 * - **Bars cap at 24px thick**, 4px rounded data-end, square at the baseline.
 * - **A 2px surface gap** separates touching marks - every stacked segment. Not
 *   a stroke around them: a border is ink that is not data.
 * - **Gridlines are solid hairlines** one step off the surface. Never dashed -
 *   dashing reads as "projection" when it is just a grid.
 * - **Text never wears the series colour.** Values, labels and legends use text
 *   tokens; a coloured swatch *beside* the text carries identity. The one
 *   exception is a label set inside a filled segment, where the fill's own
 *   luminance decides ink or white.
 * - **A legend whenever there are two or more series**, so identity is never
 *   colour-alone, plus sparing direct labels (the endpoint, the extreme) -
 *   never a number on every point.
 * - **Every value is readable without hover.** The tooltip enhances; the
 *   endpoint labels, the axis and the legend totals are what guarantee it.
 */

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A number, its label, and optionally what it is doing.
 *
 * The form for a single current value - with a delta when there is a previous
 * period to compare against, and a sparkline when there is a series behind it.
 * `onPress` makes it the way into the list that clears it, which is what turns
 * the three queue tiles from a readout into the dashboard's primary action.
 *
 * `tone` is a **status** colour and is used only when the number means
 * something is wrong or waiting, never as decoration: a queue with 12 documents
 * in it is amber because someone has to act, and the same tile at 0 is quiet.
 */
export function StatTile({
	label,
	value,
	hint,
	delta,
	deltaLabel,
	series,
	tone,
	onPress,
}: {
	label: string;
	value: number;
	hint?: string;
	/** Change against the previous window, as a signed count. */
	delta?: number;
	/** Names the comparison, e.g. "vs previous 30 days". */
	deltaLabel?: string;
	/** A sparkline behind the number. Needs at least two points to mean anything. */
	series?: number[];
	/** Only when the figure needs acting on. */
	tone?: "warning";
	onPress?: () => void;
}) {
	const { colors, spacing, isDark } = useTheme();
	const viz = vizPalette(isDark);

	const accent = tone === "warning" ? colors.warning.ink : viz.series[0];

	const body = (
		<>
			<Caption color="tertiary" numberOfLines={1}>
				{label}
			</Caption>
			<View
				style={{
					flexDirection: "row",
					alignItems: "flex-end",
					gap: spacing[2],
					marginTop: spacing[1],
				}}
			>
				{/* Proportional figures, not tabular: equal-width digits make a
				    large standalone number look loose. Tabular belongs in a column. */}
				{/* The text face, not the display one: the display face draws only
				    capitals and reads as decoration on a figure that is data - the
				    dashboard rule is no display face on a figure. */}
				<Title color={tone === "warning" ? colors.warning.ink : undefined}>
					{compact(value)}
				</Title>
				{delta !== undefined && delta !== 0 && (
					<View style={{ paddingBottom: spacing[1] }}>
						<Caption
							weight="medium"
							// Direction, not judgement - and read from a text token, not
							// the series hue.
							color={delta > 0 ? colors.success.ink : colors.text.tertiary}
						>
							{delta > 0 ? "+" : ""}
							{compact(delta)}
						</Caption>
					</View>
				)}
			</View>
			{(hint || deltaLabel) && (
				<Caption color="quaternary" numberOfLines={1}>
					{hint ?? deltaLabel}
				</Caption>
			)}
			{series && series.length > 1 && (
				<View style={{ marginTop: spacing[2.5] }}>
					<Sparkline values={series} color={accent} />
				</View>
			)}
		</>
	);

	if (!onPress) return <Surface>{body}</Surface>;

	return <Surface onPress={onPress}>{body}</Surface>;
}

/** 1_284 → "1,284"; 12_900 → "12.9K". */
function compact(value: number): string {
	const sign = value < 0 ? "-" : "";
	const n = Math.abs(value);
	if (n < 1000) return `${sign}${n}`;
	if (n < 1_000_000) {
		const k = n / 1000;
		return `${sign}${k < 10 ? k.toFixed(1) : Math.round(k)}K`;
	}
	return `${sign}${(n / 1_000_000).toFixed(1)}M`;
}

const SPARK_HEIGHT = 28;

/** A 12-ish point sparkline. No axis, no labels - it carries shape, not values. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
	const { colors } = useTheme();
	const [width, setWidth] = useState(0);

	const max = Math.max(...values, 1);
	const step = width / Math.max(values.length - 1, 1);
	const y = (v: number) => SPARK_HEIGHT - 2 - (v / max) * (SPARK_HEIGHT - 4);

	const path = values
		.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(v)}`)
		.join(" ");

	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ height: SPARK_HEIGHT, width: "100%" }}
		>
			{width > 0 && (
				<Svg width={width} height={SPARK_HEIGHT}>
					<Path
						d={`${path} L ${width} ${SPARK_HEIGHT} L 0 ${SPARK_HEIGHT} Z`}
						fill={color}
						fillOpacity={0.1}
					/>
					<Path
						d={path}
						stroke={color}
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
						fill="none"
					/>
					<Circle
						cx={width}
						cy={y(values[values.length - 1] ?? 0)}
						r={3}
						fill={color}
						stroke={colors.background.card as string}
						strokeWidth={2}
					/>
				</Svg>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Trend chart                                                                */
/* -------------------------------------------------------------------------- */

export interface TrendSeries {
	key: string;
	label: string;
	values: number[];
}

const CHART_HEIGHT = 168;
/** Room under the plot for the date band. Sized in, not cropped off. */
const AXIS_BAND = 22;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 10;

/**
 * Counts per day, as a line per series over a shared wash.
 *
 * **One axis, always.** Two measures of different magnitude get two charts or an
 * index to a common base - never a second y-scale, which invents a correlation
 * by choosing where the two scales line up.
 *
 * At most **two series** here. The third validated slot is 2.72:1 on the light
 * surface and would need direct labels on every line to be legal; two is also
 * where a legend plus two endpoint labels stays readable without leader lines.
 *
 * Hover is a crosshair with a readout, and it is an enhancement: the endpoint
 * values are directly labelled and the legend carries each series' window
 * total, so nothing is only reachable by pointing at it.
 *
 * **The chart is one tab stop, not one per day.** The per-day hit zones were
 * each a focusable button, so tabbing past a 90-day chart took 90 presses and
 * focus never moved the crosshair. Now the plot is a single focusable
 * (`adjustable`) that the arrow keys walk, day by day, with Home / End for the
 * ends: focus puts the crosshair on the last day and the readout under the
 * legend says what it points at. The hit zones stay, for the pointer only.
 *
 * **An all-zero window says so.** A flat line on the zero gridline looks
 * like a chart that failed to draw; `emptyNote` sits over it instead.
 */
export function TrendChart({
	labels,
	series,
	totals,
	emptyNote = "Nothing in this window",
}: {
	/** One per point. Only the first, middle and last are drawn. */
	labels: string[];
	series: TrendSeries[];
	/** Window total per series key, for the legend. */
	totals?: Record<string, number>;
	/** Shown over the plot when every value in the window is zero. */
	emptyNote?: string;
}) {
	const { colors, spacing, isDark } = useTheme();
	const viz = vizPalette(isDark);
	const [width, setWidth] = useState(0);
	const [hover, setHover] = useState<number | null>(null);
	const [focused, setFocused] = useState(false);

	const allZero = series.every((line) => line.values.every((v) => v === 0));
	const describe = (index: number) =>
		`${labels[index] ?? ""}: ${series
			.map((line) => `${line.values[index] ?? 0} ${line.label}`)
			.join(", ")}`;

	// Arrow keys walk the days while the plot has focus. Document-level and
	// web-only, the same way `SelectMenu` listens - RNW gives a `View` no key
	// events of its own. Native screen readers use `accessibilityActions`.
	const step = (by: number | "start" | "end") => {
		const last = labels.length - 1;
		if (last < 0) return;
		setHover((current) => {
			if (by === "start") return 0;
			if (by === "end") return last;
			return Math.min(last, Math.max(0, (current ?? last) + by));
		});
	};
	const onKey = useEffectEvent((event: KeyboardEvent) => {
		const moves: Record<string, number | "start" | "end"> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowDown: -1,
			ArrowUp: 1,
			Home: "start",
			End: "end",
		};
		const by = moves[event.key];
		if (by === undefined) return;
		event.preventDefault();
		step(by);
	});
	useEffect(() => {
		if (Platform.OS !== "web" || !focused) return;
		const listener = (event: KeyboardEvent) => onKey(event);
		document.addEventListener("keydown", listener);
		return () => document.removeEventListener("keydown", listener);
	}, [focused]);

	const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
	const plotHeight = CHART_HEIGHT - PAD_TOP - AXIS_BAND;
	const count = Math.max(labels.length, 1);

	// A ceiling on a clean number, so the ticks read 0 / 4 / 8 rather than
	// 0 / 3.3 / 6.6.
	const rawMax = Math.max(1, ...series.flatMap((line) => line.values));
	const max = niceCeiling(rawMax);

	const x = (index: number) =>
		PAD_LEFT + (plotWidth * index) / Math.max(count - 1, 1);
	const y = (value: number) => PAD_TOP + plotHeight * (1 - value / max);

	const ticks = [0, max / 2, max];

	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ width: "100%" }}
		>
			{width > 0 && (
				<>
					<Svg width={width} height={CHART_HEIGHT}>
						{/* Grid: solid hairlines, one step off the surface. */}
						{ticks.map((tick) => (
							<Line
								key={tick}
								x1={PAD_LEFT}
								y1={y(tick)}
								x2={width - PAD_RIGHT}
								y2={y(tick)}
								stroke={viz.grid}
								strokeWidth={1}
							/>
						))}

						{series.map((line, index) => {
							const color = viz.series[index] ?? viz.series[0];
							const path = line.values
								.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
								.join(" ");
							return (
								<Path
									key={`${line.key}-wash`}
									d={`${path} L ${x(line.values.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
									fill={color}
									fillOpacity={0.1}
								/>
							);
						})}

						{series.map((line, index) => {
							const color = viz.series[index] ?? viz.series[0];
							return (
								<Path
									key={line.key}
									d={line.values
										.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
										.join(" ")}
									stroke={color}
									strokeWidth={2}
									strokeLinejoin="round"
									strokeLinecap="round"
									fill="none"
								/>
							);
						})}

						{/* Crosshair. Drawn before the markers so a marker stays on top. */}
						{hover !== null && (
							<Line
								x1={x(hover)}
								y1={PAD_TOP}
								x2={x(hover)}
								y2={PAD_TOP + plotHeight}
								stroke={colors.text.quaternary as string}
								strokeWidth={1}
							/>
						)}

						{series.map((line, index) => {
							const color = viz.series[index] ?? viz.series[0];
							const at = hover ?? line.values.length - 1;
							return (
								<Circle
									key={`${line.key}-dot`}
									cx={x(at)}
									cy={y(line.values[at] ?? 0)}
									r={4}
									fill={color}
									// The 2px surface ring: keeps the marker legible where
									// two lines cross.
									stroke={colors.background.card as string}
									strokeWidth={2}
								/>
							);
						})}
					</Svg>

					{/* Y ticks and the date band, as text over the plot rather than
					    inside the SVG - the type ramp owns its sizes and tracking. */}
					{ticks.map((tick) => (
						<Caption
							key={tick}
							color="quaternary"
							style={{
								position: "absolute",
								left: 0,
								top: y(tick) - 7,
								width: PAD_LEFT - 6,
								textAlign: "right",
								// Tabular here, and only here: these align vertically.
								fontVariant: ["tabular-nums"],
							}}
						>
							{tick === 0 ? "0" : compact(Math.round(tick))}
						</Caption>
					))}

					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							marginLeft: PAD_LEFT,
							marginRight: PAD_RIGHT,
							marginTop: -AXIS_BAND + 4,
						}}
					>
						<Caption color="quaternary">{labels[0]}</Caption>
						{count > 6 && (
							<Caption color="quaternary">
								{labels[Math.floor((count - 1) / 2)]}
							</Caption>
						)}
						<Caption color="quaternary">{labels[count - 1]}</Caption>
					</View>

					{allZero && (
						<View
							pointerEvents="none"
							style={{
								position: "absolute",
								left: PAD_LEFT,
								right: PAD_RIGHT,
								top: PAD_TOP,
								height: plotHeight,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Caption color="tertiary">{emptyNote}</Caption>
						</View>
					)}

					{/* The hover surface: one focusable for the keyboard (see the
					    note above), holding one hit zone per point for the pointer,
					    each at least 24px wide where the data allows so a 4px dot is
					    never the target. The zones are not focusable. */}
					<Pressable
						accessibilityRole="adjustable"
						accessibilityLabel={`${series.map((line) => line.label).join(" and ")} per day. ${
							allZero ? emptyNote : "Use the arrow keys to read each day."
						}`}
						accessibilityValue={{
							text: hover !== null ? describe(hover) : describe(count - 1),
						}}
						accessibilityActions={[
							{ name: "increment" },
							{ name: "decrement" },
						]}
						onAccessibilityAction={(event) =>
							step(event.nativeEvent.actionName === "increment" ? 1 : -1)
						}
						onFocus={() => {
							setFocused(true);
							setHover((current) => current ?? count - 1);
						}}
						onBlur={() => {
							setFocused(false);
							setHover(null);
						}}
						{...focusable}
						style={{
							position: "absolute",
							left: PAD_LEFT,
							right: PAD_RIGHT,
							top: PAD_TOP,
							height: plotHeight,
							flexDirection: "row",
							borderRadius: 4,
						}}
					>
						{labels.map((label, index) => (
							<Pressable
								key={label}
								onPress={() => setHover(index)}
								onHoverIn={() => setHover(index)}
								onHoverOut={() => {
									if (!focused) setHover(null);
								}}
								focusable={false}
								accessible={false}
								style={{ flex: 1 }}
							/>
						))}
					</Pressable>
				</>
			)}

			{/* Legend. Always, at two or more series - identity is never left to
			    colour-matching. The window total rides along so the legend is also
			    the table view for the series as a whole. */}
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[4],
					marginTop: spacing[3],
				}}
			>
				{series.map((line, index) => (
					<View
						key={line.key}
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
								width: 10,
								height: 3,
								borderRadius: 2,
								backgroundColor: viz.series[index] ?? viz.series[0],
							}}
						/>
						<Caption color="tertiary">{line.label}</Caption>
						{totals?.[line.key] !== undefined && (
							<Caption weight="semibold">
								{compact(totals[line.key] ?? 0)}
							</Caption>
						)}
					</View>
				))}
				<View style={{ flexGrow: 1 }} />
				{hover !== null && labels[hover] && (
					<Caption color="secondary" weight="medium">
						{labels[hover]}
						{series.map(
							(line) => ` · ${line.label} ${line.values[hover] ?? 0}`,
						)}
					</Caption>
				)}
			</View>
		</View>
	);
}

/** 7 → 8, 23 → 25, 340 → 400. Keeps the two ticks on readable numbers. */
function niceCeiling(value: number): number {
	if (value <= 4) return 4;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	for (const step of [1, 2, 2.5, 5, 10]) {
		const candidate = step * magnitude;
		if (candidate >= value) return candidate;
	}
	return magnitude * 10;
}

/* -------------------------------------------------------------------------- */
/* Pipeline bar                                                               */
/* -------------------------------------------------------------------------- */

export interface PipelineStage {
	label: string;
	value: number;
	/** True for a terminal state that is not a step forward (rejected). */
	off?: boolean;
}

const BAR_THICKNESS = 22;
const SEGMENT_GAP = 2;

/**
 * Part-to-whole for an *ordered* set of stages.
 *
 * A horizontal stacked bar, coloured from an ordinal ramp - one hue, stepping
 * light to dark - because the order is the meaning: Pending → In review →
 * Verified is a funnel, and a reader should see the progression in the colour
 * rather than have to decode four unrelated hues. A stage that is off the
 * pipeline (Rejected) takes the neutral, so it does not read as further along
 * than Verified.
 *
 * Not a pie: comparing two close slices by angle is the thing pies are worst
 * at, and a 2-slice pie is a stat tile with extra steps. Horizontal rather than
 * vertical because the stage names are words, and words fit beside a horizontal
 * bar without turning the axis on its side.
 *
 * Every value is in the legend under the bar, so nothing depends on reading a
 * segment's width - which also covers the segments too narrow to label inside.
 */
export function PipelineBar({ stages }: { stages: PipelineStage[] }) {
	const { spacing, isDark } = useTheme();
	const viz = vizPalette(isDark);
	const [width, setWidth] = useState(0);

	const total = stages.reduce((sum, stage) => sum + stage.value, 0);
	const present = stages.filter((stage) => stage.value > 0);

	const colorFor = useMemo(() => {
		let step = 0;
		const map = new Map<string, string>();
		for (const stage of stages) {
			map.set(
				stage.label,
				stage.off
					? viz.pipelineOff
					: (viz.pipeline[Math.min(step++, viz.pipeline.length - 1)] as string),
			);
		}
		return map;
	}, [stages, viz]);

	// Widths are computed from the measured bar minus the gaps, so the segments
	// always add up to the bar rather than overflowing it by `gaps × 2px`.
	const gaps = Math.max(present.length - 1, 0) * SEGMENT_GAP;
	const usable = Math.max(width - gaps, 0);

	return (
		<View>
			<View
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
				accessibilityRole="image"
				accessibilityLabel={stages
					.map((stage) => `${stage.label} ${stage.value}`)
					.join(", ")}
				style={{
					height: BAR_THICKNESS,
					borderRadius: 6,
					overflow: "hidden",
					backgroundColor: viz.track,
					flexDirection: "row",
				}}
			>
				{total > 0 &&
					width > 0 &&
					present.map((stage, index) => (
						<View
							key={stage.label}
							style={{
								width: (usable * stage.value) / total,
								backgroundColor: colorFor.get(stage.label),
								// The 2px surface gap does the separating, not a border.
								marginRight: index < present.length - 1 ? SEGMENT_GAP : 0,
							}}
						/>
					))}
			</View>

			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: spacing[3],
					marginTop: spacing[2.5],
				}}
			>
				{stages.map((stage) => (
					<View
						key={stage.label}
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
								backgroundColor: colorFor.get(stage.label),
							}}
						/>
						<Caption color="tertiary">{stage.label}</Caption>
						<Caption weight="semibold">{stage.value}</Caption>
					</View>
				))}
			</View>

			{total === 0 && (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					No organizations yet.
				</Caption>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A chart's frame: a title, an optional right-hand control, and the plot.
 *
 * The title carries what is plotted, which is why a single-series chart needs
 * no legend box - a box with one swatch just restates this line.
 */
export function ChartCard({
	title,
	caption,
	action,
	children,
}: {
	title: string;
	caption?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: spacing[3],
					marginBottom: spacing[4],
				}}
			>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Label weight="semibold">{title}</Label>
					{caption && (
						<Caption color="quaternary" numberOfLines={2}>
							{caption}
						</Caption>
					)}
				</View>
				{action}
			</View>
			{children}
		</Surface>
	);
}

/**
 * The window switch above the charts.
 *
 * **One control, above everything it scopes** - not a picker per card. Both
 * charts re-render against the same slice, so the page can never show a 7-day
 * line beside a 30-day one and leave the reader to notice.
 */
export function RangeSwitch({
	value,
	onChange,
}: {
	value: TrendWindow;
	onChange: (next: TrendWindow) => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			accessibilityRole="tablist"
			style={{
				flexDirection: "row",
				gap: spacing[0.5],
				padding: spacing[0.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			{TREND_WINDOWS.map((days) => {
				const active = days === value;
				return (
					<Pressable
						key={days}
						onPress={() => onChange(days)}
						accessibilityRole="tab"
						accessibilityState={{ selected: active }}
						accessibilityLabel={`Last ${days} days`}
						{...focusable}
						style={(state) => {
							const { hovered, pressed } = state as PressState;
							return {
								height: 26,
								paddingHorizontal: spacing[2.5],
								justifyContent: "center",
								borderRadius: borderRadius.sm,
								backgroundColor: active
									? colors.background.card
									: hovered || pressed
										? colors.background.tertiary
										: "transparent",
							};
						}}
					>
						<Caption
							weight={active ? "semibold" : "normal"}
							color={active ? "primary" : "quaternary"}
						>
							{days}d
						</Caption>
					</Pressable>
				);
			})}
		</View>
	);
}

/**
 * The dashboard's one hero figure.
 *
 * Exactly one per view, in the same sans as everything else - a display or
 * serif face here reads as off-brand decoration rather than data.
 */
export function HeroFigure({
	value,
	label,
	hint,
}: {
	value: number;
	label: string;
	hint?: string;
}) {
	const { spacing } = useTheme();

	return (
		<View>
			<Caption color="tertiary">{label}</Caption>
			<H4 style={{ marginTop: spacing[0.5] }}>{compact(value)}</H4>
			{hint && <Caption color="quaternary">{hint}</Caption>}
		</View>
	);
}

/** Exported so "1.2K" is formatted in exactly one place. */
export { compact as compactNumber };
