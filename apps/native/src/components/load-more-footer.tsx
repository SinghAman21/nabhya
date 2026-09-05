import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

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

	if (loading) {
		return (
			<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
				<ActivityIndicator
					size="small"
					color={colors.text.quaternary as string}
				/>
			</View>
		);
	}

	if (hasMore) {
		return (
			<View style={{ paddingVertical: spacing[5], alignItems: "center" }}>
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
