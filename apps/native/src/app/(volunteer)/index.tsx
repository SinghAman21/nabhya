import type { FeedTab, NeedType } from "@nabhya/shared";
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
	View,
	type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_INDIA, CityPicker } from "@/components/city-picker";
import { DiscoverRail } from "@/components/discover-rail";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import { FeedFilterSheet, FeedTabs } from "@/components/feed/feed-filters";
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
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useFeedStore } from "@/store/feed-store";

/**
 * Home — one feed for everything a volunteer can act on.
 *
 * Needs, offers, events and NGO updates arrive interleaved and ranked by the
 * server; the tabs are lenses over that one list, not separate lists, so a
 * volunteer never has to know whether the thing they want is a "need" or an
 * "event" before they can find it. The cause (the platform's verticals) and
 * the city narrow it further, and all of it is a real server filter — nothing
 * here reinterprets one page of results on the client.
 *
 * The header is two short rows and nothing else: "Home" with the city picker
 * and search on the right — this is a local product, so "where" stays one tap
 * away — then the lens chips with the cause filter folded into a sheet.
 * Notifications live in the Activity tab, so there is no bell up here, and the
 * whole header is fixed rather than scrolling away and coming back as a
 * different one.
 */

/**
 * `position: "sticky"` is web-only and absent from React Native's `ViewStyle`
 * union, so the cast lives in one place instead of inside the screen.
 */
const STICKY_RAIL = {
	width: 320,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

export default function Home() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const router = useRouter();

	const [tab, setTab] = useState<FeedTab>("for_you");
	const [categoryIds, setCategoryIds] = useState<string[]>([]);
	const [needType, setNeedType] = useState<NeedType | undefined>();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);
	const [detectedCity, setDetectedCity] = useState<string | null>(null);
	const [showCityFallback, setShowCityFallback] = useState(false);

	// Desktop's top bar owns a search field bound to this store; on a phone
	// search is its own page, so the term is ignored there.
	const storeSearch = useFeedStore((s) => s.search);
	const search = isDesktop ? storeSearch : "";
	const city = useFeedStore((s) => s.city);
	const setCity = useFeedStore((s) => s.setCity);
	const cityTouched = useFeedStore((s) => s.cityTouched);

	// Scope to the user's own city on first load, and only until they choose —
	// after that their choice stands for the session.
	const me = useMe();
	const homeCity = me.data?.city ?? null;
	useEffect(() => {
		if (!cityTouched && homeCity) setCity(homeCity);
	}, [cityTouched, homeCity, setCity]);

	const categories = useCategories();
	const debouncedSearch = useDebounced(search.trim());

	const feed = useFeed({
		tab,
		...(categoryIds.length ? { categoryIds } : {}),
		...(city === ALL_INDIA ? {} : { city }),
		...(debouncedSearch ? { search: debouncedSearch } : {}),
		...(needType ? { needType } : {}),
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
			!needType
		) {
			setDetectedCity(null);
			setCity("Mumbai");
			setShowCityFallback(true);
		}
	}, [
		categoryIds.length,
		city,
		debouncedSearch,
		detectedCity,
		feed.data,
		feed.isError,
		feed.isLoading,
		needType,
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

	// Header keeps a small inset so text never touches the edge; the feed
	// rows themselves are full-bleed tiles (no outer gutter).
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
								// backgroundColor: pressed
								//   ? colors.background.tertiary
								//   : colors.background.subtle,
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
				filterActive={categoryIds.length > 0 || !!needType}
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
						// height: spacing[2],
						backgroundColor: colors.background.warm,
						borderTopWidth: 1,
						borderBottomWidth: 1,
						borderColor: colors.border.hairline,
					}}
				/>
			)}
			onViewableItemsChanged={onViewableItemsChanged}
			viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
			onEndReached={loadMore}
			onEndReachedThreshold={0.6}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{
				paddingHorizontal: 0,
				paddingTop: 0,
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
				// Tighter than a titled page: the city row is the title.
				paddingTop: insets.top + spacing[1],
			}}
		>
			{isDesktop ? (
				<View
					style={{
						flex: 1,
						flexDirection: "row",
						gap: spacing[6],
						paddingRight: spacing[5],
					}}
				>
					<View style={{ flex: 1 }}>
						{header}
						{list}
					</View>
					<View style={STICKY_RAIL}>
						<DiscoverRail />
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
			<PledgeSheet
				need={responding ? toPublicNeed(responding) : null}
				onClose={() => setResponding(null)}
			/>
		</Screen>
	);
}

/* -------------------------------------------------------------------------- */
/* Empty states                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Each lens empties for a different reason, and says so. "Nothing here" on the
 * Following tab reads as a broken app; "you don't follow anyone yet" reads as
 * an invitation.
 */
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
