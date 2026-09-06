import type { NeedType } from "@nabhya/shared";
import { FlashList } from "@shopify/flash-list";
import { Redirect } from "expo-router";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	View,
	type ViewStyle,
	type ViewToken,
} from "react-native";
import { FeedCard } from "@/components/feed/feed-card";
import { FeedFilterSheet, FeedTabs } from "@/components/feed/feed-filters";
import { NeedPreviewDrawer } from "@/components/need-preview-drawer";
import { NgoRail } from "@/components/ngo-rail";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { useToggleFollow } from "@/hooks/use-engagement";
import {
	useFeed,
	useFeedReaction,
	useRecordFeedInteraction,
} from "@/hooks/use-feed";
import { useCategories } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * NGO feed — the shared ranking feed with all content kinds and tab lenses.
 *
 * For you / Trending / Following show all tags; Urgent narrows to urgent items.
 *
 * Lives inside the `(ngo)` group (not top-level) so the desktop sidebar and
 * the mobile tab bar stay mounted — the NGO's landing page, with every other
 * destination one tap away in the same chrome.
 *
 * On desktop this is three columns — sidebar, feed, `NgoRail` — mirroring the
 * volunteer home's feed + `DiscoverRail` split.
 */
const STICKY_RAIL = {
	width: 320,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

export default function NgoFeed() {
	const role = useAuthStore((s) => s.role);
	const isOrg = role === "organisation";
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const categories = useCategories();
	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");
	const impression = useRecordFeedInteraction("impression");
	const seen = useRef(new Set<string>());
	const onViewableItemsChanged = useRef(
		({ viewableItems }: { viewableItems: ViewToken[] }) => {
			for (const token of viewableItems) {
				const item = token.item as FeedItem | undefined;
				if (!item) continue;
				const key = `${item.kind}:${item.id}`;
				if (seen.current.has(key)) continue;
				seen.current.add(key);
				impression.mutate({ item });
			}
		},
	).current;
	const [tab, setTab] = useState<
		"for_you" | "following" | "trending" | "urgent"
	>("for_you");
	const [categoryIds, setCategoryIds] = useState<string[]>([]);
	const [needType, setNeedType] = useState<NeedType | undefined>();
	const [filtersOpen, setFiltersOpen] = useState(false);
	// The need under preview. Pledging is volunteers-only server-side, so for
	// an organisation "I can help" previews in place (a drawer on desktop, a
	// sheet elsewhere) instead of pushing the NGO page.
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);

	const feed = useFeed(
		{
			tab,
			...(categoryIds.length ? { categoryIds } : {}),
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
		// On desktop the header sits inside the feed column, past the Screen
		// gutter — so it carries its own inset to line up with the cards.
		<View style={isDesktop ? { paddingHorizontal: spacing[5] } : undefined}>
			<ScreenHeader title="Feed" />
			<FeedTabs
				tab={tab}
				onTab={setTab}
				gutter={spacing[5]}
				onOpenFilters={() => setFiltersOpen(true)}
				filterActive={categoryIds.length > 0 || !!needType}
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

	const list = (
		<FlashList
			data={items}
			keyExtractor={(item: FeedItem) => `${item.kind}:${item.id}`}
			renderItem={({ item }) => (
				<FeedCard
					item={item}
					onRespond={setResponding}
					onToggleFollow={(organizationId, following) =>
						toggleFollow.mutate({ organizationId, following })
					}
					onToggleLike={(row, liked) => like.mutate({ item: row, on: !liked })}
					onToggleSave={(row, saved) => save.mutate({ item: row, on: !saved })}
				/>
			)}
			ListFooterComponent={footer}
			ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
			onEndReached={loadMore}
			onEndReachedThreshold={0.6}
			onViewableItemsChanged={onViewableItemsChanged}
			viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
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
	);

	return (
		<Screen>
			{isDesktop ? (
				<View style={{ flex: 1, flexDirection: "row", gap: spacing[6] }}>
					<View style={{ flex: 1 }}>
						{header}
						{list}
					</View>
					<View style={STICKY_RAIL}>
						<NgoRail />
					</View>
				</View>
			) : (
				<>
					{header}
					{list}
				</>
			)}

			<FeedFilterSheet
				visible={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				categories={categories.data ?? []}
				categoryIds={categoryIds}
				onCategories={setCategoryIds}
				needType={needType}
				onNeedType={setNeedType}
			/>
			<NeedPreviewDrawer
				item={responding}
				onClose={() => setResponding(null)}
				onToggleFollow={(organizationId, following) =>
					toggleFollow.mutate({ organizationId, following })
				}
			/>
		</Screen>
	);
}
