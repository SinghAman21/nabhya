import { Redirect } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";
import { FeedCard } from "@/components/feed/feed-card";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeed, useFeedReaction } from "@/hooks/use-feed";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { FeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * NGO feed — a posts-only view of the shared feed, with follow actions.
 */
export default function NgoFeed() {
	const role = useAuthStore((s) => s.role);
	const { colors, spacing } = useTheme();
	const isOrg = role === "organisation";
	const org = useMyOrganization(isOrg);
	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");
	const feed = useFeed({ kind: "post" }, isOrg);

	const items =
		feed.data?.pages
			.flatMap((page) => page.items)
			.filter(
				(item): item is FeedItem =>
					item.kind === "post" &&
					!!item.organization &&
					item.organization.id !== org.data?.id,
			) ?? [];

	if (role !== "organisation") return <Redirect href="/" />;

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	const footer = feed.isLoading ? (
		<LoadingState label="Building the feed" />
	) : feed.isError ? (
		<ErrorState
			message={apiErrorMessage(feed.error)}
			onRetry={() => feed.refetch()}
		/>
	) : items.length === 0 ? (
		<EmptyState
			title="No NGO posts yet"
			description="Once other organisations share updates, they’ll appear here."
		/>
	) : feed.isFetchingNextPage ? (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<ActivityIndicator color={colors.text.quaternary as string} />
		</View>
	) : feed.hasNextPage ? null : (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<EmptyState
				title="You're all caught up"
				description="Follow more NGOs to shape this feed."
			/>
		</View>
	);

	return (
		<Screen>
			<ScreenHeader title="Feed" />
			<FlatList
				data={items}
				keyExtractor={(item) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={() => {}}
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
					paddingBottom: spacing[12],
				}}
				refreshControl={undefined}
			/>
		</Screen>
	);
}
