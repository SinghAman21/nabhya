import type { FeedTab } from "@nabhya/shared";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Flame, HeartHandshake, Sparkles, UserPlus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	View,
	type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_INDIA, CityPicker } from "@/components/city-picker";
import { DiscoverRail } from "@/components/discover-rail";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import {
	type FeedContent,
	FeedFilterSheet,
	FeedTabs,
	feedContentQuery,
	feedFilterCount,
} from "@/components/feed/feed-filters";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
} from "@/components/screen-shell";
import { SearchButton } from "@/components/search-panel";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Caption, Title } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import {
	useFeed,
	useFeedReaction,
	useRecordFeedInteraction,
} from "@/hooks/use-feed";
import { useCategories, useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useFeedStore } from "@/store/feed-store";

/**
 * The discover column.
 *
 * `alignSelf: "stretch"` and its own scroller, not `position: sticky`: the rail
 * is a sibling of the feed's `FlatList`, not a child of it, so sticky has no
 * scrolling ancestor to stick to - it only made the column size to its content
 * and clip the bottom of "Happening soon" with no way to reach it. Same fix as
 * `(ngo)/feed.tsx`, which is the other caller of this rail.
 */
const RAIL: ViewStyle = {
	width: 320,
	flexGrow: 0,
	flexShrink: 0,
	alignSelf: "stretch",
};

