import { ArrowRight } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";
import type { FeedItem, FeedNeedItem } from "@/lib/types";

/**
 * What the card's one action does, decided from the row's server state.
 *
 * Kept out of the card body because every branch is a product rule about
 * backend state rather than a layout decision, and because the card used to
 * decide this inline in an IIFE no test could reach.
 *
 * Two shapes, and the difference is whether the row is asking for something.
 * **Solid** is the commitment - "I can help", "Claim this", "View & apply" -
 * and is the only saturated element on the card. **Quiet** is a link with an
 * arrow, for a destination that asks nothing. A story has neither (the body
 * carries an inline "Read more") and so does an update, because "View NGO"
 * duplicated the header, which is already a link to the same page.
 */

export interface Cta {
	label: string;
	onPress: () => void;
	variant: "solid" | "quiet";
}

export function primaryCta(
	item: FeedItem,
	handlers: {
		onRespond: (item: FeedNeedItem) => void;
		openEvent: () => void;
	},
): Cta | null {
	switch (item.kind) {
		case "need": {
			const { status, type } = item.need;
			// A closed need gets no control at all. The kicker already says
			// "Closed" or "Fulfilled", and a disabled button that still looks like
			// a button invites a tap that does nothing and never explains itself.
			if (status !== "OPEN") return null;
			return {
				label: type === "WANT" ? "I can help" : "Claim this",
				onPress: () => handlers.onRespond(item),
				variant: "solid",
			};
		}

		case "event": {
			const { startAt, volunteersNeeded, acceptedCount } = item.event;
			const past = Date.parse(startAt) < Date.now();
			const full = volunteersNeeded > 0 && acceptedCount >= volunteersNeeded;
			// Past and full still open the event - the page carries the details and
			// what happened. Only the wording and the weight change, so the reader
			// is not promised a form that is not there.
			if (past || full) {
				return {
					label: "View event",
					onPress: handlers.openEvent,
					variant: "quiet",
				};
			}
			return {
				label: "View & apply",
				onPress: handlers.openEvent,
				variant: "solid",
			};
		}

		default:
			return null;
	}
}

/**
 * The button. Sizes to its label, sits at the start of the row.
 *
 * Full-width was the worst thing on the desktop card: "I can help" is three
 * short words and it was stretched across the whole column, which reads as a
 * banner rather than as something you press.
 *
 * `primary.contrast` on `primary.main` is the one pairing the token file
 * guarantees on a solid fill (7.44:1). White here is 2.53:1 - the failure that
 * token exists to prevent. Hover comes from the style callback rather than a
 * `useState`, so pointing at a button does not re-render the card around it.
 */
export function CtaButton({ cta }: { cta: Cta }) {
	const { colors, spacing, borderRadius } = useTheme();
	const { label, onPress, variant } = cta;

	if (variant === "quiet") {
		return (
			<View style={{ flexDirection: "row" }}>
				<Pressable
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel={label}
					hitSlop={8}
					{...focusable}
					style={(state) => {
						const { hovered } = state as PressState;
						return {
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
							paddingVertical: spacing[1],
							opacity: hovered ? 1 : 0.85,
						};
					}}
				>
					<Caption weight="semibold" color="secondary">
						{label}
					</Caption>
					<ArrowRight
						size={14}
						color={colors.text.secondary as string}
						strokeWidth={2.25}
					/>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={{ flexDirection: "row" }}>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						alignItems: "center",
						justifyContent: "center",
						minHeight: 36,
						paddingHorizontal: spacing[4],
						paddingVertical: spacing[2],
						borderRadius: borderRadius.md,
						backgroundColor: (pressed
							? colors.primary.dark
							: hovered
								? colors.primary.light
								: colors.primary.main) as string,
					};
				}}
			>
				<Label
					weight="semibold"
					style={{ color: colors.primary.contrast as string }}
				>
					{label}
				</Label>
			</Pressable>
		</View>
	);
}
