import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Body, H1 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";

export default function OnboardingStep1() {
	const { colors, borderRadius, spacing } = useTheme();
	const router = useRouter();

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H1 style={{ marginBottom: spacing[4] }}>Welcome to Nabhya</H1>
			<Body color="secondary" style={{ marginBottom: spacing[8] }}>
				Let's get you set up in just a few steps.
			</Body>

			<Pressable
				onPress={() => router.push("/(onboarding)/step-2")}
				style={{
					backgroundColor: colors.primary.main,
					padding: spacing[4],
					borderRadius: borderRadius.lg,
					alignItems: "center",
				}}
			>
				<Body color={colors.primary.contrast as string} weight="bold">
					Get started
				</Body>
			</Pressable>
		</View>
	);
}
