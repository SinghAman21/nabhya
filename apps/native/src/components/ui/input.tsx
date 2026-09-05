import {
	BottomSheetTextInput,
	useBottomSheetInternal,
} from "@gorhom/bottom-sheet";
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export interface InputProps extends TextInputProps {}

export function Input({ style, ...props }: InputProps) {
	const { colors, borderRadius, spacing } = useTheme();
	// Inside a `Sheet` the field has to tell the sheet when it takes focus, so
	// the sheet rises with the keyboard. Outside one the hook returns null.
	const inSheet = useBottomSheetInternal(true) !== null;
	const Field = inSheet ? BottomSheetTextInput : TextInput;

	return (
		<Field
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
