import { Pressable, View } from "react-native";
import { Body, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function OnboardingStep2() {
	const { colors, borderRadius, spacing } = useTheme();
	const setOnboarded = useAuthStore((s) => s.setOnboarded);

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H2 style={{ marginBottom: spacing[4] }}>Almost there!</H2>
			<Body color="secondary" style={{ marginBottom: spacing[8] }}>
				You're all set to start using Nabhya.
			</Body>

			<Pressable
				onPress={setOnboarded}
				style={{
					backgroundColor: colors.primary.main,
					padding: spacing[4],
					borderRadius: borderRadius.lg,
					alignItems: "center",
				}}
			>
				<Body color={colors.primary.contrast as string} weight="bold">
					Complete
				</Body>
			</Pressable>
		</View>
	);
}
