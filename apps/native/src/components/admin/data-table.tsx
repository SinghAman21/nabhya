import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronRight,
	Minus,
} from "lucide-react-native";
import { Platform, View, type ViewStyle } from "react-native";
import { useStickyOffset } from "@/components/admin/list-chrome";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";

/**
 * The console's table.
 *
 * The admin screens were a column of full-width cards: an NGO's name, two
 * pills and a footnote inside an 1100pt rounded rectangle, forty of them down
 * the page. A card is the right shape when a row is a *thing you look at* - a
 * feed post, an event with a photo. It is the wrong shape when a row is a
 * *record you compare*, which is the entire job here: is this NGO older than
 * that one, which has documents waiting, who has never been reviewed. Cards
 * cannot answer any of those, because the value you want is at a different x
 * for every row. A table puts it in a column.
 *
 * ## The rules this file keeps
 *
 * - **The header row sticks; the page scrolls.** Not the other way round. The
 *   screens used to give the list its own scroll container inside a fixed
 *   header, which on the web put a second scrollbar in the middle of the
 *   window and left the browser's own one dead. `position: sticky` on the
 *   header needs the table to be *inside* the page scroller, which is why
 *   `AdminScreen` owns the `ScrollView` and this renders inline.
 * - **No virtualisation, deliberately.** A page is 20 rows and a reviewer
 *   loads a few; a `FlatList` here would reintroduce the nested scroller the
 *   sticky header exists to remove. Mobile keeps the card list, which *is*
 *   virtualised - see each screen's `compact` branch.
 * - **The table is one `Surface`, and the rows are inside it.** It used to be
 *   naked rows on the page background, separated from the toolbar by a margin -
 *   which read as loose text with rules through it rather than as a table, and
 *   ran the first column hard against the page gutter. Now: `background.card`,
 *   `borderRadius.xl`, the light-mode shadow, and a real 16pt inset so the
 *   identity column and the trailing column both have air. Same recipe as
 *   `Surface`, minus its padding, which the rows own instead.
 * - **`overflow: hidden` is forbidden on that card.** It would create a scroll
 *   container and silently kill the sticky header. The rounded top corners come
 *   from `borderTopLeftRadius`/`Right` on the header row itself; the bottom two
 *   from the card, which nothing paints into because the last row drops its
 *   hairline.
 * - **Columns are hairlines and type, never fills.** No zebra striping, no
 *   tinted header. Striping is a crutch for rows too tall to track; 64pt rows
 *   with a hairline between them track fine, and a stripe would fight the
 *   `StatusPill`s that carry the only colour in the table.
 * - **The table fills its parent, and never owns a scroller of its own.** One
 *   column flexes and the rest are fixed, so the width the window offers goes
 *   to the identity column. It used to sit inside a `ScrollView horizontal`, to
 *   push sideways when the columns needed more room than the window had, and
 *   that wrapper caused both of the bugs it was meant to prevent:
 *
 *   1. **The table stopped being full width.** A horizontal scroller sizes its
 *      content to the content, so the flexing column collapsed to its
 *      `minWidth` and the table ended at the sum of the minimums with empty
 *      page beside it.
 *   2. **The sticky header pinned in the middle of the rows.** `position:
 *      sticky` resolves against the *nearest* scrolling ancestor. That was the
 *      horizontal `ScrollView`, not the page, so `top: <toolbar height>` was
 *      measured from the top of the table's own box and the header floated
 *      across the rows.
 *
 *   Narrow windows are handled by dropping columns (`wideOnly`, below 1240) and
 *   below the mobile breakpoint by not rendering a table at all - `ConsoleList`
 *   switches to cards. There is no width at which sideways scrolling was the
 *   right answer.
 * - **Sorting is a server round trip.** A sortable header sets the query, it
 *   does not re-order `items` - the list is paged, so sorting in the browser
 *   sorts twenty of three hundred rows. `sortKey` is what makes a header
 *   pressable; a column without one is not sortable and shows no affordance.
 *   A sortable header that is *not* the current sort shows a faint two-way
 *   arrow: with nothing at rest, "Joined" and "Standing" looked identical and
 *   the only way to learn which headers sorted was to hover each one.
 * - **An openable row says so before it is hovered.** A trailing chevron on
 *   every row that opens a record, and a spoken label (`rowLabel`) - a row
 *   announced as "button" with six cells of text read out is not a name.
 */

export interface TableColumn<T> {
	/** Stable identity for the column. Not necessarily a field on the row. */
	key: string;
	header: string;
	render: (row: T) => React.ReactNode;
	/** Fixed width. Omit on exactly one column to let it take the slack. */
	width?: number;
	/** Floor for the flexible column, and what feeds `totalMinWidth`. */
	minWidth?: number;
	align?: "start" | "end";
	/** Present ⇒ the header sorts by this key. Absent ⇒ not sortable. */
	sortKey?: string;
	/** Hide below a wide window. For a column that is nice-to-have, not needed. */
	wideOnly?: boolean;
}

