import type { Paginated } from "@nabhya/shared";
import {
	type InfiniteData,
	keepPreviousData,
	type UseInfiniteQueryResult,
	useInfiniteQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
	FlatList,
	type FlatListProps,
	RefreshControl,
	View,
} from "react-native";
import { LoadMoreFooter } from "@/components/load-more-footer";
import {
	ErrorState,
	LoadingState,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * Real paging for every `Paginated<T>` endpoint.
 *
 * The data hooks in `hooks/use-*.ts` fetch one page with `useQuery`. Rather than
 * rewrite each of them, a screen hands this the same query key and the same
 * service call and gets back every page loaded so far, flattened, plus a
 * `loadMore` that asks for the next one while `meta.hasMore` holds - the same
 * shape `use-feed.ts` uses for the home feed.
 *
 * The key is suffixed with `"infinite"` so it never shares a cache entry with the
 * single-page hook for the same params (their data shapes differ), while still
 * living under the same prefix so `queryScopes.*` invalidations reach it.
 */
export const PAGE_SIZE = 20;

export function usePagedQuery<P extends Paginated<unknown>>({
	queryKey,
	fetchPage,
	enabled = true,
	keepPrevious = false,
}: {
	queryKey: readonly unknown[];
	fetchPage: (page: number) => Promise<P>;
	enabled?: boolean;
	/**
	 * Hold the previous key's rows up while a new filter or sort loads
	 * (`query.isPlaceholderData` is true meanwhile). For a table whose controls
	 * re-key the query - without it every header press blanks the page to a
	 * spinner and back. Off by default: a list that changes *what* it is (a
	 * different NGO's posts) must not show the last one's rows.
	 */
	keepPrevious?: boolean;
}) {
	const query = useInfiniteQuery({
		queryKey: [...queryKey, "infinite"],
		queryFn: ({ pageParam }) => fetchPage(pageParam),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
		enabled,
		...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
	});

	const items = useMemo(
		() => (query.data?.pages.flatMap((page) => page.items) ?? []) as P["items"],
		[query.data],
	);

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

	/** The first page, for envelopes that carry extras (`unreadCount`, `summary`). */
	const first = query.data?.pages[0];

	return { query, items, first, loadMore };
}

/**
 * The query half of `usePagedQuery`'s result, as the list components accept it.
 * Typed over `Paginated<unknown>` so one `PagedList` can take either of two
 * differently-shaped queries (the NGO directory's "all" and "nearby").
 */
export type PagedQuery = UseInfiniteQueryResult<
	InfiniteData<Paginated<unknown>, unknown>
>;

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The list body for a paged screen: loading, error-with-retry and empty states,
 * pull to refresh, and a spinner footer while the next page arrives. Fetches
 * the next page when the reader nears the end.
 *
 * `grouped` draws the rows inside one `Surface` divided by hairlines - the
 * `ListGroup` look for a list too long to render eagerly. The card hugs its
 * content when short and scrolls inside itself when tall.
 *
 * The scroll indicator comes from `verticalScrollbar`, never hard-coded off:
 * react-native-web compiles `showsVerticalScrollIndicator={false}` to
 * `scrollbar-width: none`, which Chrome honours, and every list in the app was
 * therefore a pane with no thumb and no clue there was more below the fold.
 * See `lib/scroll.ts`.
 */
export function PagedList<T>({
	query,
	items,
	loadMore,
	renderItem,
	keyExtractor,
	empty,
	loadingLabel,
	grouped,
	header,
	numColumns,
	noun,
	extraBottomPadding = 0,
	loadingShape = "skeleton",
}: {
	query: PagedQuery;
	items: T[];
	loadMore: () => void;
	renderItem: (item: T) => React.ReactElement;
	keyExtractor: (item: T) => string;
	/** Rendered when the first page is empty - an `EmptyState`. */
	empty: React.ReactElement;
	loadingLabel?: string;
	grouped?: boolean;
	header?: React.ReactElement;
	/** A grid on wide screens. Ignored when `grouped`. */
	numColumns?: number;
	/** Plural noun for the footer's closing line, e.g. "organizations". */
	noun?: string;
	extraBottomPadding?: number;
	/**
	 * What the first load draws. `skeleton` (the default) holds the rows'
	 * height - hairline rows when `grouped`, cards otherwise, in the same grid -
	 * so the page does not jump when the first page lands. `spinner` is the old
	 * centred `LoadingState`, for a list whose rows look nothing like a card.
	 */
	loadingShape?: "skeleton" | "spinner";
}) {
	const { colors, spacing } = useTheme();

	if (query.isLoading) {
		return (
			<>
				{header}
				{loadingShape === "spinner" ? (
					<LoadingState label={loadingLabel} />
				) : (
					<SkeletonList
						variant={grouped ? "row" : "card"}
						columns={grouped ? 1 : (numColumns ?? 1)}
						count={grouped ? 6 : Math.max(3, (numColumns ?? 1) * 2)}
						label={loadingLabel ?? "Loading"}
					/>
				)}
			</>
		);
	}

	if (query.isError && items.length === 0) {
		return (
			<>
				{header}
				<ErrorState
					message={apiErrorMessage(
						query.error,
						"Check your connection and try again.",
					)}
					onRetry={() => query.refetch()}
				/>
			</>
		);
	}

	if (items.length === 0) {
		return (
			<>
				{header}
				{empty}
			</>
		);
	}

	// A failed *next* page is its own case - the rows already on screen are
	// fine, so it is a line at the end rather than an ErrorState over the list.
	// Everything else is `LoadMoreFooter`, which is also what the non-paged
	// lists use: one spinner, one explicit "Load more" (`onEndReached` is
	// unreliable on web and never fires on a first page shorter than the
	// viewport), one closing line.
	const footer = query.isError ? (
		<View style={{ paddingVertical: spacing[4], alignItems: "center" }}>
			<Caption color="tertiary">Couldn't load more.</Caption>
			<Button
				size="sm"
				variant="ghost"
				onPress={loadMore}
				style={{ marginTop: spacing[1] }}
			>
				Try again
			</Button>
		</View>
	) : (
		<LoadMoreFooter
			hasMore={!!query.hasNextPage}
			loading={query.isFetchingNextPage}
			onLoadMore={loadMore}
			count={items.length}
			{...(noun ? { noun } : {})}
		/>
	);

	const columns = grouped ? 1 : (numColumns ?? 1);

	const listProps: FlatListProps<T> = {
		data: items,
		keyExtractor,
		renderItem: ({ item }) =>
			columns > 1 ? (
				<View style={{ flex: 1 / columns, padding: spacing[1.5] }}>
					{renderItem(item)}
				</View>
			) : (
				renderItem(item)
			),
		numColumns: columns,
		...verticalScrollbar,
		onEndReached: loadMore,
		onEndReachedThreshold: 0.6,
		ListFooterComponent: footer,
		refreshControl: (
			<RefreshControl
				refreshing={query.isRefetching && !query.isFetchingNextPage}
				onRefresh={() => void query.refetch()}
				tintColor={colors.text.quaternary as string}
			/>
		),
	} as FlatListProps<T>;

	if (grouped) {
		return (
			<View style={{ flex: 1 }}>
				{header}
				<Surface padded={false} style={{ flexShrink: 1, overflow: "hidden" }}>
					<FlatList
						{...listProps}
						style={{ flexGrow: 0 }}
						ItemSeparatorComponent={() => (
							<View
								style={{
									height: 1,
									marginLeft: spacing[4],
									backgroundColor: colors.border.hairline,
								}}
							/>
						)}
					/>
				</Surface>
				<View style={{ height: spacing[10] + extraBottomPadding }} />
			</View>
		);
	}

	return (
		<FlatList
			// Changing column count needs a remount in React Native's FlatList.
			key={`cols-${columns}`}
			{...listProps}
			ListHeaderComponent={header}
			ItemSeparatorComponent={
				columns > 1 ? undefined : () => <View style={{ height: spacing[3] }} />
			}
			columnWrapperStyle={
				columns > 1 ? { marginHorizontal: -spacing[1.5] } : undefined
			}
			contentContainerStyle={{
				paddingBottom: spacing[10] + extraBottomPadding,
			}}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* Load more                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * For a paged list that lives inside a ScrollView (the tabs on an NGO page),
 * where a nested FlatList cannot own the scroll. Renders nothing once the last
 * page is in.
 */
export function LoadMoreButton({
	query,
	loadMore,
}: {
	query: PagedQuery;
	loadMore: () => void;
}) {
	const { spacing } = useTheme();

	if (!query.hasNextPage && !query.isFetchingNextPage) return null;

	return (
		<Button
			variant="outline"
			size="sm"
			onPress={loadMore}
			loading={query.isFetchingNextPage}
			style={{ alignSelf: "center", marginTop: spacing[4] }}
		>
			Load more
		</Button>
	);
}
