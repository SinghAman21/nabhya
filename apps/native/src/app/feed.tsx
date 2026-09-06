import type { NeedType } from "@nabhya/shared";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	View,
} from "react-native";
import { FeedCard } from "@/components/feed/feed-card";
import {
	ALL_CAUSES,
	FeedFilterSheet,
	FeedTabs,
} from "@/components/feed/feed-filters";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeed, useFeedReaction } from "@/hooks/use-feed";
import { useCategories } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * NGO feed — the shared ranking feed with all content kinds and tab lenses.
 *
 * For you / Trending / Following show all tags; Urgent narrows to urgent items.
 */
export default function NgoFeed() {
	const role = useAuthStore((s) => s.role);
	const isOrg = role === "organisation";
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const categories = useCategories();
	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");
	const [tab, setTab] = useState<
		"for_you" | "following" | "trending" | "urgent"
	>("for_you");
	const [categoryId, setCategoryId] = useState<string>(ALL_CAUSES);
	const [needType, setNeedType] = useState<NeedType | undefined>();
	const [filtersOpen, setFiltersOpen] = useState(false);

	const feed = useFeed(
		{
			tab,
			...(categoryId === ALL_CAUSES ? {} : { categoryId }),
			...(needType ? { needType } : {}),
		},
		isOrg,
	);

	const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

	if (!isOrg) return <Redirect href="/" />;

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	const header = (
		<View>
			<ScreenHeader title="Feed" />
			<FeedTabs
				tab={tab}
				onTab={setTab}
				gutter={spacing[5]}
				onOpenFilters={() => setFiltersOpen(true)}
				filterActive={categoryId !== ALL_CAUSES || !!needType}
			/>
		</View>
	);

	const footer = feed.isLoading ? (
		<LoadingState label="Building the feed" />
	) : feed.isError ? (
		<ErrorState
			message={apiErrorMessage(feed.error)}
			onRetry={() => feed.refetch()}
		/>
	) : items.length === 0 ? (
		<EmptyState
			title="Nothing here yet"
			description="Try another tab or remove the cause filter."
		/>
	) : feed.isFetchingNextPage ? (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<ActivityIndicator color={colors.text.quaternary as string} />
		</View>
	) : feed.hasNextPage ? null : (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<EmptyState
				title="You're all caught up"
				description="Refresh anytime for new posts."
			/>
		</View>
	);

	return (
		<Screen>
			{header}
			<FlatList
				data={items}
				keyExtractor={(item: FeedItem) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={(need: FeedNeedItem) => {
							if (need.organization?.id) {
								router.push({
									pathname: "/ngos/[id]",
									params: { id: need.organization.id },
								});
							}
						}}
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
				ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
				onEndReached={loadMore}
				onEndReachedThreshold={0.6}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: spacing[5],
					paddingTop: spacing[4],
					paddingBottom: spacing[12],
				}}
				refreshControl={
					<RefreshControl
						refreshing={feed.isRefetching && !feed.isFetchingNextPage}
						onRefresh={() => feed.refetch()}
						tintColor={colors.text.quaternary as string}
					/>
				}
			/>

			<FeedFilterSheet
				visible={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				categories={categories.data ?? []}
				categoryId={categoryId}
				onCategory={setCategoryId}
				needType={needType}
				onNeedType={setNeedType}
			/>
		</Screen>
	);
}
