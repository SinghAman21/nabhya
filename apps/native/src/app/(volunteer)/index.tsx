import type { FeedTab } from "@nabhya/shared";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import {
	Flame,
	HeartHandshake,
	Search,
	Sparkles,
	UserPlus,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/components/feed/feed-filters";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
} from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H2, Label } from "@/components/ui/typography";
import { typography } from "@/constants/design-system";
import { useToggleFollow } from "@/hooks/use-engagement";
import {
	useFeed,
	useFeedReaction,
	useRecordFeedInteraction,
} from "@/hooks/use-feed";
import { useCategories, useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useFeedStore } from "@/store/feed-store";

/**
 * The discover column.
 *
 * `alignSelf: "stretch"` and its own scroller, not `position: sticky`: the rail
 * is a sibling of the feed's `FlatList`, not a child of it, so sticky has no
 * scrolling ancestor to stick to — it only made the column size to its content
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
	const [detectedCity, setDetectedCity] = useState<string | null>(null);
	const [showCityFallback, setShowCityFallback] = useState(false);

	const storeSearch = useFeedStore((s) => s.search);
	const search = isDesktop ? storeSearch : "";
	const city = useFeedStore((s) => s.city);
	const setCity = useFeedStore((s) => s.setCity);
	const cityTouched = useFeedStore((s) => s.cityTouched);

	const me = useMe();
	const homeCity = me.data?.city ?? null;
	useEffect(() => {
		if (!cityTouched && homeCity) setCity(homeCity);
	}, [cityTouched, homeCity, setCity]);

	const categories = useCategories();
	const debouncedSearch = useDebounced(search.trim());

	// One choice in the sheet, two query params: see `feedContentQuery`.
	const contentQuery = feedContentQuery(content);
	const feed = useFeed({
		tab,
		...(categoryIds.length ? { categoryIds } : {}),
		...(city === ALL_INDIA ? {} : { city }),
		...(debouncedSearch ? { search: debouncedSearch } : {}),
		...contentQuery,
	});
	useEffect(() => {
		const firstPage = feed.data?.pages[0];
		if (
			!feed.isLoading &&
			!feed.isError &&
			firstPage &&
			firstPage.items.length === 0 &&
			detectedCity &&
			detectedCity !== "Mumbai" &&
			city === detectedCity &&
			!debouncedSearch &&
			categoryIds.length === 0 &&
			content === "all"
		) {
			setDetectedCity(null);
			setCity("Mumbai");
			setShowCityFallback(true);
		}
	}, [
		categoryIds.length,
		city,
		content,
		debouncedSearch,
		detectedCity,
		feed.data,
		feed.isError,
		feed.isLoading,
		setCity,
	]);
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

	const header = (
		<View
			style={{
				paddingHorizontal: gutter,
				paddingBottom: spacing[3],
				gap: spacing[2],
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
					minHeight: 44,
				}}
			>
				<H2
					style={{ fontFamily: typography.fontFamily.display }}
					accessibilityRole="header"
				>
					Home
				</H2>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<CityPicker
						value={city}
						onChange={(nextCity) => {
							setDetectedCity(null);
							setShowCityFallback(false);
							setCity(nextCity);
						}}
						onDetectedCity={(nextCity) => {
							setDetectedCity(nextCity);
							setShowCityFallback(false);
						}}
						homeCity={homeCity}
					/>
					{!isDesktop && (
						<Pressable
							onPress={() => router.push("/search")}
							accessibilityRole="button"
							accessibilityLabel="Search"
							hitSlop={8}
							{...focusable}
							style={({ pressed }) => ({
								width: 38,
								height: 38,
								borderRadius: 999,
								alignItems: "center",
								justifyContent: "center",
							})}
						>
							<Search
								size={20}
								color={colors.text.primary as string}
								strokeWidth={2}
							/>
						</Pressable>
					)}
				</View>
			</View>
			{showCityFallback && (
				<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
					No opportunities found nearby, so showing Mumbai instead.
				</Caption>
			)}
			<FeedTabs
				tab={tab}
				onTab={setTab}
				gutter={gutter}
				onOpenFilters={() => setFiltersOpen(true)}
				filterActive={categoryIds.length > 0 || content !== "all"}
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
			search={debouncedSearch}
			city={city}
			onAllIndia={() => setCity(ALL_INDIA)}
			onBrowseNgos={() => router.push("/ngos")}
			onForYou={() => setTab("for_you")}
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

	const list = (
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
					onToggleLike={(row, liked) => like.mutate({ item: row, on: !liked })}
					onToggleSave={(row, saved) => save.mutate({ item: row, on: !saved })}
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
							paddingTop: spacing[1],
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
	search,
	city,
	onAllIndia,
	onBrowseNgos,
	onForYou,
}: {
	tab: FeedTab;
	search: string;
	city: string;
	onAllIndia: () => void;
	onBrowseNgos: () => void;
	onForYou: () => void;
}) {
	const { colors } = useTheme();
	const scoped = city !== ALL_INDIA;

	const link = (label: string, onPress: () => void) => (
		<Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
			<Label weight="semibold" color={colors.primary.ink}>
				{label}
			</Label>
		</Pressable>
	);

	if (search) {
		return (
			<EmptyState
				icon={Search}
				title="No matching posts"
				description="Try a different word, or a wider area."
				{...(scoped ? { action: link("Show all of India", onAllIndia) } : {})}
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
