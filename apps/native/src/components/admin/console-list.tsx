import { useState } from "react";
import { View } from "react-native";
import type { TableColumn, TableSort } from "@/components/admin/data-table";
import { DataTable } from "@/components/admin/data-table";
import { ResultCount } from "@/components/admin/list-chrome";
import type { TableView } from "@/components/admin/toolbar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import type { PagedQuery } from "@/components/paged-list";
import { ErrorState, LoadingState } from "@/components/screen-shell";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";

/**
 * The body of a console list: the count, the rows, and the way to the next page.
 *
 * **Nothing here owns a scroller.** The page does - see the note at the top of
 * `list-chrome.tsx`. That is why this renders its rows inline instead of using
 * `PagedList`, which the rest of the app uses and which wraps a `FlatList`: a
 * `FlatList` inside the page scroller is the nested-scroll bug the console just
 * got rid of, and it is what stops `DataTable`'s header from sticking.
 *
 * The cost is virtualisation, and it is worth paying here and nowhere else. A
 * console page is 20 rows of type - no images, no video, no players - and a
 * reviewer working a queue loads maybe five pages. The volunteer feed, which
 * has all three of those things and no end, keeps `PagedList`.
 *
 * ## Three shapes, one component
 *
 * - **Desktop + `table`** - `DataTable`. Comparing records down a column.
 * - **Desktop + `grid`** - the cards, two or three across via `useGridColumns`.
 *   Recognising one record by name and state.
 * - **Mobile** - always the cards, one across, whatever `view` says. A 360dp
 *   window cannot hold six columns, and a table squeezed into it is six
 *   two-line wraps per row.
 *
 * ## Changing a filter keeps the rows up
 *
 * The admin list hooks pass `keepPrevious`, so a sort or filter change leaves
 * the last result on screen (`query.isPlaceholderData`) while the next one
 * loads. Here those rows are dimmed and inert rather than replaced by
 * `LoadingState`: a spinner in place of the table on every header press
 * collapsed the page's height, threw the reader back to the top, and made a
 * 200ms round trip look like a reload. `LoadingState` is now only for the very
 * first load, when there is nothing to keep.
 */