export interface TableSort<K extends string> {
	sort: K;
	dir: "asc" | "desc";
}

/**
 * Row height.
 *
 * 64, not the 52 this started at. A console row carries two lines in its
 * identity column (name over email) plus a `StatusPill`, and 52 left the pill
 * touching the hairlines above and below it - technically fitting, visually
 * cramped, and tiring over forty rows. 64 gives the two-line cell real leading
 * and the pill its own air, and still shows ~11 rows on a laptop.
 */
const ROW_HEIGHT = 64;
const HEADER_HEIGHT = 44;

/**
 * The card's inner gutter - the padding the rows and the header share.
 *
 * 16, matching `Surface`'s own. Without it the first column started at the
 * card's edge and the trailing column ended at it, which is what made the table
 * read as text with rules through it rather than as a table.
 */
const CELL_INSET = 16;

/** The tick column. Inside `CELL_INSET`, so the box lines up with the labels. */
const TICK_WIDTH = 28;

/** The resting "this row opens" chevron at the end of an openable row. */
const CUE_WIDTH = 14;

/** The DOM id of a row, so a keyboard cursor can scroll it into view. */
export function tableRowId(key: string) {
	return `table-row-${key}`;
}

/**
 * The column labels stay put while the rows scroll past.
 *
 * `position: sticky` is a CSS value react-native-web passes straight through;
 * React Native's own `position` type stops at "absolute" | "relative", hence
 * the cast - the same idiom as the desktop rails and the console aside. It
 * needs an opaque background, or the rows show through it as they pass under.
 *
 * **`top` is not 0.** The page's own command bar pins there
 * (`AdminScreen`), so a header at 0 pins *underneath* it and the column labels
 * disappear. The offset comes from `useStickyOffset()`, which the bar publishes
 * after measuring itself - a hard-coded number would drift the moment the
 * toolbar wraps to two lines on a narrow window.
 */
const STICKY_HEADER = {
	flexDirection: "row",
	alignItems: "center",
	height: HEADER_HEIGHT,
	position: "sticky",
	zIndex: 10,
	borderBottomWidth: 1,
} as unknown as ViewStyle;

