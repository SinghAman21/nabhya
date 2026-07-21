import { View, type ViewProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface SeparatorProps extends ViewProps {
	orientation?: "horizontal" | "vertical";
}

export function Separator({
	orientation = "horizontal",
	style,
	...props
}: SeparatorProps) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				{
					backgroundColor: colors.border.medium,
				},
				orientation === "horizontal"
					? { height: 1, width: "100%" }
					: { width: 1, height: "100%" },
				style,
			]}
			{...props}
		/>
	);
}
