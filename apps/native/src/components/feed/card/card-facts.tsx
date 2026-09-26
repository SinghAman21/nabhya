import { useState } from "react";
import { View } from "react-native";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import type { FeedEventItem, FeedNeedItem } from "@/lib/types";

/**
 * The structured facts a need or an event carries.
 *
 * Three passes to get here. First a tinted panel in the row's tone, which was a
 * filled block the width of the card and turned a feed of needs into a column
 * of orange rectangles. Then a full-width 3pt rule, which was the opposite
 * mistake: a hairline stretched across 800pt of desktop column reads as a
 * divider, not as a measurement, and at 3pt it had no substance to read.
 *
 * A gauge is now **short and thick** - 8pt tall, capped at 120pt wide, sitting
 * at the end of the line it belongs to. A progress bar is a thing you compare
 * two lengths in, so it wants to be small enough to take in at once; the width
 * of a paragraph is exactly the wrong size for it.
 */

const DAY_MS = 86_400_000;
/** Inside this window a need is "closing soon" and says so. */
const CLOSING_SOON_MS = 3 * DAY_MS;

/** Wide enough to read a fraction off, short enough to see whole. */
const GAUGE_WIDTH = 120;
const GAUGE_HEIGHT = 8;

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric" });
const WEEKDAY_TIME = new Intl.DateTimeFormat("en-IN", {
	weekday: "short",
	hour: "numeric",
	minute: "2-digit",
});

function Gauge({
	ratio,
	fill,
	label,
	max,
	now,
}: {
	ratio: number;
	fill: string;
	label: string;
	max: number;
	now: number;
}) {
	const { colors } = useTheme();
	return (
		<View
			style={{
				width: GAUGE_WIDTH,
				height: GAUGE_HEIGHT,
				borderRadius: 999,
				backgroundColor: colors.background.subtle,
				overflow: "hidden",
			}}
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max, now }}
		>
			<View
				style={{
					// A started-but-tiny total still shows a sliver, so "some" and
					// "none" never draw identically.
					width: `${Math.max(ratio * 100, ratio > 0 ? 6 : 0)}%`,
					height: "100%",
					borderRadius: 999,
					backgroundColor: fill,
				}}
			/>
		</View>
	);
}

/** The fact and its gauge, on one line. */
function GaugeRow({
	text,
	ratio,
	fill,
	label,
	max,
	now,
}: {
	text: string;
	ratio: number;
	fill: string;
	label: string;
	max: number;
	now: number;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: spacing[3],
			}}
		>
			<Caption color="secondary" weight="medium" numberOfLines={1}>
				{text}
			</Caption>
			<Gauge ratio={ratio} fill={fill} label={label} max={max} now={now} />
		</View>
	);
}

/* ── Need ── */

/**
 * "20 of 52 blankets", and a gauge.
 *
 * There used to be a "32 to go" beside it. Two ways of saying one number is
 * one too many, and the gauge already shows the remainder as the unfilled part
 * of itself.
 */
export function NeedFacts({ item }: { item: FeedNeedItem }) {
	const { colors, spacing } = useTheme();
	// Read once per mount. Recomputing `Date.now()` on every render made
	// "closing soon" a value that could flip mid-interaction.
	const [now] = useState(() => Date.now());
	const { need } = item;

	const target = need.quantity ?? 0;
	const done = need.fulfilledQuantity ?? 0;
	const ratio = target > 0 ? Math.min(1, done / target) : 0;
	const complete = target > 0 && ratio >= 1;
	const unit = need.unit ? ` ${need.unit}` : "";

	const expiresAt = need.expiresAt ? new Date(need.expiresAt) : null;
	const msLeft = expiresAt ? expiresAt.getTime() - now : null;
	const expired = msLeft !== null && msLeft <= 0;
	const closingSoon = msLeft !== null && msLeft > 0 && msLeft < CLOSING_SOON_MS;

	if (target === 0 && !expiresAt) return null;

	const closingNote = expired ? "Closed" : closingSoon ? "Closing soon" : null;

	return (
		<View style={{ gap: spacing[2] }}>
			{target > 0 && (
				<GaugeRow
					text={`${done} of ${target}${unit}`}
					ratio={ratio}
					fill={
						(complete ? colors.success.main : colors.primary.main) as string
					}
					label={`${done} of ${target}${unit} collected`}
					max={target}
					now={done}
				/>
			)}
			{closingNote && (
				<Caption
					color={closingSoon ? (colors.error.ink as string) : "tertiary"}
				>
					{closingNote}
				</Caption>
			)}
		</View>
	);
}

/* ── Event ── */

/** The event's start, or null if the server sent something unparseable. */
export function eventStart(item: FeedEventItem): Date | null {
	const start = new Date(item.event.startAt);
	return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * The date, as a small stack in the left column of an event's body.
 *
 * This is the event layout's whole idea: an event is the one kind whose
 * headline fact is *when*, so `when` gets its own column and everything else
 * sets beside it. No other kind indents, so an event is identifiable from the
 * shape of the card - which is the job the "Event" label no longer has to do.
 *
 * It carries **no border and no padding**. Boxed, it was a 50pt tile beside a
 * 22pt title, which made the date the tallest thing in the row and gave the
 * card the look of a dashboard widget. Two lines of type indent just as
 * clearly and cost the height of two lines of type.
 */
export function EventDate({ start }: { start: Date }) {
	return (
		<View style={{ width: 38 }}>
			<Caption
				color="tertiary"
				weight="semibold"
				style={{ textTransform: "uppercase", letterSpacing: 0.6 }}
			>
				{MONTH.format(start)}
			</Caption>
			<Label weight="bold">{DAY.format(start)}</Label>
		</View>
	);
}

/** When, where, and how many spots. */
export function EventFacts({ item }: { item: FeedEventItem }) {
	const { colors, spacing } = useTheme();
	const { event } = item;

	const start = eventStart(item);
	const accepted = event.acceptedCount;
	const total = event.volunteersNeeded;
	const full = total > 0 && accepted >= total;
	const place = event.venue ?? item.city;
	const ratio = total > 0 ? Math.min(1, accepted / total) : 0;

	// One line, because they are one thought: when and where. Two icon rows for
	// two short strings was more furniture than fact.
	const when = [start ? WEEKDAY_TIME.format(start) : null, place]
		.filter(Boolean)
		.join("  ·  ");

	if (!when && total === 0) return null;

	return (
		<View style={{ gap: spacing[2] }}>
			{when ? (
				<Caption color="tertiary" numberOfLines={1}>
					{when}
				</Caption>
			) : null}
			{total > 0 && (
				<GaugeRow
					text={full ? "All spots filled" : `${accepted} of ${total} spots`}
					ratio={ratio}
					fill={(full ? colors.text.disabled : colors.primary.main) as string}
					label={`${accepted} of ${total} volunteers accepted`}
					max={total}
					now={accepted}
				/>
			)}
		</View>
	);
}
