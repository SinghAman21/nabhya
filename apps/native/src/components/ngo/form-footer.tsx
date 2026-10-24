import { View } from "react-native";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";

/**
 * The pinned footer of an NGO create/edit drawer: the secondary action
 * (Save as draft) beside the primary one (Publish), the primary last.
 *
 * On desktop the pair sits at the end of the row, each button sized to its
 * label; a note, when there is one, takes the start of the same row. On a
 * phone the two share the row half and half (the caller passes `grow` from
 * `useFormButtonGrow` as each button's style) and the note sits above them.
 * It replaces two full-width buttons stacked in a centred dialog, which read
 * as a menu of equal choices rather than one action and its alternative.
 */
export function FormFooterRow({
	primary,
	secondary,
	note,
}: {
	primary: React.ReactNode;
	secondary?: React.ReactNode;
	/** Why an action is missing - "Publishing: verify your documents first". */
	note?: string | null;
}) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();

	const buttons = (
		<View
			style={{
				flexDirection: "row",
				gap: spacing[2],
				...(isDesktop ? { flexShrink: 0 } : { alignSelf: "stretch" }),
			}}
		>
			{secondary}
			{primary}
		</View>
	);

	if (!isDesktop) {
		return (
			<View style={{ gap: spacing[2] }}>
				{note ? <Caption color="tertiary">{note}</Caption> : null}
				{buttons}
			</View>
		);
	}

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "flex-end",
				gap: spacing[4],
			}}
		>
			{note ? (
				<Caption color="tertiary" style={{ flex: 1, minWidth: 0 }}>
					{note}
				</Caption>
			) : null}
			{buttons}
		</View>
	);
}

/** `{ flex: 1 }` for a footer button on a phone, nothing on desktop. */
export function useFormButtonGrow() {
	const { isDesktop } = useMedia();
	return isDesktop ? undefined : { flex: 1 };
}
