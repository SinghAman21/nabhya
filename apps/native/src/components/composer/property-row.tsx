import type { LucideIcon } from "lucide-react-native";
import { Plus, X } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * The composer's properties, as one wrapping row of chips.
 *
 * This replaces two heavier things: a full-width switch row per boolean, and a
 * `+ Add a closing date` line per optional field. Both were correct and both
 * were too big - an announcement whose only property is "pinned" got a 60pt
 * card with an icon well and two lines of prose, which read as the most
 * important thing on a screen whose point is the writing above it.
 *
 * A chip row is the minimal form of the same information: what is on, what is
 * off, and what else you could add, in one line you can scan without reading.
 * The rules that keep it honest are:
 *
 * - **A toggle chip shows its state in its fill**, not in a separate control.
 *   On is the tone's tint with the tone's ink; off is the neutral surface.
 * - **An add chip becomes the thing it added.** Pressing `＋ Closing date`
 *   opens the field below the row and the chip stays, now filled, so the row
 *   is always the index of what this post carries.
 * - **Anything the author cannot set is a sentence, not a chip.** An event's
 *   urgency is derived from its start date; a chip for it would be a control
 *   that does nothing. `PropertyNote` is where those go.
 */
export function PropertyRow({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				alignItems: "center",
				gap: spacing[2],
			}}
		>
			{children}
		</View>
	);
}

/**
 * A quiet line under the row, for facts the author does not set - where the
 * post will be filed, or why urgency is not on offer for this type.
 */
export function PropertyNote({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();

	return (
		<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
			{children}
		</Caption>
	);
}

/**
 * The fields a chip revealed, spaced off the row above them.
 *
 * The row and its note sit tight together; a `Field` carries its own bottom
 * margin but no top one, so without this the first revealed field butts
 * straight against the note. Rendering nothing when there is nothing revealed
 * is the point - a wrapper that always emitted its margin would leave a gap
 * under the chip row on every type that has no open field, which is the common
 * case.
 */
export function RevealedFields({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();
	const any = Array.isArray(children) ? children.some(Boolean) : !!children;

	if (!any) return null;
	return <View style={{ marginTop: spacing[5] }}>{children}</View>;
}

/**
 * One property, in one of three states.
 *
 * `off` and `on` are the two halves of a toggle; `add` is the invitation to
 * open an optional field. They are one component because they are one row and
 * must be the same size and shape in it - three components would have drifted
 * on padding the first time one of them changed.
 */
export function PropertyChip({
	icon: Icon,
	label,
	state,
	tone = "primary",
	onPress,
	onClear,
	disabled,
}: {
	icon: LucideIcon;
	label: string;
	/**
	 * `add` draws a `＋` and the neutral surface; `off` draws the icon and the
	 * neutral surface; `on` draws the icon and the tone.
	 */
	state: "add" | "off" | "on";
	tone?: "primary" | "error";
	onPress: () => void;
	/**
	 * When set and the chip is `on`, a trailing ✕ removes the property rather
	 * than toggling it. Optional fields need this: pressing the chip should
	 * re-open the field to edit, and only the ✕ should clear it.
	 */
	onClear?: () => void;
	disabled?: boolean;
}) {
	const { colors, spacing } = useTheme();
	const on = state === "on";
	const accent = tone === "error" ? colors.error : colors.primary;
	const accentBg = (
		tone === "error" ? colors.error.bg : colors.primary.tint
	) as string;
	const ink = on ? (accent.ink as string) : (colors.text.secondary as string);

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				borderRadius: 999,
				overflow: "hidden",
				backgroundColor: on ? accentBg : (colors.background.subtle as string),
				opacity: disabled ? 0.5 : 1,
			}}
		>
			<Pressable
				onPress={onPress}
				disabled={disabled}
				// A toggle announces as a switch; an add-chip is a button that
				// reveals a field, which is what `expanded` says.
				accessibilityRole={state === "add" ? "button" : "switch"}
				accessibilityLabel={label}
				accessibilityState={
					state === "add"
						? { expanded: false, disabled: !!disabled }
						: { checked: on, disabled: !!disabled }
				}
				// 32pt chip, 44pt target.
				hitSlop={6}
				{...focusable}
				style={({ pressed, hovered }) => ({
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[1.5],
					minHeight: 32,
					paddingLeft: spacing[2.5],
					paddingRight: onClear && on ? spacing[1.5] : spacing[3],
					backgroundColor:
						pressed || hovered
							? (colors.background.tertiary as string)
							: "transparent",
				})}
			>
				{state === "add" ? (
					<Plus size={13} strokeWidth={2.4} color={ink} />
				) : (
					<Icon size={13} strokeWidth={2.2} color={ink} />
				)}
				<Caption weight="semibold" style={{ color: ink }}>
					{label}
				</Caption>
			</Pressable>

			{onClear && on && (
				<Pressable
					onPress={onClear}
					disabled={disabled}
					accessibilityRole="button"
					accessibilityLabel={`Remove ${label}`}
					hitSlop={8}
					{...focusable}
					style={({ pressed, hovered }) => ({
						alignSelf: "stretch",
						justifyContent: "center",
						paddingLeft: spacing[1],
						paddingRight: spacing[2],
						backgroundColor:
							pressed || hovered
								? (colors.background.tertiary as string)
								: "transparent",
					})}
				>
					<X size={12} strokeWidth={2.4} color={ink} />
				</Pressable>
			)}
		</View>
	);
}
