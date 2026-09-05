import { FEED_TAB_LABELS, type FeedTab, feedTabSchema } from "@nabhya/shared";
import { SlidersHorizontal } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { focusable } from "@/lib/focus";
import type { Category } from "@/lib/types";

export const ALL_CAUSES = "";

const TABS = feedTabSchema.options.map((value) => ({
	value,
	label: FEED_TAB_LABELS[value],
}));

/**
 * The one row that shapes the feed: the lens (For you, Following, Trending,
 * Urgent) scrolling sideways, and a filter button pinned at the right edge
 * that opens the cause picker. One row, not two — the cause is chosen rarely
 * and the lens often, so the rare control folds into a sheet and the row
 * stays a single line of chips.
 *
 * The chips bleed to the screen edge — negative margin out of the page
 * gutter, the gutter put back as scroll padding — so the first chip lines up
 * with the cards and the last slides under the filter button instead of
 * stopping short of it.
 */
export function FeedTabs({
	tab,
	onTab,
	gutter,
	onOpenFilters,
	filterActive,
}: {
	tab: FeedTab;
	onTab: (tab: FeedTab) => void;
	/** The page's horizontal padding, so the row can bleed past it. */
	gutter: number;
	onOpenFilters: () => void;
	/** True when a cause is selected: the button shows a dot. */
	filterActive: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				marginHorizontal: -gutter,
			}}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="tablist"
				accessibilityLabel="Feed"
				style={{ flex: 1 }}
				contentContainerStyle={{
					gap: spacing[2],
					alignItems: "center",
					paddingLeft: gutter,
					paddingRight: spacing[3],
				}}
			>
				{TABS.map((option) => {
					const active = option.value === tab;
					return (
						<Pressable
							key={option.value}
							onPress={() => onTab(option.value)}
							hitSlop={6}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
							accessibilityLabel={option.label}
							{...focusable}
							style={({ pressed }) => ({
								height: 36,
								justifyContent: "center",
								paddingHorizontal: spacing[3.5],
								borderRadius: 999,
								backgroundColor: active
									? (colors.text.primary as string)
									: pressed
										? (colors.background.subtle as string)
										: "transparent",
								borderWidth: active ? 0 : 1,
								borderColor: colors.border.medium,
							})}
						>
							<Caption
								weight="semibold"
								color={active ? (colors.text.inverse as string) : "secondary"}
							>
								{option.label}
							</Caption>
						</Pressable>
					);
				})}
			</ScrollView>

			{/* Pinned, with a soft fade so chips visibly slide under it. */}
			<View
				style={{
					paddingLeft: spacing[2],
					paddingRight: gutter,
					backgroundColor: colors.background.warm,
				}}
			>
				<Pressable
					onPress={onOpenFilters}
					hitSlop={6}
					accessibilityRole="button"
					accessibilityLabel={
						filterActive ? "Filters, one cause selected" : "Filters"
					}
					{...focusable}
					style={({ pressed }) => ({
						width: 36,
						height: 36,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						borderWidth: 1,
						borderColor: filterActive
							? (colors.text.primary as string)
							: colors.border.medium,
						backgroundColor: pressed
							? (colors.background.subtle as string)
							: "transparent",
					})}
				>
					<SlidersHorizontal
						size={16}
						strokeWidth={2}
						color={colors.text.primary as string}
					/>
					{filterActive && (
						<View
							style={{
								position: "absolute",
								top: 6,
								right: 6,
								width: 7,
								height: 7,
								borderRadius: 999,
								backgroundColor: colors.primary.main,
								borderWidth: 1.5,
								borderColor: colors.background.warm,
							}}
						/>
					)}
				</Pressable>
			</View>
		</View>
	);
}

/**
 * The cause picker. One choice, applied on tap; "All causes" is always the
 * first row so there is no separate clear button to find.
 */
export function FeedFilterSheet({
	visible,
	onClose,
	categories,
	categoryId,
	onCategory,
}: {
	visible: boolean;
	onClose: () => void;
	categories: Category[];
	categoryId: string;
	onCategory: (id: string) => void;
}) {
	const { spacing } = useTheme();

	const pick = (id: string) => {
		onCategory(id);
		onClose();
	};

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Filter by cause"
			subtitle="Show only posts from NGOs working on one thing."
		>
			<View style={{ paddingBottom: spacing[2] }}>
				<SheetOption
					label="All causes"
					selected={categoryId === ALL_CAUSES}
					onPress={() => pick(ALL_CAUSES)}
				/>
				{categories.map((category) => (
					<SheetOption
						key={category.id}
						label={category.name}
						selected={categoryId === category.id}
						onPress={() => pick(category.id)}
					/>
				))}
			</View>
		</Sheet>
	);
}
