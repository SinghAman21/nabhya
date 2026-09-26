import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * A quiet text button for the secondary actions on a card footer - Edit,
 * Remove, View. Drawn as text so the card's one primary affordance (tapping
 * it) stays the loudest thing, but sized and labelled as a real control.
 */
export function TextAction({
	label,
	onPress,
	tone = "default",
	disabled,
	accessibilityLabel,
}: {
	label: string;
	onPress: () => void;
	tone?: "default" | "brand" | "danger";
	disabled?: boolean;
	accessibilityLabel?: string;
}) {
	const { colors, spacing } = useTheme();
	const color =
		tone === "danger"
			? (colors.error.ink as string)
			: tone === "brand"
				? (colors.primary.ink as string)
				: "secondary";

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			hitSlop={8}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ disabled: !!disabled }}
			{...focusable}
			style={({ pressed }) => ({
				minHeight: 32,
				justifyContent: "center",
				paddingHorizontal: spacing[1],
				opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
			})}
		>
			<Caption weight="medium" color={color}>
				{label}
			</Caption>
		</Pressable>
	);
}
