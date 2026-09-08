import { useWindowDimensions, View } from "react-native";
import { Field } from "@/components/form-field";
import type { Fact } from "@/components/screen-shell";
import { FactList, SectionTitle, Surface } from "@/components/screen-shell";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Pieces shared by the NGO and user dossier sheets: the section wrapper, the
 * fact table, and the reason field that gates every destructive decision.
 */

/**
 * A titled block inside a dossier. Both sheets had a private copy of this
 * three-line component, which is how their spacing was free to drift apart.
 */
export function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[5] }}>
			<SectionTitle>{title}</SectionTitle>
			{children}
		</View>
	);
}

/**
 * The dossier's fact table.
 *
 * **Two columns on a wide panel, one on a phone.** The dossier is a `Drawer`
 * with `xl` (720), and an NGO carries nine facts: stacked, they are a screen of
 * scrolling before the documents — which are the thing the reviewer opened the
 * panel for. Paired, they are five rows. Below 560 it stays a single column,
 * because a label and its value in half of a 360dp screen wrap to three lines
 * each.
 *
 * Label above value, never label-left/value-right — that shape puts a phone
 * number a hand's width from the word "Phone" and wraps a two-line address
 * against its label. Same reasoning as `FactList`, which this uses directly in
 * the one-column case.
 *
 * Empty facts show as a dash rather than disappearing, which is the one thing
 * the reviewer needs that a public profile does not: a missing registration
 * number is *the* finding on an NGO awaiting verification.
 */
export function FactGroup({ facts }: { facts: Fact[] }) {
	const { colors, spacing } = useTheme();
	const { width } = useWindowDimensions();

	if (width < 560) return <FactList facts={facts} showEmpty />;

	return (
		<Surface padded={false}>
			<View style={{ flexDirection: "row", flexWrap: "wrap" }}>
				{facts.map((fact, index) => (
					<View
						key={fact.label}
						accessible
						accessibilityRole="text"
						accessibilityLabel={`${fact.label}: ${
							typeof fact.value === "string" && fact.value
								? fact.value
								: "not provided"
						}`}
						style={{
							width: "50%",
							paddingHorizontal: spacing[4],
							paddingVertical: spacing[3],
							gap: spacing[0.5],
							// Hairlines between rows and between the columns, so the pairs
							// read as a table rather than as two lists that happen to be
							// side by side. Row 0 gets no top rule; the left cell gets no
							// left rule.
							borderTopWidth: index > 1 ? 1 : 0,
							borderTopColor: colors.border.hairline,
							borderLeftWidth: index % 2 === 1 ? 1 : 0,
							borderLeftColor: colors.border.hairline,
						}}
					>
						<Caption color="tertiary">{fact.label}</Caption>
						{typeof fact.value === "string" && fact.value ? (
							<Body selectable>{fact.value}</Body>
						) : (
							fact.value || <Body color="quaternary">—</Body>
						)}
					</View>
				))}
			</View>
		</Surface>
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
	const { colors } = useTheme();

	return (
		<Field
			label="Reason"
			hint={`Required to ${requiredFor}`}
			{...(error ? { error } : {})}
		>
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
		</Field>
	);
}
