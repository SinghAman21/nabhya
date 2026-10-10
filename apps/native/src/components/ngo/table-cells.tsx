import { View } from "react-native";
import { TextAction } from "@/components/text-action";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Cells the NGO's desktop tables share. The tables themselves are the
 * console's `DataTable` (via `ConsoleList`); these are only the two cell
 * shapes that would otherwise be written out once per screen.
 */

/**
 * "How many are waiting on you" as a table cell - applicants on an event,
 * pledges on a need. Warning ink when there is something to do and a quiet
 * dash when there is not, so the column reads as a scan for work: a column of
 * "0" is forty numbers to read, a column of dashes with two figures in it is
 * two.
 */
export function PendingCount({ count }: { count: number | null | undefined }) {
	const { colors } = useTheme();
	const value = count ?? 0;

	if (value === 0) return <Caption color="quaternary">-</Caption>;

	return (
		<Caption weight="medium" color={colors.warning.ink as string}>
			{value}
		</Caption>
	);
}

/**
 * Edit and Remove at the end of a row - the same two quiet text actions the
 * card puts in its footer, so a team member finds them in the same words on
 * either shape. A role that cannot use one gets no control rather than a
 * disabled one (`useOrgAccess` decides, the screen passes `undefined`); the
 * banner above the list already says why.
 *
 * They are `Pressable`s nested in the row's own, and win their own presses -
 * pressing Remove does not also open the row.
 */
export function RowActions({
	name,
	onEdit,
	onDelete,
	editLabel = "Edit",
	editTone = "default",
	deleteLabel = "Remove",
}: {
	/** The record's title, for the accessibility labels. */
	name: string;
	onEdit?: () => void;
	onDelete?: () => void;
	editLabel?: string;
	editTone?: "default" | "brand";
	/** "Delete" where the card says so - the row uses the card's words. */
	deleteLabel?: string;
}) {
	const { spacing } = useTheme();

	if (!onEdit && !onDelete) return null;

	return (
		<View style={{ flexDirection: "row", gap: spacing[3] }}>
			{onEdit && (
				<TextAction
					label={editLabel}
					tone={editTone}
					onPress={onEdit}
					accessibilityLabel={`Edit ${name}`}
				/>
			)}
			{onDelete && (
				<TextAction
					label={deleteLabel}
					tone="danger"
					onPress={onDelete}
					accessibilityLabel={`${deleteLabel} ${name}`}
				/>
			)}
		</View>
	);
}
