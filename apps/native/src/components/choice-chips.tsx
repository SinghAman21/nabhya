import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * Segmented choice in a form: post type, urgency, organisation type.
 *
 * Selection is monochrome - an ink pill, the same as `FilterChips` - because
 * orange is the colour of the primary action and a chosen option is not an
 * action. Radio semantics: one group, one checked value.
 */
export function ChoiceChips<T extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
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
						active={option.value === value}
						role="radio"
						onPress={() => onChange(option.value)}
					/>
				))}
			</View>
			{selected?.hint && (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					{selected.hint}
				</Caption>
			)}
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
	options: ReadonlyArray<{ value: T; label: string }>;
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

function Chip({
	label,
	active,
	role,
	disabled,
	onPress,
}: {
	label: string;
	active: boolean;
	role: "radio" | "checkbox";
	disabled?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={6}
			accessibilityRole={role}
			accessibilityLabel={label}
			accessibilityState={{ checked: active, disabled: !!disabled }}
			{...focusable}
			style={({ pressed }) => ({
				minHeight: 38,
				justifyContent: "center",
				paddingHorizontal: spacing[3.5],
				borderRadius: 999,
				backgroundColor: active
					? (colors.text.primary as string)
					: pressed
						? colors.background.subtle
						: "transparent",
				borderWidth: active ? 0 : 1,
				borderColor: colors.border.medium,
				opacity: disabled ? 0.4 : 1,
			})}
		>
			<Caption
				weight="medium"
				color={active ? (colors.text.inverse as string) : "secondary"}
			>
				{label}
			</Caption>
		</Pressable>
	);
}
