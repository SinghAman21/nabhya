import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
	const { isDark, toggleTheme } = useAppTheme();
	const { colors } = useTheme();

	return (
		<View
			style={
				{
					position: "absolute",
					bottom: 24,
					right: 24,
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
				style={({ pressed }) => ({
					width: 40,
					height: 40,
					borderRadius: 9999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: pressed ? colors.background.tertiary : "transparent",
				})}
			>
				<Text style={{ fontSize: 22, color: colors.text.primary }}>
					{isDark ? "☀️" : "🌙"}
				</Text>
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
