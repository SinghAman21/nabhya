import type { LucideIcon } from "lucide-react-native";
import { Switch, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * A labelled on/off setting with a real native switch.
 *
 * Used for the two booleans the composer owns - Urgent and Pinned - where a
 * chip hid the fact that the control is a toggle. The whole row is tappable;
 * the switch itself is the native one so it looks and behaves like every
 * other toggle on the device.
 */
export function SwitchRow({
	icon: Icon,
	title,
	hint,
	value,
	onChange,
	disabled,
	tone = "primary",
}: {
	icon: LucideIcon;
	title: string;
	hint: string;
	value: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
	tone?: "primary" | "error";
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const accent = tone === "error" ? colors.error : colors.primary;

	return (
		<Pressable
			onPress={() => onChange(!value)}
			disabled={disabled}
			accessibilityRole="switch"
			accessibilityLabel={title}
			accessibilityHint={hint}
			accessibilityState={{ checked: value, disabled: !!disabled }}
			{...focusable}
			style={({ pressed, hovered }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				paddingVertical: spacing[3],
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor:
					pressed || hovered
						? colors.background.subtle
						: colors.background.tertiary,
				opacity: disabled ? 0.5 : 1,
			})}
		>
			<Icon
				size={17}
				strokeWidth={2}
				color={
					(value
						? (accent.ink as string)
						: (colors.text.tertiary as string)) as string
				}
			/>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Label numberOfLines={1}>{title}</Label>
				<Caption color="quaternary" numberOfLines={2}>
					{hint}
				</Caption>
			</View>
			<Switch
				value={value}
				disabled={disabled}
				onValueChange={onChange}
				accessibilityLabel={title}
				trackColor={{
					false: colors.border.medium as string,
					true: (tone === "error"
						? colors.error.main
						: colors.primary.main) as string,
				}}
				thumbColor={"#FFFFFF"}
			/>
		</Pressable>
	);
}
