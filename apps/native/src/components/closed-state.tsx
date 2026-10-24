import { View } from "react-native";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/**
 * Where an action would be, when there is no action to take: "Applications
 * closed", "All places filled", "Fully met".
 *
 * A statement, not a control - a neutral well with the reason in words. These
 * used to be a disabled brand `Button`, which at half opacity is a muddy
 * orange bar: still the shape of something to press, and the colour of a
 * warning. Used by the event and need detail pages, in the desktop action card
 * and the phone's pinned footer alike.
 */
export function ClosedState({
	title,
	description,
}: {
	title: string;
	description?: string;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			accessible
			accessibilityLabel={description ? `${title}. ${description}` : title}
			style={{
				backgroundColor: colors.background.subtle,
				borderRadius: borderRadius.lg,
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
				gap: spacing[0.5],
			}}
		>
			<Label weight="semibold" color="secondary">
				{title}
			</Label>
			{description ? <Caption color="tertiary">{description}</Caption> : null}
		</View>
	);
}
