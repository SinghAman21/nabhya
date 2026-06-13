import { View } from "react-native";
import { Body, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";

export default function Profile() {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H2>Profile</H2>
			<Body color="secondary">Coming soon</Body>
		</View>
	);
}
