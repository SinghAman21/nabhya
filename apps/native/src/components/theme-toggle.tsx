import { Moon, Sun } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { Pressable } from "@/components/ui/pressable";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useTheme } from "@/hooks/useTheme";

/**
 * Floating theme switch, rendered beside the tab navigator on mobile. It clears
 * the bar and the home-indicator inset — at `bottom: 24` it sat on top of the
 * tab bar itself, covering whichever tab was underneath it.
 *
 * This wants to be a row in Settings rather than a button floating over every
 * screen; it stays floating only because there is no settings surface yet, and
 * it is the sole way to change theme on a phone.
 */
export function ThemeToggle() {
	const { isDark, toggleTheme } = useAppTheme();
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={
				{
					position: "absolute",
					bottom: TAB_BAR_HEIGHT + insets.bottom + spacing[4],
					right: spacing[5],
					zIndex: 999,
					borderRadius: 9999,
					backgroundColor: colors.background.primary,
					borderWidth: 1,
					borderColor: colors.border.medium,
					...shadows,
				} as ViewStyle
			}
		>
			<Pressable
				onPress={toggleTheme}
				accessibilityRole="switch"
				accessibilityLabel="Dark mode"
				accessibilityState={{ checked: isDark }}
				hitSlop={6}
				style={({ pressed }) => ({
					width: 44,
					height: 44,
					borderRadius: 9999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: pressed ? colors.background.tertiary : "transparent",
				})}
			>
				{/* Lucide, not emoji: emoji render at the platform's whim, carry their
				    own colour, and read out as "sun with face" to a screen reader. */}
				{isDark ? (
					<Sun size={20} color={colors.text.primary as string} />
				) : (
					<Moon size={20} color={colors.text.primary as string} />
				)}
			</Pressable>
		</View>
	);
}

const shadows: ViewStyle = {
	shadowColor: "#000",
	shadowOffset: { width: 0, height: 2 },
	shadowOpacity: 0.25,
	shadowRadius: 8,
	elevation: 8,
};
