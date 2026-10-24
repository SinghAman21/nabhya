import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import type { Fact } from "@/components/screen-shell";
import { FactList, SectionTitle, Surface } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Pieces shared by the NGO and user dossier sheets: the section wrapper, the
 * fact table, and the reason step that gates every destructive decision.
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
 * scrolling before the documents - which are the thing the reviewer opened the
 * panel for. Paired, they are five rows. Below 560 it stays a single column,
 * because a label and its value in half of a 360dp screen wrap to three lines
 * each.
 *
 * Label above value, never label-left/value-right - that shape puts a phone
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
							fact.value || <Body color="quaternary">-</Body>
						)}
					</View>
				))}
			</View>
		</Surface>
	);
}

/**
 * The "why?" step of a decision that needs a reason - reject, suspend - drawn
 * in the drawer's pinned footer, in place of the buttons, once one is pressed.
 *
 * The reason used to be a field at the very end of the dossier body, below the
 * timeline, posts and documents, while the buttons were pinned in the footer.
 * Pressing Reject with it empty set an error on a field nobody could see, so
 * the press looked dead and got pressed again. Asking at the moment of the
 * press, where the press happened, removes the gap: the field cannot be
 * off-screen, and the consequence sits beside the box. It is not a sheet of
 * its own because the dossier is already a `Drawer` - a modal inside a modal
 * is the trap `app-shell`'s note on nesting describes.
 *
 * The text survives a failed request (only success unmounts the step), so a
 * 500 never costs the reviewer what they wrote.
 */
export function ReasonStep({
	title,
	consequence,
	placeholder,
	confirmLabel,
	pending,
	onCancel,
	onConfirm,
}: {
	/** "Why reject Asha Foundation?" */
	title: string;
	/** What happens on confirm, and who reads the reason. */
	consequence: string;
	placeholder: string;
	confirmLabel: string;
	pending: boolean;
	onCancel: () => void;
	onConfirm: (reason: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		const reason = text.trim();
		if (!reason) {
			setError("Add a reason - it is sent with the decision.");
			return;
		}
		setError(null);
		onConfirm(reason);
	};

	return (
		<View style={{ gap: spacing[2] }}>
			<Label weight="semibold">{title}</Label>
			<Caption color="tertiary">{consequence}</Caption>
			<Input
				placeholder={placeholder}
				value={text}
				onChangeText={(value) => {
					setText(value);
					if (error && value.trim()) setError(null);
				}}
				multiline
				autoFocus
				maxLength={500}
				accessibilityLabel="Reason"
				{...(error ? { accessibilityHint: error } : {})}
				style={{
					minHeight: 72,
					textAlignVertical: "top",
					...(error ? { borderColor: colors.error.border } : {}),
				}}
			/>
			{error ? (
				<Caption
					color={colors.error.ink as string}
					accessibilityLiveRegion="polite"
				>
					{error}
				</Caption>
			) : null}
			<View
				style={{
					flexDirection: "row",
					justifyContent: "flex-end",
					gap: spacing[2],
				}}
			>
				<Button variant="outline" onPress={onCancel} disabled={pending}>
					Cancel
				</Button>
				<Button variant="destructive" onPress={submit} loading={pending}>
					{confirmLabel}
				</Button>
			</View>
		</View>
	);
}

/**
 * The dossier footer's button row. Both drawers use it, so their footers
 * cannot drift into two recipes.
 *
 * Buttons **size to their labels** and wrap; none of them is full width. A
 * 100%-wide "Approve organization" in a 720pt panel is a banner, not a control
 * - the same reason the feed card's CTA hugs its label. Wrapping rather than
 * scrolling because on a narrow panel four buttons on two lines is readable and
 * four buttons you have to push sideways is not.
 */
export function DecisionBar({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[2],
			}}
		>
			{children}
		</View>
	);
}

/**
 * A destructive action that is *not* the footer's primary.
 *
 * The footers had "Suspend" and "Delete" as two filled red buttons side by
 * side: two equally loud alarms, so neither read as the main act, and the
 * heavier one (delete) sat where the hand lands last. At most one footer
 * button is a fill. A second destructive action is `outline` (a red hairline
 * and red label - still unmistakably destructive) or `text` (red label only,
 * for the rarer of the two), and it still opens the same `ReasonStep`, so
 * quieter never means less guarded.
 */
export function DangerButton({
	tone = "outline",
	onPress,
	disabled,
	loading,
	size = "default",
	accessibilityLabel,
	children,
}: {
	tone?: "outline" | "text";
	onPress: () => void;
	disabled?: boolean;
	loading?: boolean;
	size?: "default" | "sm";
	/** When the label alone does not say what it acts on (a row of posts). */
	accessibilityLabel?: string;
	children: string;
}) {
	const { colors } = useTheme();
	return (
		<Button
			variant={tone === "outline" ? "outline" : "ghost"}
			size={size}
			onPress={onPress}
			disabled={disabled}
			loading={loading}
			accessibilityLabel={accessibilityLabel ?? children}
			style={
				tone === "outline" ? { borderColor: colors.error.border } : undefined
			}
		>
			<Label weight="bold" color={colors.error.ink as string}>
				{children}
			</Label>
		</Button>
	);
}
