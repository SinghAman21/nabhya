import { View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import type { FeedItem } from "@/lib/types";

/**
 * The kicker — and, most of the time, nothing at all.
 *
 * This started as a row of filled pills, became a tertiary line naming every
 * row's kind, and is now the shortest of the three: **a kind that the layout
 * already announces does not get a label.** An event has a date in its left
 * column and no other kind indents; a story leads with its picture and a larger
 * title; an update is plainly just words. Printing "Event" above a card with a
 * date block on it is the caption under a photograph of a cat reading "cat".
 *
 * What survives is what the arrangement cannot say:
 *
 * - **A need's direction.** "Needs help" and "Giving away" are the same layout
 *   and opposite requests, and it is the difference the reader acts on.
 * - **Urgency**, which is not a property of the kind at all.
 * - **A closed state**, which otherwise shows only as a missing button.
 *
 * A healthy update, story or event therefore renders no kicker, which is most
 * of the feed — and that silence is what lets the rows that *do* carry one
 * register at a glance.
 */

function stateLabel(item: FeedItem): string | null {
	if (item.kind === "need") {
		if (item.need.status === "FULFILLED") return "Fulfilled";
		if (item.need.status !== "OPEN") return "Closed";
		return null;
	}
	if (item.kind === "event") {
		const { startAt, volunteersNeeded, acceptedCount } = item.event;
		if (Date.parse(startAt) < Date.now()) return "Past event";
		if (volunteersNeeded > 0 && acceptedCount >= volunteersNeeded) {
			return "Fully booked";
		}
	}
	if (item.kind === "story" && item.story.isPinned) return "Pinned";
	return null;
}

/** The only label a layout cannot carry: which way a need points. */
function directionLabel(item: FeedItem): string | null {
	if (item.kind !== "need") return null;
	return item.need.type === "WANT" ? "Needs help" : "Giving away";
}

export function CardKicker({ item }: { item: FeedItem }) {
	const { colors, spacing } = useTheme();
	const direction = directionLabel(item);
	const state = stateLabel(item);
	const parts = [direction, state].filter(Boolean) as string[];

	if (parts.length === 0 && !item.isUrgent) return null;

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[1.5],
			}}
		>
			{item.isUrgent && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1],
					}}
				>
					{/*
					 * Urgency was a 3pt rail across the top of the card. It read as an
					 * error banner over content that has not gone wrong, and it sat
					 * outside the card's padding, so it looked like chrome rather than
					 * like something the post was saying. One 5pt dot, in the line that
					 * describes the row, is the whole of it now.
					 */}
					<View
						style={{
							width: 5,
							height: 5,
							borderRadius: 999,
							backgroundColor: colors.error.main,
						}}
					/>
					<Caption
						weight="semibold"
						style={{ color: colors.error.ink as string }}
					>
						Urgent
					</Caption>
				</View>
			)}

			{parts.map((part, index) => (
				<View
					key={part}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
					}}
				>
					{(index > 0 || item.isUrgent) && (
						<View
							style={{
								width: 3,
								height: 3,
								borderRadius: 999,
								backgroundColor: colors.text.disabled,
							}}
						/>
					)}
					<Caption color="tertiary" weight="medium">
						{part}
					</Caption>
				</View>
			))}
		</View>
	);
}