export default function Home() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();

	const [tab, setTab] = useState<FeedTab>("for_you");
	const [categoryIds, setCategoryIds] = useState<string[]>([]);
	const [content, setContent] = useState<FeedContent>("all");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);

	// All India unless the person picked a city themselves - their home city
	// is offered in the picker, never applied for them. See `feed-store.ts`.
	const city = useFeedStore((s) => s.city);
	const setCity = useFeedStore((s) => s.setCity);

	const me = useMe();
	const homeCity = me.data?.city ?? null;

	const categories = useCategories();
	const filterCount = feedFilterCount(categoryIds, content);

	// One choice in the sheet, two query params: see `feedContentQuery`.
	const contentQuery = feedContentQuery(content);
	const feed = useFeed({
		tab,
		...(categoryIds.length ? { categoryIds } : {}),
		...(city === ALL_INDIA ? {} : { city }),
		...contentQuery,
	});
	const items = useMemo(
		() => feed.data?.pages.flatMap((page) => page.items) ?? [],
		[feed.data],
	);

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

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	const gutter = spacing[4];

	/*
	 * Two rows: "Home" with the city scope and (on a phone) search at the
	 * right, then the lenses with the filter button. `Title`, sentence case -
	 * the display face only has capitals, which made a one-word page title
	 * the loudest thing on the screen.
	 */
	const header = (
		<View
			style={{
				paddingHorizontal: gutter,
				paddingTop: isDesktop ? spacing[4] : spacing[1],
				paddingBottom: spacing[3],
				gap: spacing[3],
				borderBottomWidth: 1,
				borderBottomColor: colors.border.hairline,
				backgroundColor: colors.background.warm,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					minHeight: 44,
				}}
			>
				<Title accessibilityRole="header" numberOfLines={1}>
					Home
				</Title>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1],
						flexShrink: 1,
					}}
				>
					<CityPicker value={city} onChange={setCity} homeCity={homeCity} />
					{!isDesktop && <SearchButton />}
				</View>
			</View>
			<FeedTabs
				tab={tab}
				onTab={setTab}
				gutter={gutter}
				onOpenFilters={() => setFiltersOpen(true)}
				filterCount={filterCount}
			/>
		</View>
	);

	const footer = feed.isLoading ? (
		<LoadingState label="Building your feed" />
	) : feed.isError ? (
		<ErrorState
			message={apiErrorMessage(feed.error)}
			onRetry={() => feed.refetch()}
		/>
	) : items.length === 0 ? (
		<FeedEmpty
			tab={tab}
			city={city}
			onAllIndia={() => setCity(ALL_INDIA)}
			onBrowseNgos={() => router.push("/ngos")}
			onForYou={() => setTab("for_you")}
			filtered={filterCount > 0}
			onClearFilters={() => {
				setCategoryIds([]);
				setContent("all");
			}}
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

	/*
	 * Stable handlers, so `FeedCard`'s `memo` can actually hold.
	 *
	 * Written inline in `renderItem` these were a new function on every render,
	 * which fails the memo comparison for every card in the list - so a like,
	 * which now writes straight into the query cache, re-rendered every card
	 * and every video player in it. Each closes only over a mutation's `mutate`,
	 * which react-query keeps stable, so these dependencies never change.
	 */
	// The card's Follow disappears on press, so without a toast nothing says
	// it worked or offers a way back - unfollowing otherwise lives on the NGO
	// page. The name is looked up through a ref so the handler stays stable for
	// the memoised `FeedCard` while pages load.
	const itemsRef = useRef(items);
	useEffect(() => {
		itemsRef.current = items;
	}, [items]);
	const handleToggleFollow = useCallback(
		(organizationId: string, following: boolean) =>
			toggleFollow.mutate(
				{ organizationId, following },
				{
					onSuccess: () => {
						if (following) return;
						const name = itemsRef.current.find(
							(row) => row.organization?.id === organizationId,
						)?.organization?.organizationName;
						toast.success(name ? `Following ${name}` : "Following", {
							label: "Undo",
							onPress: () =>
								toggleFollow.mutate({ organizationId, following: true }),
						});
					},
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			),
		[toggleFollow.mutate],
	);
	const handleToggleLike = useCallback(
		(row: FeedItem, isLiked: boolean) =>
			like.mutate({ item: row, on: !isLiked }),
		[like.mutate],
	);
	const handleToggleSave = useCallback(
		(row: FeedItem, isSaved: boolean) =>
			save.mutate({ item: row, on: !isSaved }),
		[save.mutate],
	);

	const list = (
		<FlashList
			data={items}
			keyExtractor={(item) => `${item.kind}:${item.id}`}
			renderItem={({ item }) => (
				<FeedCard
					item={item}
					onRespond={setResponding}
					onToggleFollow={handleToggleFollow}
					onToggleLike={handleToggleLike}
					onToggleSave={handleToggleSave}
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
			onViewableItemsChanged={onViewableItemsChanged}
			viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
			onEndReached={loadMore}
			onEndReachedThreshold={0.6}
			{...verticalScrollbar}
			contentContainerStyle={{
				paddingHorizontal: 0,
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
	);

	return (
		<Screen
			style={{
				paddingHorizontal: 0,
				paddingTop: insets.top + spacing[1],
			}}
		>
			{isDesktop ? (
				<View
					style={{
						flex: 1,
						minHeight: 0,
						flexDirection: "row",
						gap: spacing[6],
						paddingRight: spacing[5],
					}}
				>
					<View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
						{header}
						{list}
					</View>
					{/* No scrollbar: this column is chrome, and a thumb on it reads
					    as a second page competing with the feed's. */}
					<ScrollView
						showsVerticalScrollIndicator={false}
						style={RAIL}
						contentContainerStyle={{
							paddingTop: spacing[4],
							paddingBottom: spacing[10],
						}}
					>
						<DiscoverRail />
					</ScrollView>
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
				content={content}
				onContent={setContent}
			/>
			<PledgeSheet
				need={responding ? toPublicNeed(responding) : null}
				onClose={() => setResponding(null)}
			/>
		</Screen>
	);
}

/* ── Empty states ── */
function FeedEmpty({
	tab,
	city,
	onAllIndia,
	onBrowseNgos,
	onForYou,
	filtered,
	onClearFilters,
}: {
	tab: FeedTab;
	city: string;
	onAllIndia: () => void;
	onBrowseNgos: () => void;
	onForYou: () => void;
	/** A cause or content filter from the sheet is narrowing the feed. */
	filtered: boolean;
	onClearFilters: () => void;
}) {
	const scoped = city !== ALL_INDIA;

	// `Button` rather than a bare Pressable around a Label: it brings the focus
	// ring, the 38pt target and the disabled/pressed states a hand-rolled link
	// had none of.
	const link = (label: string, onPress: () => void) => (
		<Button variant="link" size="sm" onPress={onPress}>
			{label}
		</Button>
	);

	// A filter set in the sheet is out of sight once the sheet closes, so an
	// empty feed under one read as "nothing here" - and the offered fix
	// (widen the city) left the real cause in place.
	if (filtered) {
		return (
			<EmptyState
				icon={HeartHandshake}
				title="Nothing matches your filters"
				description={
					scoped
						? `No posts in ${city} for the causes or kinds you picked.`
						: "No posts for the causes or kinds you picked."
				}
				action={link("Clear filters", onClearFilters)}
			/>
		);
	}

	switch (tab) {
		case "following":
			return (
				<EmptyState
					icon={UserPlus}
					title="You don't follow any NGOs yet"
					description="Follow the ones you care about and their needs, events and updates will show up here."
					action={link("Browse NGOs", onBrowseNgos)}
				/>
			);
		case "trending":
			return (
				<EmptyState
					icon={Flame}
					title={scoped ? `Quiet week in ${city}` : "Nothing trending yet"}
					description="Trending shows what volunteers are responding to this week."
					action={
						scoped
							? link("Show all of India", onAllIndia)
							: link("See what's for you", onForYou)
					}
				/>
			);
		case "urgent":
			return (
				<EmptyState
					icon={Sparkles}
					title="Nothing urgent right now"
					description={
						scoped
							? `No urgent asks in ${city}. That's good news.`
							: "No urgent asks anywhere. That's good news."
					}
					{...(scoped ? { action: link("Show all of India", onAllIndia) } : {})}
				/>
			);
		default:
			return (
				<EmptyState
					icon={HeartHandshake}
					title="Nothing here yet"
					description={
						scoped
							? `No open posts in ${city}.`
							: "Verified NGOs will post what they need here."
					}
					{...(scoped ? { action: link("Show all of India", onAllIndia) } : {})}
				/>
			);
	}
}
