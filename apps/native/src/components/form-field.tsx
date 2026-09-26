import { type StyleProp, View, type ViewStyle } from "react-native";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * The one form-field recipe for the NGO screens and sheets.
 *
 * Label above the input, `spacing[1.5]` between them, `spacing[5]` between
 * fields, and the error drawn inline under the field in the tone's ink - never
 * in `error.main`, which is a fill colour and unreadable as 13px type.
 */
export function Field({
	label,
	optional,
	hint,
	error,
	children,
	style,
}: {
	label: string;
	/** Appends a quiet "(optional)" to the label. */
	optional?: boolean;
	/** Helper text under the input; hidden while an error is showing. */
	hint?: string;
	error?: string;
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const { spacing } = useTheme();

	return (
		<View style={[{ marginBottom: spacing[5] }, style]}>
			<Label style={{ marginBottom: spacing[1.5] }}>
				{label}
				{optional && <Caption color="tertiary"> (optional)</Caption>}
			</Label>
			{children}
			{hint && !error && (
				<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
					{hint}
				</Caption>
			)}
			<FieldError message={error} />
		</View>
	);
}

export function FieldError({ message }: { message?: string | null }) {
	const { colors, spacing } = useTheme();
	if (!message) return null;
	return (
		<Caption
			accessibilityLiveRegion="polite"
			color={colors.error.ink}
			style={{ marginTop: spacing[1] }}
		>
			{message}
		</Caption>
	);
}

/**
 * The quiet input treatment used inside cards and sheets: no outline, a
 * subtle fill, a 12pt radius. Pass `multilineHeight` for a text area.
 */
export function useFieldInputStyle(multilineHeight?: number) {
	const { colors, spacing, borderRadius } = useTheme();
	return {
		borderWidth: 0,
		borderRadius: borderRadius.md,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
		...(multilineHeight
			? { minHeight: multilineHeight, textAlignVertical: "top" as const }
			: {}),
	};
}
