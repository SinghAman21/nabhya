import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface InputProps extends TextInputProps {}

export function Input({ style, ...props }: InputProps) {
	const { colors, borderRadius, spacing } = useTheme();

	return (
		<TextInput
			placeholderTextColor={colors.text.quaternary}
			style={[
				{
					fontFamily: "MonaSans",
					fontSize: 15,
					color: colors.text.primary,
					backgroundColor: colors.background.secondary,
					borderColor: colors.border.medium,
					borderWidth: 1,
					borderRadius: borderRadius.md,
					padding: spacing[4],
				},
				style,
			]}
			{...props}
		/>
	);
}
