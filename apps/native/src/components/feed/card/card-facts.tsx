import { Clock, type LucideIcon, MapPin } from "lucide-react-native";
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
 * A gauge is **thick** - 8pt. An event's is also **short**, 120pt at the end of
 * its line. A need's used to be too, and at desktop width that put the count
 * and its bar ~450pt apart; it now spans its own inset block, directly under
 * the count - see `NeedFacts`.
 */

const DAY_MS = 86_400_000;
/** Inside this window a need is "closing soon" and says so. */
const CLOSING_SOON_MS = 3 * DAY_MS;

/** Wide enough to read a fraction off, short enough to see whole. */
const GAUGE_WIDTH = 120;
const GAUGE_HEIGHT = 8;

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric" });
/** "Sat, 18 Oct" - a need's deadline. */
const DEADLINE = new Intl.DateTimeFormat("en-IN", {
	weekday: "short",
	day: "numeric",
	month: "short",
});
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
	width,
	track,
}: {
	ratio: number;
	fill: string;
	label: string;
	max: number;
	now: number;
	/** Omit to span the parent - the need block. Events pass `GAUGE_WIDTH`. */
	width?: number;
	track?: string;
}) {
	const { colors } = useTheme();
	return (
		<View
			style={{
				...(width !== undefined ? { width } : { alignSelf: "stretch" }),
				height: GAUGE_HEIGHT,
				borderRadius: 999,
				backgroundColor: track ?? colors.background.subtle,
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
			<Gauge
				ratio={ratio}
				fill={fill}
				label={label}
				max={max}
				now={now}
				width={GAUGE_WIDTH}
			/>
		</View>
	);
}

/* ── Need ── */

/**
 * One inset block that reads as a sentence: how many are still needed, how
 * far along, where to bring them, and by when.
 *
 * This replaced a 120pt gauge pinned to the far end of a "20 of 52" line. On a
 * phone that was fine; at desktop width the count sat at the left edge and the
 * bar ~450pt away at the right, so the two halves of one measurement were read
 * separately, if at all. The count now leads and the bar sits **directly under
 * it, spanning the block** - the block is narrow enough (it is inside the
 * card's padding, and inset again) that a full-width bar no longer reads as a
 * divider, which was the reason the short gauge existed.
 *
 * It leads with the **remainder** ("32 blankets still needed"), not the
 * progress. The remainder is what a volunteer can act on; "20 of 52" is kept,
 * muted, on the same line for the reader who wants the whole.
 *
 * The block is `background.subtle` - a neutral inset, not a tone. The rule
 * against tinted blocks (see the card shell) is about colour carrying a label;
 * this carries facts and is grey in both schemes.
 */
export function NeedFacts({ item }: { item: FeedNeedItem }) {
	const { colors, spacing, borderRadius } = useTheme();
	// Read once per mount. Recomputing `Date.now()` on every render made
	// "closing soon" a value that could flip mid-interaction.
	const [now] = useState(() => Date.now());
	const { need } = item;

	const target = need.quantity ?? 0;
	const done = need.fulfilledQuantity ?? 0;
	const remaining = Math.max(0, target - done);
	const ratio = target > 0 ? Math.min(1, done / target) : 0;
	const complete = target > 0 && remaining === 0;
	const unit = need.unit ? ` ${need.unit}` : "";

	const expiresAt = need.expiresAt ? new Date(need.expiresAt) : null;
	const validExpiry =
		expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
	const msLeft = validExpiry ? validExpiry.getTime() - now : null;
	const expired = msLeft !== null && msLeft <= 0;
	const closingSoon = msLeft !== null && msLeft > 0 && msLeft < CLOSING_SOON_MS;
	const closesToday =
		validExpiry !== null &&
		!expired &&
		new Date(now).toDateString() === validExpiry.toDateString();

	const deadline = validExpiry
		? expired
			? "Closed"
			: closesToday
				? "Closes today"
				: `By ${DEADLINE.format(validExpiry)}`
		: null;
	const dropOff = item.city ? `Drop off in ${item.city}` : null;

	if (target === 0 && !deadline && !dropOff) return null;

	return (
		<View
			style={{
				gap: spacing[2],
				paddingHorizontal: spacing[3.5],
				paddingVertical: spacing[3],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			{target > 0 && (
				<>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: spacing[3],
						}}
					>
						<Label weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
							{complete
								? `Target met - ${target}${unit}`
								: `${remaining}${unit} still needed`}
						</Label>
						<Caption color="quaternary" numberOfLines={1}>
							{done} of {target}
						</Caption>
					</View>
					<Gauge
						ratio={ratio}
						fill={
							(complete ? colors.success.main : colors.primary.main) as string
						}
						// Inside the subtle block, the card's usual track colour would
						// vanish into its own ground; `border.medium` is one step darker
						// in light and one lighter in dark.
						track={colors.border.medium as string}
						label={`${done} of ${target}${unit} collected`}
						max={target}
						now={done}
					/>
				</>
			)}
			{(dropOff || deadline) && (
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						columnGap: spacing[4],
						rowGap: spacing[1.5],
					}}
				>
					{dropOff && <Fact icon={MapPin} text={dropOff} />}
					{deadline && (
						<Fact
							icon={Clock}
							text={deadline}
							// Closing soon keeps its old weight: the error ink, now on
							// the deadline itself rather than on a separate line.
							{...(closingSoon ? { color: colors.error.ink as string } : {})}
						/>
					)}
				</View>
			)}
		</View>
	);
}

function Fact({
	icon: Icon,
	text,
	color,
}: {
	icon: LucideIcon;
	text: string;
	color?: string;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[1.5],
				flexShrink: 1,
			}}
		>
			<Icon
				size={16}
				color={color ?? (colors.text.quaternary as string)}
				strokeWidth={2}
			/>
			<Caption
				color={color ?? "secondary"}
				weight={color ? "semibold" : "normal"}
				numberOfLines={1}
				style={{ flexShrink: 1 }}
			>
				{text}
			</Caption>
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
