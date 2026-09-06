import {
	FEED_TAB_LABELS,
	type FeedTab,
	feedTabSchema,
	type NeedType,
} from "@nabhya/shared";
import {
	BookOpen,
	Boxes,
	BriefcaseBusiness,
	Building2,
	HeartHandshake,
	Layers3,
	Leaf,
	Megaphone,
	PackageOpen,
	SlidersHorizontal,
	Sparkles,
	Stethoscope,
	TreePine,
	UsersRound,
	Utensils,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
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
 * The cause picker. Changes are staged until Apply, and causes are multi-select
 * so a volunteer can follow more than one vertical at once.
 */
export function FeedFilterSheet({
	visible,
	onClose,
	categories,
	categoryIds,
	onCategories,
	needType,
	onNeedType,
}: {
	visible: boolean;
	onClose: () => void;
	categories: Category[];
	categoryIds: string[];
	onCategories: (ids: string[]) => void;
	needType?: NeedType;
	onNeedType: (value: NeedType | undefined) => void;
}) {
	const { colors, spacing } = useTheme();
	const [draftCategoryIds, setDraftCategoryIds] = useState(categoryIds);
	const [draftNeedType, setDraftNeedType] = useState(needType);

	useEffect(() => {
		if (visible) {
			setDraftCategoryIds(categoryIds);
			setDraftNeedType(needType);
		}
	}, [visible, categoryIds, needType]);

	const toggleCategory = (id: string) => {
		setDraftCategoryIds((current) =>
			current.includes(id)
				? current.filter((value) => value !== id)
				: [...current, id],
		);
	};
	const pickNeedType = (value: NeedType | undefined) => {
		setDraftNeedType(value);
	};
	const apply = () => {
		onCategories(draftCategoryIds);
		onNeedType(draftNeedType);
		onClose();
	};
	const reset = () => {
		setDraftCategoryIds([]);
		setDraftNeedType(undefined);
	};

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Shape your feed"
			subtitle="Choose what you want to see first."
			footer={
				<View style={{ flexDirection: "row", gap: spacing[2] }}>
					<Button
						variant="outline"
						// size="sm"
						onPress={reset}
						style={{
							flex: 1,
							backgroundColor: colors.background.subtle,
						}}
					>
						Reset
					</Button>
					<Button onPress={apply} style={{ flex: 1 }}>
						{draftCategoryIds.length > 0
							? `Apply filters (${draftCategoryIds.length})`
							: "Apply filters"}
					</Button>
				</View>
			}
		>
			<View style={{ paddingBottom: spacing[2], gap: spacing[5] }}>
				<FilterSection title="What you want to see">
					<FilterCard
						label="All"
						icon={Layers3}
						selected={!draftNeedType}
						onPress={() => pickNeedType(undefined)}
					/>
					<FilterCard
						label="Needs"
						icon={HeartHandshake}
						selected={draftNeedType === "WANT"}
						onPress={() =>
							pickNeedType(draftNeedType === "WANT" ? undefined : "WANT")
						}
					/>
					<FilterCard
						label="Offers"
						icon={PackageOpen}
						selected={draftNeedType === "OFFER"}
						onPress={() =>
							pickNeedType(draftNeedType === "OFFER" ? undefined : "OFFER")
						}
					/>
				</FilterSection>

				<FilterSection title="Cause">
					<FilterCard
						label="All causes"
						icon={Sparkles}
						selected={draftCategoryIds.length === 0}
						onPress={() => setDraftCategoryIds([])}
					/>
					{categories.map((category, index) => (
						<FilterCard
							key={category.id}
							label={category.name}
							icon={categoryIcon(category.name, index)}
							selected={draftCategoryIds.includes(category.id)}
							onPress={() => toggleCategory(category.id)}
						/>
					))}
				</FilterSection>
			</View>
		</Sheet>
	);
}

function FilterSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ gap: spacing[2] }}>
			<Caption color="tertiary">{title}</Caption>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: spacing[2],
				}}
			>
				{children}
			</View>
		</View>
	);
}

function FilterCard({
	label,
	icon: Icon,
	selected,
	onPress,
}: {
	label: string;
	icon: typeof Layers3;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			{...focusable}
			style={({ pressed }) => ({
				flexGrow: 1,
				flexBasis: 0,
				minWidth: 88,
				minHeight: 96,
				alignItems: "flex-start",
				justifyContent: "space-between",
				padding: spacing[3],
				borderRadius: borderRadius.md,
				backgroundColor: selected
					? colors.primary.tint
					: pressed
						? colors.background.tertiary
						: colors.background.subtle,
			})}
		>
			<Icon
				size={20}
				color={(selected ? colors.primary.ink : colors.text.tertiary) as string}
				strokeWidth={1.9}
			/>
			<Label
				weight={"medium"}
				numberOfLines={2}
				color={selected ? (colors.primary.ink as string) : "secondary"}
				style={{ maxWidth: "100%", flexShrink: 1, textAlign: "left" }}
			>
				{label}
			</Label>
		</Pressable>
	);
}

function categoryIcon(name: string, index: number) {
	const normalized = name.toLowerCase();
	if (normalized.includes("education") || normalized.includes("teach"))
		return BookOpen;
	if (normalized.includes("health") || normalized.includes("medical"))
		return Stethoscope;
	if (normalized.includes("food") || normalized.includes("hunger"))
		return Utensils;
	if (normalized.includes("environment") || normalized.includes("climate"))
		return Leaf;
	if (normalized.includes("tree") || normalized.includes("nature"))
		return TreePine;
	if (normalized.includes("women") || normalized.includes("child"))
		return UsersRound;
	if (normalized.includes("shelter") || normalized.includes("housing"))
		return Building2;
	if (normalized.includes("livelihood") || normalized.includes("employment"))
		return BriefcaseBusiness;
	if (normalized.includes("community") || normalized.includes("social"))
		return Megaphone;
	return [Boxes, HeartHandshake, Sparkles][index % 3] ?? Boxes;
}
