import type { PostTag } from "@nabhya/shared";
import { FlashList } from "@shopify/flash-list";
import { Redirect } from "expo-router";
import { PenLine } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	View,
	type ViewStyle,
	type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoverRail } from "@/components/discover-rail";
import { FeedCard } from "@/components/feed/feed-card";
import {
	type FeedContent,
	FeedFilterSheet,
	FeedTabs,
	feedContentQuery,
} from "@/components/feed/feed-filters";
import { NeedPreviewDrawer } from "@/components/need-preview-drawer";
import { PostComposer, PostComposerBar } from "@/components/post-composer";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Label } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import {
	useDeleteFeedPost,
	useFeed,
	useFeedReaction,
	useRecordFeedInteraction,
} from "@/hooks/use-feed";
import { useCategories, useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * NGO feed — the shared ranking feed, plus the one place the NGO can add to it.
 *
 * For you / Trending / Following show all tags; Urgent narrows to urgent items.
 *
 * Lives inside the `(ngo)` group (not top-level) so the desktop sidebar and
 * the mobile tab bar stay mounted — the NGO's landing page, with every other
 * destination one tap away in the same chrome.
 *
 * **The composer is the point of this screen.** `POST /api/feed` had no client
 * at all before: the composer component existed but nothing mounted it, so an
 * NGO could read the feed and never write to it. It is reachable three ways
 * here, and each is deliberate:
 *
 * - the prompt bar at the top of the list — the invitation, and where the two
 *   media/need shortcuts live;
 * - a header button on desktop, where a bar scrolled out of view is a dead end
 *   because there is no thumb-reachable corner to fall back on;
 * - a floating button on mobile, for the same reason inverted.
 *
 * ## Desktop columns
 *
 * Feed, then `DiscoverRail`. Nothing else: the rail briefly carried the org's
 * own pending decisions, metric tiles and verification nudge, which were a
 * second copy of four blocks the Dashboard already renders one nav item away —
 * so the feed page was doing the dashboard's job in a column beside itself.
 * A feed is a feed. What stays is `DiscoverRail`, the same component the
 * volunteer home uses, because *other* NGOs' urgent needs and upcoming events
 * are feed material — it is how an NGO finds out that somebody two districts
 * over needs the thing they have a surplus of.
 *
 * The feed column is capped at `FEED_MAX_WIDTH` — at 1920 an uncapped
 * `flex: 1` column drew 1500px-wide cards whose text ran forty words to the
 * line. A cap leaves a remainder, and `flex-start` piles all of it on one
 * side: at the `(ngo)` content cap of 1440 the pair comes to 1128, so 312pt
 * sat dead against the right edge and the whole thing read as shoved left.
 * `justifyContent: "center"` splits it 156/156 instead. Widening either column
 * to absorb it would be the wrong fix — 720 is already the top of a
 * comfortable measure, and the rail is short on content, so a wider rail is
 * just a wider gap.
 */

/**
 * The desktop rail: a fixed-width column that scrolls on its own.
 *
 * `flexGrow: 0` and `flexShrink: 0` are the load-bearing part. This is a
 * `ScrollView`, and react-native-web gives every ScrollView
 * `flexGrow: 1; flexShrink: 1` in its base style — which beats `width` when
 * the row has spare space, so the rail grew to ~700px and squeezed the feed
 * column down to its minimum. A `View` would have defaulted to `flexGrow: 0`
 * and this would never have come up.
 *
 * `alignSelf: "stretch"` rather than `position: sticky`: the rail is a sibling
 * of the feed's scroll container, not a child of it, so there is nothing for
 * sticky to stick to — it only made the column size to its content and clip.
 * Stretched, it is exactly as tall as the row and scrolls inside itself.
 */
const RAIL_WIDTH = 384;

const RAIL: ViewStyle = {
	width: RAIL_WIDTH,
	flexGrow: 0,
	flexShrink: 0,
	alignSelf: "stretch",
};

/** Comfortable measure for a card of prose, and where the media carousel is sized. */
const FEED_MAX_WIDTH = 720;

/** The gap between the two desktop columns. */
const COLUMN_GAP = 24;

/**
 * The feed column's inset, and the only place it is written down.
 *
 * It has to equal `FeedCard`'s own `marginHorizontal` (`spacing[3]`), because
 * the card supplies its own gutter and the header has to agree with it. The
 * `Screen` gutter is switched off on this route for the same reason — the
 * scroll container then reaches the edge of the pane, so its scrollbar sits
 * where a page's scrollbar sits instead of floating 20pt inside the content.
 */
const GUTTER = 12;

interface ComposerRequest {
	tag?: PostTag;
	withMedia?: boolean;
	drafts?: boolean;
}

export default function NgoFeed() {
	const role = useAuthStore((s) => s.role);
	const isOrg = role === "organisation";
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
	const categories = useCategories();
	const { data: me } = useMe(isOrg);
	const toggleFollow = useToggleFollow();
	const like = useFeedReaction("like");
	const save = useFeedReaction("save");
	const deletePost = useDeleteFeedPost();
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
	const [content, setContent] = useState<FeedContent>("all");
	const [filtersOpen, setFiltersOpen] = useState(false);
	// Null while closed. Held as the whole request, not as three booleans, so
	// the composer body can be keyed on it and remount per entry point.
	const [composer, setComposer] = useState<ComposerRequest | null>(null);
	// The need under preview. Pledging is volunteers-only server-side, so for
	// an organisation "I can help" previews in place (a drawer on desktop, a
	// sheet elsewhere) instead of pushing the NGO page.
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);

	const feed = useFeed(
		{
			tab,
			...(categoryIds.length ? { categoryIds } : {}),
			...feedContentQuery(content),
		},
		isOrg,
	);

	const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
	const orgName = me?.organization?.organizationName ?? null;
	const isVerified = me?.organization?.verificationStatus === "VERIFIED";
	const myUserId = me?.id;

	const openComposer = useCallback(
		(options?: ComposerRequest) => setComposer(options ?? {}),
		[],
	);

	/**
	 * Deleting is irreversible and takes the stored media with it, so it is
	 * confirmed — and named, because "Delete post" over a feed of twenty is
	 * not enough to know which one is about to go.
	 */
	const confirmDelete = useCallback(
		async (item: FeedItem) => {
			const preview = (item.title || item.description || "This post")
				.trim()
				.slice(0, 60);
			const ok = await confirm({
				title: "Delete this post?",
				message: `"${preview}" and any photos or video on it will be removed from every feed. This cannot be undone.`,
				confirmLabel: "Delete",
				cancelLabel: "Keep it",
			});
			if (!ok) return;
			deletePost.mutate(item.id, {
				onSuccess: () => toast.success("Post deleted."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			});
		},
		[deletePost],
	);

	/*
	 * Stable handlers, so `FeedCard`'s `memo` can actually hold.
	 *
	 * Written inline in `renderItem` these were a new function on every render,
	 * which fails the memo comparison for every card in the list — so a like,
	 * which now writes straight into the query cache, re-rendered every card
	 * and every video player in it. Each closes only over a mutation's `mutate`,
	 * which react-query keeps stable, so these dependencies never change.
	 */
	const handleToggleFollow = useCallback(
		(organizationId: string, following: boolean) =>
			toggleFollow.mutate({ organizationId, following }),
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

	if (!isOrg) return <Redirect href="/" />;

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	/*
	 * Desktop: one pinned row — the lenses and New post together, because they
	 * are the two things you reach for at any scroll depth and splitting them
	 * across a title row and a chip row spent 110pt of permanent chrome saying
	 * "Feed" next to a sidebar item that already says Feed. It sits above the
	 * scroller with a hairline, so cards pass under it.
	 *
	 * Mobile keeps the title (there is no sidebar to name the screen) and gets
	 * New post from the floating button instead, since a phone row cannot hold
	 * four lens chips and a button.
	 */
	const lensRow = (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
			}}
		>
			{/* FeedTabs is a row that bleeds past the gutter; it needs an explicit
			    flex parent or the chips push the button off the end. */}
			<View style={{ flex: 1, minWidth: 0 }}>
				<FeedTabs
					tab={tab}
					onTab={setTab}
					gutter={GUTTER}
					onOpenFilters={() => setFiltersOpen(true)}
					filterActive={categoryIds.length > 0 || content !== "all"}
				/>
			</View>
			{isDesktop && (
				<Button size="sm" onPress={() => openComposer()}>
					New post
				</Button>
			)}
		</View>
	);

	const pinnedHeader = (
		<View
			style={{
				paddingHorizontal: GUTTER,
				paddingBottom: spacing[3],
				borderBottomWidth: 1,
				borderBottomColor: colors.border.hairline,
			}}
		>
			{!isDesktop && <ScreenHeader title="Feed" />}
			{lensRow}
		</View>
	);

	/*
	 * The composer prompt scrolls with the cards rather than joining the pinned
	 * row: it is 64pt tall and belongs to the content, not the chrome.
	 *
	 * `GUTTER` is the one number that lines it up with the cards. `FeedCard`
	 * carries its own `marginHorizontal: spacing[3]`, so the list adds none —
	 * otherwise the cards sit 12pt further in than everything above them, which
	 * is exactly the misalignment this had.
	 */
	const listHeader = (
		<View
			style={{
				paddingHorizontal: GUTTER,
				paddingTop: spacing[4],
				paddingBottom: spacing[1],
			}}
		>
			<PostComposerBar
				name={orgName}
				onCompose={openComposer}
				{...(isVerified
					? {}
					: { disabledReason: "Get verified to post to the feed" })}
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
			icon={PenLine}
			title={
				tab === "following"
					? "You don't follow anyone yet"
					: categoryIds.length > 0 || content !== "all"
						? "Nothing matches those filters"
						: "The feed is quiet"
			}
			description={
				tab === "following"
					? "Follow NGOs working on causes near yours and their updates land here."
					: "Be the first thing in it — post what your team did this week."
			}
			action={
				isVerified && tab !== "following" ? (
					<Button onPress={() => openComposer()}>Write a post</Button>
				) : undefined
			}
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
					onToggleFollow={handleToggleFollow}
					onToggleLike={handleToggleLike}
					onToggleSave={handleToggleSave}
					// Only a post has a delete route, and only its own author may
					// call it — the server enforces both, and offering the control
					// on anything else would be a button that always fails.
					{...(item.kind === "post" && myUserId && item.author?.id === myUserId
						? { onDelete: confirmDelete }
						: {})}
				/>
			)}
			ListHeaderComponent={listHeader}
			ListFooterComponent={footer}
			onEndReached={loadMore}
			onEndReachedThreshold={0.6}
			onViewableItemsChanged={onViewableItemsChanged}
			viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
			{...verticalScrollbar}
			contentContainerStyle={{
				// No horizontal padding: `FeedCard` owns the gutter, and
				// `listHeader` matches it. See the note on `listHeader`.
				paddingBottom: spacing[16],
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
		<Screen style={{ paddingHorizontal: 0 }}>
			{isDesktop ? (
				/* Centred, not `flex-start`: the feed is capped, so the row has a
				   312pt remainder at the content cap and left-aligning it put the
				   whole hole on the right. See the note on Desktop columns. */
				<View
					style={{
						flex: 1,
						minHeight: 0,
						flexDirection: "row",
						justifyContent: "center",
						gap: COLUMN_GAP,
					}}
				>
					{/* The feed column: pinned row, then the only thing that
					    scrolls. `minHeight: 0` so the scroller can shrink below its
					    content height instead of being floored by it. */}
					<View
						style={{
							flex: 1,
							minWidth: 0,
							minHeight: 0,
							maxWidth: FEED_MAX_WIDTH,
						}}
					>
						{pinnedHeader}
						{list}
					</View>
					{/* Scrolls on its own: on a short window a plain View clips the
					    bottom with nothing to scroll — the same bug the profile page
					    had. */}
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
					{pinnedHeader}
					{list}
					{isVerified && (
						<ComposeButton
							// Clear of the tab bar, whose height is `TAB_BAR_HEIGHT`
							// plus the home-indicator inset. Read from the constant so
							// the two cannot drift apart.
							bottom={insets.bottom + TAB_BAR_HEIGHT + spacing[4]}
							onPress={() => openComposer()}
						/>
					)}
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
			<NeedPreviewDrawer
				item={responding}
				onClose={() => setResponding(null)}
				onToggleFollow={(organizationId, following) =>
					toggleFollow.mutate({ organizationId, following })
				}
			/>
			<PostComposer
				key={composer?.tag ?? "POST"}
				visible={!!composer}
				onClose={() => setComposer(null)}
				{...(composer?.tag ? { initialTag: composer.tag } : {})}
				{...(composer?.withMedia ? { openPickerOnMount: true } : {})}
				{...(composer?.drafts ? { openDraftsOnMount: true } : {})}
			/>
		</Screen>
	);
}

/**
 * Mobile compose button.
 *
 * Labelled, not a bare "+": the design system's rule is that no icon-only
 * control ships without its word, and "+" on a feed is ambiguous between
 * composing and following. Sits clear of the tab bar and the home indicator,
 * which is what `bottom` is for. `primary.main` is a fill and
 * `primary.contrast` the only label colour that passes AA on it.
 */
function ComposeButton({
	bottom,
	onPress,
}: {
	bottom: number;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel="Write a post"
			{...focusable}
			style={({ pressed }) => ({
				position: "absolute",
				// `Screen` runs edge to edge on this route, so this is measured
				// from the pane edge and has to supply its own inset.
				right: spacing[4],
				bottom,
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				minHeight: 48,
				paddingHorizontal: spacing[4],
				borderRadius: 999,
				backgroundColor: pressed
					? (colors.primary.dark as string)
					: (colors.primary.main as string),
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 4 },
				shadowOpacity: 0.18,
				shadowRadius: 12,
				elevation: 6,
				transform: [{ scale: pressed ? 0.97 : 1 }],
			})}
		>
			<PenLine
				size={17}
				color={colors.primary.contrast as string}
				strokeWidth={2.2}
			/>
			<Label weight="bold" color={colors.primary.contrast as string}>
				Post
			</Label>
		</Pressable>
	);
}
