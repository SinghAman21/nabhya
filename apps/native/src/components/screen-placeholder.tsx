import { View } from "react-native";
import { Body, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";

export function ScreenPlaceholder({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H2 style={{ marginBottom: spacing[2] }}>{title}</H2>
			<Body color="secondary">{description}</Body>
		</View>
	);
}