export function ConsoleList<T, K extends string>({
	query,
	items,
	total,
	loadMore,
	noun,
	plural,
	view,
	columns,
	rowKey,
	onRowPress,
	sort,
	onSortChange,
	selection,
	onSelectionChange,
	renderCard,
	empty,
	loadingLabel,
	rowLabel,
	activeKey,
}: {
	query: PagedQuery;
	items: T[];
	total: number;
	loadMore: () => void;
	/** Singular noun for the count, e.g. "organization". */
	noun: string;
	/** Plural, when it is not just `noun + "s"` ("entry" → "entries"). */
	plural?: string;
	/** `table` is honoured on desktop only; mobile is always cards. */
	view: TableView;
	columns: Array<TableColumn<T>>;
	rowKey: (row: T) => string;
	onRowPress?: (row: T) => void;
	sort?: TableSort<K>;
	onSortChange?: (next: TableSort<K>) => void;
	selection?: Set<string>;
	onSelectionChange?: (next: Set<string>) => void;
	/** The card, for the grid and for mobile. */
	renderCard: (row: T) => React.ReactElement;
	empty: React.ReactElement;
	loadingLabel?: string;
	/** Passed to `DataTable` - the spoken name of an openable row. */
	rowLabel?: (row: T) => string;
	/** Passed to `DataTable` - the keyboard cursor's row. */
	activeKey?: string;
}) {
	const { spacing } = useTheme();
	const { isDesktop, width } = useMedia();
	const stale = query.isPlaceholderData;

	if (query.isLoading) {
		return <LoadingState {...(loadingLabel ? { label: loadingLabel } : {})} />;
	}

	if (query.isError && items.length === 0) {
		return (
			<ErrorState
				message={apiErrorMessage(
					query.error,
					"Check your connection and try again.",
				)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	if (items.length === 0) {
		return <View style={stale ? { opacity: 0.5 } : null}>{empty}</View>;
	}

	const asTable = isDesktop && view === "table";

	return (
		<View
			// Dimmed and inert while the previous filter's rows stand in: they are
			// not what was asked for, so they must not be pressed or ticked.
			pointerEvents={stale ? "none" : "auto"}
			accessibilityState={{ busy: stale }}
			style={stale ? { opacity: 0.5 } : null}
		>
			<ResultCount
				total={total}
				loaded={items.length}
				noun={noun}
				{...(plural ? { plural } : {})}
			/>

			{asTable ? (
				<DataTable
					columns={columns}
					rows={items}
					rowKey={rowKey}
					{...(onRowPress ? { onRowPress } : {})}
					{...(sort ? { sort } : {})}
					{...(onSortChange ? { onSortChange } : {})}
					{...(selection ? { selection } : {})}
					{...(onSelectionChange ? { onSelectionChange } : {})}
					{...(rowLabel ? { rowLabel } : {})}
					{...(activeKey ? { activeKey } : {})}
					// Below ~1240 the last columns are dropped rather than squeezed;
					// past that the sideways scroll takes over.
					wide={width >= 1240}
				/>
			) : (
				<Cards
					items={items}
					rowKey={rowKey}
					renderCard={renderCard}
					desktop={isDesktop}
					gap={spacing[3]}
				/>
			)}

			<LoadMoreFooter
				hasMore={!!query.hasNextPage}
				loading={query.isFetchingNextPage}
				onLoadMore={loadMore}
				count={items.length}
				noun={plural ?? `${noun}s`}
			/>
		</View>
	);
}

/**
 * A wrapping row of cards.
 *
 * Flex wrap rather than a `FlatList` grid, for the same no-nested-scroller
 * reason as above - and it behaves better at the end of a short list: a
 * `numColumns` grid stretches a lone last card across the full row, while
 * `flexBasis` keeps it one column wide.
 *
 * **Columns come from the measured container, not from `useGridColumns()`.**
 * That hook caps at three, which was right while console pages were capped at
 * 1180; now that they are full width, three cards on a 2560 monitor are 760pt
 * each - a card wide enough that its own two lines of text sit in the left
 * third. Here the *card* width is what is held steady (~`TARGET` each) and the
 * count follows the window, so a wide screen gets more cards rather than
 * bigger ones. The table wants the opposite - one column absorbing the
 * slack - which is why this is not a shared rule.
 */
const TARGET_CARD_WIDTH = 380;
const MAX_COLUMNS = 6;

function Cards<T>({
	items,
	rowKey,
	renderCard,
	desktop,
	gap,
}: {
	items: T[];
	rowKey: (row: T) => string;
	renderCard: (row: T) => React.ReactElement;
	desktop: boolean;
	gap: number;
}) {
	const [width, setWidth] = useState(0);

	const columns = !desktop
		? 1
		: Math.min(
				MAX_COLUMNS,
				Math.max(1, Math.floor((width + gap) / (TARGET_CARD_WIDTH + gap))),
			);

	// One column until the container has been measured, so the first paint is a
	// readable single column rather than a flash of six 40pt slivers.
	if (columns === 1) {
		return (
			<View
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
				style={{ gap }}
			>
				{items.map((item) => (
					<View key={rowKey(item)}>{renderCard(item)}</View>
				))}
			</View>
		);
	}

	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ flexDirection: "row", flexWrap: "wrap", gap }}
		>
			{items.map((item) => (
				<View
					key={rowKey(item)}
					style={{
						// The gap is taken out of the basis so `columns` cards plus
						// `columns - 1` gaps come to 100% and never wrap one short.
						// `calc()` is a CSS value react-native-web passes through, and
						// this branch only runs on desktop web - RN's own types stop at
						// numbers and percentages, hence the cast.
						flexBasis: `calc(${100 / columns}% - ${
							(gap * (columns - 1)) / columns
						}px)` as unknown as number,
						flexGrow: 0,
						flexShrink: 0,
						minWidth: 0,
					}}
				>
					{renderCard(item)}
				</View>
			))}
		</View>
	);
}
