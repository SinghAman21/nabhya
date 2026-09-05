import { View } from "react-native";
import { ListGroup } from "@/components/screen-shell";
import { Input } from "@/components/ui/input";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Pieces shared by the NGO and user dossier sheets: a fact table and the
 * reason field that gates every destructive decision.
 */

export interface Fact {
	label: string;
	value?: string | null;
}

/** Label left, value right, hairlines between — a table without looking like one. */
export function FactGroup({ facts }: { facts: Fact[] }) {
	const { spacing } = useTheme();

	return (
		<ListGroup>
			{facts.map((fact) => (
				<View
					key={fact.label}
					accessible
					accessibilityRole="text"
					accessibilityLabel={`${fact.label}: ${fact.value || "not provided"}`}
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "flex-start",
						gap: spacing[4],
						paddingHorizontal: spacing[4],
						paddingVertical: spacing[3],
						minHeight: 44,
					}}
				>
					<Caption color="tertiary" style={{ width: 96 }}>
						{fact.label}
					</Caption>
					<Caption
						weight="medium"
						color={fact.value ? "primary" : "quaternary"}
						style={{ flex: 1, textAlign: "right" }}
						selectable
					>
						{fact.value || "—"}
					</Caption>
				</View>
			))}
		</ListGroup>
	);
}

/**
 * The reason box above the decision buttons. Errors render under the field,
 * never in an alert — the reviewer is already looking here.
 */
export function ReasonField({
	value,
	onChangeText,
	placeholder,
	requiredFor,
	error,
}: {
	value: string;
	onChangeText: (text: string) => void;
	placeholder: string;
	/** "reject or suspend" — completes "Required to …". */
	requiredFor: string;
	error: string | null;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ marginBottom: spacing[4] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "baseline",
					gap: spacing[1.5],
					marginBottom: spacing[1.5],
				}}
			>
				<Label>Reason</Label>
				<Caption color="tertiary">Required to {requiredFor}</Caption>
			</View>
			<Input
				placeholder={placeholder}
				value={value}
				onChangeText={onChangeText}
				multiline
				maxLength={500}
				accessibilityLabel="Reason"
				{...(error ? { accessibilityHint: error } : {})}
				style={{
					minHeight: 88,
					textAlignVertical: "top",
					...(error ? { borderColor: colors.error.border } : {}),
				}}
			/>
			{error && (
				<Caption
					color={colors.error.ink}
					accessibilityLiveRegion="polite"
					style={{ marginTop: spacing[1.5] }}
				>
					{error}
				</Caption>
			)}
		</View>
	);
}
