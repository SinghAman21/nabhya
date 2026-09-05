import type { TextProps } from "react-native";
import { Label as TypographyLabel } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

interface LabelProps extends TextProps {}

export function Label({ children, style, ...props }: LabelProps) {
	const { spacing } = useTheme();

	return (
		<TypographyLabel
			color="secondary"
			style={[{ marginBottom: spacing[1.5] }, style]}
			{...props}
		>
			{children}
		</TypographyLabel>
	);
}
