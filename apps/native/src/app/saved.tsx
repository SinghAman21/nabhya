import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { BookmarkCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeedReaction, useSavedFeed } from "@/hooks/use-feed";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedNeedItem } from "@/lib/types";

/**
 * Feed items the volunteer has saved via the reaction-bar bookmark — needs,
 * events, updates and announcements, in one list, most-recently-posted
 * first. Distinct from `/bookmarks` ("Saved NGOs"), which is the org-level
 * bookmark on an NGO's own page; see the note on `useSavedFeed`.
 */
function SavedFeed() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);

	const feed = useSavedFeed();
	const items = useMemo(
		() => feed.data?.pages.flatMap((page) => page.items) ?? [],
		[feed.data],
	);

	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	const footer = feed.isLoading ? (
		<LoadingState label="Loading saved posts" />
	) : feed.isError ? (
		<ErrorState
			message={apiErrorMessage(feed.error)}
			onRetry={() => feed.refetch()}
		/>
	) : items.length === 0 ? (
		<EmptyState
			icon={BookmarkCheck}
			title="No saved posts yet"
			description="Tap the bookmark on any need, event or update and it will be kept here."
			action={
				<Button size="sm" variant="outline" onPress={() => router.back()}>
					Back to feed
				</Button>
			}
		/>
	) : feed.isFetchingNextPage ? (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<ActivityIndicator color={colors.text.quaternary as string} />
		</View>
	) : feed.hasNextPage ? null : (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<Caption color="quaternary">You're all caught up</Caption>
		</View>
	);

	return (
		<Screen style={{ paddingHorizontal: 0 }}>
			<View style={{ paddingHorizontal: spacing[4] }}>
				<ScreenHeader
					back
					title="Saved posts"
					subtitle="Needs, events and updates you've saved."
				/>
			</View>
			<FlashList
				data={items}
				keyExtractor={(item) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={setResponding}
						onToggleFollow={(organizationId, following) =>
							toggleFollow.mutate({ organizationId, following })
						}
						onToggleLike={(row, liked) =>
							like.mutate({ item: row, on: !liked })
						}
						onToggleSave={(row, saved) =>
							save.mutate({ item: row, on: !saved })
						}
					/>
				)}
				ListFooterComponent={footer}
				ItemSeparatorComponent={() => (
					<View
						style={{
							height: spacing[2],
							backgroundColor: colors.background.warm,
						}}
					/>
				)}
				onEndReached={loadMore}
				onEndReachedThreshold={0.6}
				{...verticalScrollbar}
				contentContainerStyle={{
					paddingTop: spacing[2],
					paddingBottom: spacing[12],
					backgroundColor: colors.background.warm,
				}}
				refreshControl={
					<RefreshControl
						refreshing={feed.isRefetching && !feed.isFetchingNextPage}
						onRefresh={() => feed.refetch()}
						tintColor={colors.text.quaternary as string}
					/>
				}
			/>
			<PledgeSheet
				need={responding ? toPublicNeed(responding) : null}
				onClose={() => setResponding(null)}
			/>
		</Screen>
	);
}

export default withAppShell(SavedFeed);
