import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

/** A `sm` button (38) and its 20pt of air either side. */
const FOOTER_HEIGHT = 78;

/**
 * Footer for a paginated `FlatList`. Every list endpoint returns a
 * `Paginated<T>` envelope; this is the one place the "next page" affordance is
 * drawn, so every list ends the same way: a spinner while the page loads, an
 * explicit "Load more" while there is one (`onEndReached` is unreliable on web
 * and on short lists), and a quiet count once there is not.
 */
export function LoadMoreFooter({
	hasMore,
	loading,
	onLoadMore,
	count,
	noun,
}: {
	hasMore: boolean;
	loading: boolean;
	onLoadMore: () => void;
	/** Rows rendered so far; drives the "all N shown" line. */
	count: number;
	/** Plural noun for the closing line, e.g. "events". */
	noun?: string;
}) {
	const { colors, spacing } = useTheme();

	if (count === 0) return null;

	// The spinner and the button occupy the same box, so pressing "Load more"
	// swaps one for the other without nudging the rows above it.
	const slot = {
		minHeight: FOOTER_HEIGHT,
		paddingVertical: spacing[5],
		alignItems: "center",
		justifyContent: "center",
	} as const;

	if (loading) {
		return (
			<View
				style={slot}
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel="Loading more"
			>
				<ActivityIndicator
					size="small"
					color={colors.text.quaternary as string}
				/>
			</View>
		);
	}

	if (hasMore) {
		return (
			<View style={slot}>
				<Button variant="outline" size="sm" onPress={onLoadMore}>
					Load more
				</Button>
			</View>
		);
	}

	if (!noun || count < 8) return <View style={{ height: spacing[4] }} />;

	return (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<Caption color="quaternary">
				All {count} {noun} shown
			</Caption>
		</View>
	);
}
