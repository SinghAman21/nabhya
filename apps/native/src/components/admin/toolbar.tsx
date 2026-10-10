import { LayoutGrid, Rows3, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";
import { storage } from "@/lib/storage";

/**
 * One row of controls above a console list: search, then the filters, then the
 * view switch pushed to the far end.
 *
 * This replaced two stacked rows of filter chips. Chips were fine as a
 * *lens* - three or four peers you flick between - and wrong as a filter bar:
 * eleven of them wrapped across two lines, the selected one was the only thing
 * telling you which of two independent axes you were even looking at, and the
 * whole assembly pushed the first row of data 200pt down the page. A closed
 * `SelectMenu` states its axis and its value in one line and gives the space
 * back.
 *
 * The children are the filters, so each screen decides what its axes are; the
 * search field and the view switch are the same everywhere and live here.
 */
export function Toolbar({
	search,
	onSearchChange,
	searchPlaceholder,
	searchPending,
	autoCapitalize,
	view,
	onViewChange,
	children,
}: {
	/** Omit the pair to drop the search field - the queue has nothing to search. */
	search?: string;
	onSearchChange?: (next: string) => void;
	searchPlaceholder?: string;
	searchPending?: boolean;
	autoCapitalize?: "none" | "characters";
	/** Omit the pair on a list with only one sensible shape (the audit ledger). */
	view?: TableView;
	onViewChange?: (next: TableView) => void;
	children?: React.ReactNode;
}) {
	const { spacing } = useTheme();

	// No margin of its own. `AdminScreen` pins this row and owns its padding, so
	// a `marginBottom` here pushed the controls low inside the bar and left them
	// visibly off-centre against the collapsed title beside them.
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[2],
			}}
		>
			{search !== undefined && onSearchChange && (
				// A floor rather than a fixed width: the row wraps on a narrow
				// window and the field should take the whole line when it does,
				// but it must never be the thing that shrinks to fit a filter.
				<View style={{ flexGrow: 1, flexShrink: 1, minWidth: 240 }}>
					<SearchField
						value={search}
						onChange={onSearchChange}
						placeholder={searchPlaceholder ?? "Search"}
						{...(searchPending !== undefined ? { pending: searchPending } : {})}
						{...(autoCapitalize ? { autoCapitalize } : {})}
						compact
					/>
				</View>
			)}
			{children}
			{view && onViewChange && (
				<>
					<View style={{ flexGrow: 1 }} />
					<ViewSwitch value={view} onChange={onViewChange} />
				</>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* View switch                                                                */
/* -------------------------------------------------------------------------- */

export type TableView = "table" | "grid";

/**
 * Table or cards, remembered per screen.
 *
 * Both shapes are legitimate and they answer different questions: the table is
 * for comparing records down a column, the grid for recognising one by its
 * name and its state. A reviewer clearing a verification queue wants the table;
 * someone browsing the NGOs on the platform wants the cards. Neither is the
 * "advanced" view, so neither is hidden behind a menu, and the choice is
 * remembered rather than re-asked on every visit.
 *
 * Two icons in a segmented control, and this is one of the few places the
 * app's "never icon-only" rule is genuinely satisfied by convention instead of
 * a word: a rows/grid pair is understood the way a play button is, and both
 * carry real `accessibilityLabel`s. On mobile the control is not rendered at
 * all - a 360dp column has room for one shape, and it is the card.
 */
function ViewSwitch({
	value,
	onChange,
}: {
	value: TableView;
	onChange: (next: TableView) => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	const option = (view: TableView, Icon: typeof Rows3, label: string) => {
		const active = value === view;
		return (
			<Pressable
				key={view}
				onPress={() => onChange(view)}
				accessibilityRole="tab"
				accessibilityState={{ selected: active }}
				accessibilityLabel={label}
				{...focusable}
				style={(state) => {
					const { hovered, pressed } = state as PressState;
					return {
						width: 32,
						height: 28,
						alignItems: "center",
						justifyContent: "center",
						borderRadius: borderRadius.sm,
						backgroundColor: active
							? colors.background.card
							: hovered || pressed
								? colors.background.tertiary
								: "transparent",
					};
				}}
			>
				<Icon
					size={15}
					color={
						active
							? (colors.text.primary as string)
							: (colors.text.quaternary as string)
					}
					strokeWidth={2}
				/>
			</Pressable>
		);
	};

	return (
		<View
			accessibilityRole="tablist"
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[0.5],
				padding: spacing[0.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			{option("table", Rows3, "Table view")}
			{option("grid", LayoutGrid, "Card view")}
		</View>
	);
}

/**
 * Remembers a screen's view choice.
 *
 * Starts on `table` before storage answers rather than flashing cards and
 * swapping: `storage.get` is async on both platforms (SecureStore natively,
 * and the adapter keeps one shape), so there is always a first paint with no
 * answer. The table is the right thing to guess - it is the default for a new
 * reviewer, so guessing it means only the minority who chose cards ever see a
 * change, and they see it on the first frame.
 */
export function useTableView(screen: string) {
	const key = `admin.view.${screen}`;
	const [view, setView] = useState<TableView>("table");

	useEffect(() => {
		let cancelled = false;
		void storage.get(key).then((stored) => {
			if (!cancelled && (stored === "table" || stored === "grid")) {
				setView(stored);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [key]);

	const change = useCallback(
		(next: TableView) => {
			setView(next);
			void storage.set(key, next);
		},
		[key],
	);

	return [view, change] as const;
}

/* -------------------------------------------------------------------------- */
/* Bulk actions                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The bar that appears once rows are ticked.
 *
 * In the pinned command bar, under the filters - not floating over the bottom
 * of the window, and not in the flow of the page. A floating bar covers the
 * last row of the thing you are selecting from, and on a console the selection
 * is often the whole visible page; in the page flow it scrolled away with the
 * title, so a reviewer who ticked rows forty lines down had to scroll back up
 * to act on them. The caller passes it as part of `AdminScreen`'s `toolbar`,
 * which pins, and the table's sticky header follows the bar's measured height
 * down as it grows. It says the count first, because "approve" is a very
 * different decision at 3 than at 47.
 *
 * `Clear` is a real control and sits at the end. Untangling a selection by
 * clicking twenty ticks off again is the single most annoying thing a table
 * can do to someone.
 */
export function BulkBar({
	count,
	children,
	onClear,
}: {
	count: number;
	/** The actions. Buttons, in the order they are usually wanted. */
	children: React.ReactNode;
	onClear: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	if (count === 0) return null;

	return (
		<View
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[2],
				paddingVertical: spacing[2],
				paddingHorizontal: spacing[3],
				// No margin: it sits in the pinned bar, which owns the spacing -
				// the same reason `Toolbar` carries none.
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			<Label weight="semibold">{count} selected</Label>
			<View style={{ width: spacing[2] }} />
			{children}
			<View style={{ flexGrow: 1 }} />
			<Pressable
				onPress={onClear}
				accessibilityRole="button"
				accessibilityLabel="Clear selection"
				hitSlop={8}
				{...focusable}
				style={(state) => {
					const { hovered, pressed } = state as PressState;
					return {
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1],
						height: 28,
						paddingHorizontal: spacing[2],
						borderRadius: borderRadius.sm,
						backgroundColor:
							hovered || pressed ? colors.background.tertiary : "transparent",
					};
				}}
			>
				<X size={13} color={colors.text.tertiary as string} strokeWidth={2} />
				<Caption color="tertiary" weight="medium">
					Clear
				</Caption>
			</Pressable>
		</View>
	);
}

/** A bulk action. Small, so a row of three does not outweigh the table. */
export function BulkAction({
	label,
	onPress,
	loading,
	destructive,
}: {
	label: string;
	onPress: () => void;
	loading?: boolean;
	destructive?: boolean;
}) {
	return (
		<Button
			size="sm"
			variant={destructive ? "outline" : "default"}
			onPress={onPress}
			{...(loading ? { loading } : {})}
		>
			{label}
		</Button>
	);
}