export function DataTable<T, K extends string>({
	columns,
	rows,
	rowKey,
	onRowPress,
	sort,
	onSortChange,
	selection,
	onSelectionChange,
	wide = true,
	rowHref,
	rowLabel,
	activeKey,
}: {
	columns: Array<TableColumn<T>>;
	rows: T[];
	rowKey: (row: T) => string;
	onRowPress?: (row: T) => void;
	sort?: TableSort<K>;
	/**
	 * Pressing a sortable header. Pressing the *current* key flips direction;
	 * pressing a new one starts it descending, because every sortable column
	 * here is either a timestamp or a count and the interesting end of both is
	 * the big one.
	 */
	onSortChange?: (next: TableSort<K>) => void;
	/** Selected row keys. Pass with `onSelectionChange` to get the tick column. */
	selection?: Set<string>;
	onSelectionChange?: (next: Set<string>) => void;
	/** False drops `wideOnly` columns. */
	wide?: boolean;
	/** Announced as a link rather than a button when a row navigates. */
	rowHref?: boolean;
	/** What an openable row is called to a screen reader ("Open Asha Trust"). */
	rowLabel?: (row: T) => string;
	/**
	 * The keyboard cursor's row (the queue's J/K), drawn with a 2pt rule down
	 * its leading edge. A rule rather than the selection tint: the cursor and the
	 * selection are independent, and a ticked row under the cursor must show both.
	 */
	activeKey?: string;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const stickyOffset = useStickyOffset();

	const visible = columns.filter((column) => wide || !column.wideOnly);
	const selectable = !!selection && !!onSelectionChange;

	const totalMinWidth =
		visible.reduce(
			(total, column) => total + (column.width ?? column.minWidth ?? 120),
			0,
		) +
		visible.length * spacing[3] +
		CELL_INSET * 2 +
		(selectable ? TICK_WIDTH + spacing[3] : 0) +
		(onRowPress ? CUE_WIDTH + spacing[3] : 0);

	const pageKeys = rows.map(rowKey);
	const allSelected =
		pageKeys.length > 0 && pageKeys.every((key) => selection?.has(key));
	const someSelected = pageKeys.some((key) => selection?.has(key));

	const toggleAll = () => {
		if (!selection || !onSelectionChange) return;
		const next = new Set(selection);
		if (allSelected) {
			for (const key of pageKeys) next.delete(key);
		} else {
			for (const key of pageKeys) next.add(key);
		}
		onSelectionChange(next);
	};

	const toggleRow = (key: string) => {
		if (!selection || !onSelectionChange) return;
		const next = new Set(selection);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		onSelectionChange(next);
	};

	const cellStyle = (column: TableColumn<T>) => ({
		...(column.width
			? { width: column.width, flexGrow: 0, flexShrink: 0 }
			: { flex: 1, minWidth: column.minWidth ?? 120 }),
		alignItems: (column.align === "end" ? "flex-end" : "flex-start") as
			| "flex-end"
			| "flex-start",
		justifyContent: "center" as const,
	});

	return (
		// `width: "100%"` so the flexing column gets the window's slack, and
		// `minWidth` as the floor that keeps the fixed columns from being crushed
		// - on a window narrower than the floor the page's own horizontal
		// overflow is the fallback, which is the browser's job, not a nested
		// scroller's. No `overflow: hidden`: it would make this a scroll
		// container and kill the sticky header.
		<View
			style={{
				width: "100%",
				minWidth: totalMinWidth,
				backgroundColor: colors.background.card,
				borderRadius: borderRadius.xl,
				...(isDark ? {} : elevation.card),
			}}
		>
			{/* Header. `sticky` works because the scroll container is the page
			    (`AdminScreen`), not this component. */}
			<View
				style={[
					STICKY_HEADER,
					{
						top: stickyOffset,
						gap: spacing[3],
						paddingHorizontal: CELL_INSET,
						// The card's own colour, so rows pass *under* it rather than
						// through it, and its corners so it reads as the top of the card
						// rather than a bar laid over it.
						backgroundColor: colors.background.card,
						borderTopLeftRadius: borderRadius.xl,
						borderTopRightRadius: borderRadius.xl,
						borderBottomColor: colors.border.hairline,
					},
				]}
			>
				{selectable && (
					<View style={{ width: TICK_WIDTH }}>
						<Tick
							checked={allSelected}
							partial={!allSelected && someSelected}
							onPress={toggleAll}
							label={
								allSelected
									? "Clear this page's selection"
									: "Select every row on this page"
							}
						/>
					</View>
				)}
				{visible.map((column) => {
					const sortable = !!column.sortKey && !!onSortChange;
					const isSorted = sort?.sort === column.sortKey;

					if (!sortable) {
						return (
							<View key={column.key} style={cellStyle(column)}>
								<Caption color="quaternary" weight="medium" numberOfLines={1}>
									{column.header}
								</Caption>
							</View>
						);
					}

					return (
						<View key={column.key} style={cellStyle(column)}>
							<Pressable
								onPress={() =>
									onSortChange({
										sort: column.sortKey as K,
										dir:
											isSorted && sort?.dir === "desc"
												? "asc"
												: isSorted
													? "desc"
													: "desc",
									})
								}
								accessibilityRole="button"
								accessibilityLabel={`Sort by ${column.header}${
									isSorted
										? sort?.dir === "asc"
											? ", currently ascending"
											: ", currently descending"
										: ""
								}`}
								{...focusable}
								style={(state) => {
									const { hovered, pressed } = state as PressState;
									return {
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[1],
										height: HEADER_HEIGHT - 8,
										paddingHorizontal: spacing[1],
										marginHorizontal: -spacing[1],
										borderRadius: 6,
										backgroundColor:
											hovered || pressed
												? colors.background.subtle
												: "transparent",
									};
								}}
							>
								<Caption
									color={isSorted ? "secondary" : "quaternary"}
									weight="medium"
									numberOfLines={1}
								>
									{column.header}
								</Caption>
								{/* The sorted column gets a solid arrow; every other
								    sortable one a faint two-way arrow, so "can I sort by
								    this?" is answered at rest, not only on hover. */}
								{!isSorted && (
									<ArrowUpDown
										size={11}
										color={colors.text.quaternary as string}
										strokeWidth={2}
									/>
								)}
								{isSorted &&
									(sort?.dir === "asc" ? (
										<ArrowUp
											size={12}
											color={colors.text.secondary as string}
											strokeWidth={2.5}
										/>
									) : (
										<ArrowDown
											size={12}
											color={colors.text.secondary as string}
											strokeWidth={2.5}
										/>
									))}
							</Pressable>
						</View>
					);
				})}
				{onRowPress && <View style={{ width: CUE_WIDTH }} />}
			</View>

			{rows.map((row, index) => {
				const key = rowKey(row);
				const selected = selection?.has(key) ?? false;
				const active = activeKey === key;
				const last = index === rows.length - 1;

				const cells = (
					<>
						{selectable && (
							<View style={{ width: TICK_WIDTH }}>
								<Tick
									checked={selected}
									onPress={() => toggleRow(key)}
									label="Select this row"
								/>
							</View>
						)}
						{visible.map((column) => (
							<View key={column.key} style={cellStyle(column)}>
								{column.render(row)}
							</View>
						))}
						{onRowPress && (
							<View
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								style={{ width: CUE_WIDTH, alignItems: "flex-end" }}
							>
								<ChevronRight
									size={14}
									color={colors.text.quaternary as string}
									strokeWidth={2}
								/>
							</View>
						)}
					</>
				);

				const base = {
					flexDirection: "row" as const,
					alignItems: "center" as const,
					gap: spacing[3],
					minHeight: ROW_HEIGHT,
					// Less the cursor rule's 2pt, so the cells stay on the header's x.
					paddingLeft: CELL_INSET - 2,
					paddingRight: CELL_INSET,
					paddingVertical: spacing[2.5],
					// The last row drops its rule so nothing paints across the card's
					// rounded bottom corners.
					borderBottomWidth: last ? 0 : 1,
					borderBottomColor: colors.border.hairline,
					// The cursor rule is a left border on every row, transparent
					// unless active, so moving the cursor never shifts a cell.
					borderLeftWidth: 2,
					borderLeftColor: active ? colors.primary.ink : "transparent",
				};
				// RNW renders `nativeID` as the DOM id; native has nothing to scroll
				// to by id and ignores it.
				const domId =
					Platform.OS === "web" ? { nativeID: tableRowId(key) } : {};

				if (!onRowPress) {
					return (
						<View
							key={key}
							{...domId}
							style={[
								base,
								selected ? { backgroundColor: colors.primary.tint } : null,
							]}
						>
							{cells}
						</View>
					);
				}

				return (
					// The whole row is the pressable, including the tick gutter, so the
					// hover tint covers the row edge to edge - highlighting only the
					// inner area left a 16pt dead strip down each side. The tick is a
					// nested `Pressable` and wins its own presses, so ticking a row
					// still does not open it.
					<Pressable
						key={key}
						{...domId}
						onPress={() => onRowPress(row)}
						accessibilityRole={rowHref ? "link" : "button"}
						{...(rowLabel ? { accessibilityLabel: rowLabel(row) } : {})}
						{...focusable}
						style={(state) => {
							const { hovered, pressed } = state as PressState;
							return {
								...base,
								backgroundColor: selected
									? colors.primary.tint
									: hovered || pressed
										? colors.background.subtle
										: "transparent",
							};
						}}
					>
						{cells}
					</Pressable>
				);
			})}
		</View>
	);
}

/**
 * The row tick.
 *
 * Hand-drawn rather than `ui/checkbox.tsx` because it needs a third state:
 * "some of this page is selected", which is what the header shows once the
 * reviewer has ticked four of twenty. A two-state box has to lie about that,
 * and the lie matters - an unchecked header next to four ticked rows reads as
 * "nothing selected".
 *
 * Also the NGO applicant sheet's tick. Without `onPress` it is only the box,
 * for a control whose whole row is already the pressable (a labelled
 * "Attended" checkbox) - two nested checkboxes would be two tab stops and
 * two announcements for one state.
 */
export function Tick({
	checked,
	partial,
	onPress,
	label,
}: {
	checked: boolean;
	partial?: boolean;
	onPress?: () => void;
	label: string;
}) {
	const { colors } = useTheme();
	const on = checked || partial;
	const mark = partial ? (
		<Minus
			size={12}
			color={colors.primary.contrast as string}
			strokeWidth={3}
		/>
	) : checked ? (
		<CheckMark color={colors.primary.contrast as string} />
	) : null;

	if (!onPress) {
		return (
			<View
				style={{
					width: 17,
					height: 17,
					borderRadius: 5,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: on ? 0 : 1.5,
					borderColor: colors.border.medium,
					backgroundColor: on ? colors.primary.main : "transparent",
				}}
			>
				{mark}
			</View>
		);
	}

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: partial ? "mixed" : checked }}
			accessibilityLabel={label}
			hitSlop={10}
			{...focusable}
			style={(state) => {
				const { hovered, pressed } = state as PressState;
				return {
					width: 17,
					height: 17,
					borderRadius: 5,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: on ? 0 : 1.5,
					borderColor:
						hovered || pressed ? colors.border.dark : colors.border.medium,
					backgroundColor: on ? colors.primary.main : "transparent",
					opacity: pressed ? 0.8 : 1,
				};
			}}
		>
			{mark}
		</Pressable>
	);
}

/** Drawn, not imported: a 10px lucide `Check` loses its join at this size. */
function CheckMark({ color }: { color: string }) {
	return (
		<View
			style={{
				width: 9,
				height: 5,
				borderLeftWidth: 2,
				borderBottomWidth: 2,
				borderColor: color,
				transform: [{ rotate: "-45deg" }],
				marginTop: -2,
			}}
		/>
	);
}
