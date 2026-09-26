import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ListGroup, ListRow, SectionTitle } from "@/components/screen-shell";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * The pieces the two wizards share below the shell: the reassurance column,
 * the review list, and the completion screen.
 */

/* -------------------------------------------------------------------------- */
/* Reassurance                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What is being asked and why, as a short list of headed lines.
 *
 * Not a `Surface`: on desktop this is a column beside the form, and a card
 * there reads as a second form. Hairline-separated lines with an icon well is
 * the same recipe the verification screen's aside uses.
 */
export function WizardAside({
	title,
	points,
}: {
	title: string;
	points: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }>;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ gap: spacing[4] }}>
			<Label weight="semibold" color="tertiary">
				{title}
			</Label>
			<View style={{ gap: spacing[5] }}>
				{points.map(({ icon: Icon, title: pointTitle, body }) => (
					<View
						key={pointTitle}
						style={{ flexDirection: "row", gap: spacing[3] }}
					>
						<View
							style={{
								width: 32,
								height: 32,
								borderRadius: 16,
								backgroundColor: colors.primary.tint,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Icon
								size={16}
								strokeWidth={2}
								color={colors.primary.ink as string}
							/>
						</View>
						<View style={{ flex: 1, minWidth: 0, gap: spacing[0.5] }}>
							<Label weight="semibold">{pointTitle}</Label>
							<Caption color="tertiary">{body}</Caption>
						</View>
					</View>
				))}
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Review                                                                     */
/* -------------------------------------------------------------------------- */

export interface ReviewRow {
	label: string;
	value?: string | null;
	/** Jumps back to the step that owns this value. */
	onEdit?: () => void;
}

/**
 * One group of what the wizard collected, every row a way back to its step.
 *
 * The old NGO review drew its own two-column key/value table inside a
 * `Surface`, with the values right-aligned and nothing tappable - so spotting a
 * typo meant pressing Back four times. It is now the app's grouped list, and a
 * row is the edit control, which is what the volunteer wizard already did.
 */
export function ReviewSection({
	title,
	rows,
}: {
	title: string;
	rows: ReviewRow[];
}) {
	const { spacing } = useTheme();

	return (
		<View style={{ marginBottom: spacing[5] }}>
			<SectionTitle>{title}</SectionTitle>
			<ListGroup>
				{rows.map((row) => (
					<ListRow
						key={row.label}
						label={row.label}
						hint={row.value?.trim() || "Not given"}
						{...(row.onEdit ? { onPress: row.onEdit } : {})}
					/>
				))}
			</ListGroup>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Done                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The screen after the submit lands.
 *
 * Both wizards used to `router.replace()` straight into the app the instant the
 * request returned, which threw away the only moment either account is
 * guaranteed to be paying attention to the one thing left to do - upload
 * documents, for an NGO, and verify an identity, for a volunteer. Neither is
 * something the product can ask for later with any authority.
 *
 * So: confirm what happened, name the next step, and offer the way past it.
 * `next` is the recommended action; `skip` is always present, because a wall
 * with no door is how people abandon an account they have already created.
 */
export function WizardDone({
	icon: Icon,
	title,
	lede,
	steps,
	actions,
}: {
	icon: LucideIcon;
	title: string;
	lede: string;
	/** What happens next, in order, as plain sentences. */
	steps?: readonly string[];
	actions: ReactNode;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ gap: spacing[6] }}>
			<View style={{ gap: spacing[4] }}>
				<View
					style={{
						width: 56,
						height: 56,
						borderRadius: 28,
						backgroundColor: colors.success.bg,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Icon
						size={28}
						strokeWidth={2}
						color={colors.success.ink as string}
					/>
				</View>
				<View style={{ gap: spacing[1.5] }}>
					<H2 accessibilityRole="header">{title}</H2>
					<Body color="tertiary">{lede}</Body>
				</View>
			</View>

			{steps?.length ? (
				<View style={{ gap: spacing[3] }}>
					{steps.map((step, index) => (
						<View
							key={step}
							style={{
								flexDirection: "row",
								gap: spacing[3],
								alignItems: "flex-start",
							}}
						>
							<View
								style={{
									width: 22,
									height: 22,
									borderRadius: 11,
									marginTop: 1,
									backgroundColor: colors.background.subtle,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Caption weight="bold" color="tertiary">
									{index + 1}
								</Caption>
							</View>
							<Body color="secondary" style={{ flex: 1 }}>
								{step}
							</Body>
						</View>
					))}
				</View>
			) : null}

			<View style={{ gap: spacing[2] }}>{actions}</View>
		</View>
	);
}
