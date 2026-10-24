import { Platform, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";

/**
 * The one chip recipe. `FilterChips` (screen-shell), `ChoiceChips` and
 * `MultiChoiceChips` all draw this, so a filter row and a form choice can never
 * drift into two sizes, two borders and two selected states again.
 *
 * - **36pt tall, always one line.** The label never wraps and never truncates;
 *   a chip is as wide as its words. The 4pt `hitSlop` makes the target 44.
 * - **Selected is a solid ink fill** (`text.primary`, label in
 *   `text.inverse`) - monochrome, because orange is the colour of *doing*
 *   something and a filter is not an action.
 * - **Unselected is a quiet fill, no outline.** It used to be a 1px
 *   `border.medium` ring while the selected chip had no border at all, so the
 *   two states were different sizes of different things and the row looked
 *   uneven. Fill against fill reads as one control in two states, in both
 *   schemes.
 * - **`count`** is a quiet number after the label ("Pending 3"), spoken as part
 *   of the label. Zero is drawn too - "Rejected 0" is an answer.
 */

/** Extra room a row must leave around its chips so the focus ring is never cut. */
export const CHIP_RING_ROOM = 4;
export const CHIP_HEIGHT = 36;

export interface ChipOption<T extends string> {
	value: T;
	label: string;
	/** A quiet number inside the chip - "Pending 3". */
	count?: number;
}

export function Chip({
	label,
	count,
	active,
	role,
	disabled,
	onPress,
}: {
	label: string;
	count?: number | undefined;
	active: boolean;
	role: "radio" | "checkbox" | "tab";
	disabled?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, isDark } = useTheme();
	const hasCount = typeof count === "number";

	const rest = colors.background.subtle;
	const hover = isDark ? colors.background.overlay : colors.border.hairline;
	const down = isDark ? colors.border.dark : colors.background.overlay;

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
			accessibilityRole={role}
			accessibilityLabel={hasCount ? `${label}, ${count}` : label}
			accessibilityState={
				role === "tab"
					? { selected: active, disabled: !!disabled }
					: { checked: active, disabled: !!disabled }
			}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					height: CHIP_HEIGHT,
					flexShrink: 0,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[1.5],
					paddingHorizontal: spacing[3.5],
					borderRadius: 999,
					backgroundColor: active
						? (colors.text.primary as string)
						: pressed
							? down
							: hovered
								? hover
								: rest,
					opacity: disabled ? 0.4 : 1,
					...(Platform.OS === "web"
						? ({ cursor: disabled ? "default" : "pointer" } as object)
						: {}),
				};
			}}
		>
			<Caption
				weight="medium"
				numberOfLines={1}
				color={active ? (colors.text.inverse as string) : "secondary"}
				style={{ flexShrink: 0 }}
			>
				{label}
			</Caption>
			{typeof count === "number" ? (
				<Caption
					weight="medium"
					numberOfLines={1}
					color={active ? (colors.text.inverse as string) : "quaternary"}
					style={{
						flexShrink: 0,
						fontVariant: ["tabular-nums"],
						opacity: active ? 0.7 : 1,
					}}
				>
					{count > 999 ? "999+" : String(count)}
				</Caption>
			) : null}
		</Pressable>
	);
}

/**
 * Segmented choice in a form: post type, urgency, organisation type.
 *
 * Radio semantics: one group, one checked value. **Wraps rather than
 * scrolls**, unlike `FilterChips`: a form choice hidden past the right edge is
 * an option nobody knows exists, and the forms these sit in have the height to
 * spare. Same chip, same row gap.
 */
export function ChoiceChips<T extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: ReadonlyArray<ChipOption<T> & { hint?: string }>;
	value: T | undefined | null;
	onChange: (value: T) => void;
	/** Group name for assistive tech. */
	label?: string;
}) {
	const { spacing } = useTheme();
	const selected = options.find((option) => option.value === value);

	return (
		<View>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
			>
				{options.map((option) => (
					<Chip
						key={option.value}
						label={option.label}
						count={option.count}
						active={option.value === value}
						role="radio"
						onPress={() => onChange(option.value)}
					/>
				))}
			</View>
			{selected?.hint ? (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					{selected.hint}
				</Caption>
			) : null}
		</View>
	);
}

/** Pick-many variant, for causes. Checkbox semantics, optional cap. */
export function MultiChoiceChips<T extends string>({
	options,
	values,
	onToggle,
	max,
	label,
}: {
	options: ReadonlyArray<ChipOption<T>>;
	values: T[];
	onToggle: (value: T) => void;
	max?: number;
	label?: string;
}) {
	const { spacing } = useTheme();
	const full = max !== undefined && values.length >= max;

	return (
		<View
			accessibilityLabel={label}
			style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
		>
			{options.map((option) => {
				const active = values.includes(option.value);
				return (
					<Chip
						key={option.value}
						label={option.label}
						count={option.count}
						active={active}
						role="checkbox"
						disabled={full && !active}
						onPress={() => onToggle(option.value)}
					/>
				);
			})}
		</View>
	);
}
