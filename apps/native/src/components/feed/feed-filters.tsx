import {
	FEED_TAB_LABELS,
	type FeedTab,
	feedTabSchema,
	type NeedType,
} from "@nabhya/shared";
import { SlidersHorizontal } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { MultiChoiceChips } from "@/components/choice-chips";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label, Micro } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable, type PressState } from "@/lib/focus";
import type { Category, FeedKind } from "@/lib/types";

export const ALL_CAUSES = "";

/**
 * What the feed is showing, as one choice.
 *
 * The server takes `kind` (POST / NEED / EVENT / ANNOUNCEMENT) and `needType`
 * (WANT / OFFER) as separate filters, but they are not independent from the
 * reader's side: "Offers" already means needs, and picking both a kind and a
 * need type is either redundant or empty. So the sheet offers one list and
 * `feedContentQuery` turns the choice back into the pair the hook wants.
 *
 * Events and updates used to be unreachable here - the section held only All,
 * Needs and Offers, so "show me events I can turn up to", the second most
 * common thing a volunteer wants, had no control at all.
 */
export type FeedContent = "all" | "want" | "offer" | "event" | "update";

export function feedContentQuery(content: FeedContent): {
	kind?: FeedKind;
	needType?: NeedType;
} {
	switch (content) {
		case "want":
			return { needType: "WANT" };
		case "offer":
			return { needType: "OFFER" };
		case "event":
			return { kind: "event" };
		case "update":
			// An NGO's own writing, whichever row type carries it: an
			// announcement is a story, a plain post is a post. The server takes
			// one kind, and announcements are the ones written to be read, so
			// that is the one this maps to.
			return { kind: "story" };
		default:
			return {};
	}
}

const CONTENT_OPTIONS: Array<{ value: FeedContent; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "want", label: "Needs" },
	{ value: "offer", label: "Offers" },
	{ value: "event", label: "Events" },
	{ value: "update", label: "Updates" },
];

const TABS = feedTabSchema.options.map((value) => ({
	value,
	label: FEED_TAB_LABELS[value],
}));

/** How many filters the sheet has set: each cause, plus a content choice. */
export function feedFilterCount(
	categoryIds: string[],
	content: FeedContent,
): number {
	return categoryIds.length + (content === "all" ? 0 : 1);
}

/**
 * The one row that shapes the feed: the lens (For you, Following, Trending,
 * Urgent) and the filter button at the far end that opens the sheet. One
 * row, not two - the cause is chosen rarely and the lens often, so the rare
 * control folds into a sheet and the row stays a single line.
 *
 * The chips bleed to the screen edge on a phone - negative margin out of the
 * page gutter, the gutter put back as scroll padding - so the first chip
 * lines up with the cards and the last slides under the filter button
 * instead of stopping short of it.
 *
 * The button carries the **count** of filters on, not a dot: a dot says
 * "something is set" and leaves the reader to open the sheet to find out
 * how much. On desktop it is labelled ("Filters 2"); on a phone it is the
 * glyph and the count.
 */
export function FeedTabs({
	tab,
	onTab,
	gutter,
	onOpenFilters,
	filterActive,
	filterCount,
}: {
	tab: FeedTab;
	onTab: (tab: FeedTab) => void;
	/** The page's horizontal padding, so the row can bleed past it. */
	gutter: number;
	onOpenFilters: () => void;
	/** Older callers: true when anything is set. `filterCount` wins. */
	filterActive?: boolean;
	/** Filters on in the sheet - see `feedFilterCount`. */
	filterCount?: number;
}) {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const count = filterCount ?? (filterActive ? 1 : 0);
	const active = count > 0;

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
					gap: spacing[1.5],
					alignItems: "center",
					paddingLeft: gutter,
					paddingRight: spacing[3],
				}}
			>
				{TABS.map((option) => {
					const selected = option.value === tab;
					return (
						<Pressable
							key={option.value}
							onPress={() => onTab(option.value)}
							hitSlop={4}
							accessibilityRole="tab"
							accessibilityState={{ selected }}
							accessibilityLabel={option.label}
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as PressState;
								return {
									height: 36,
									justifyContent: "center",
									paddingHorizontal: spacing[3.5],
									borderRadius: 999,
									backgroundColor: selected
										? (colors.text.primary as string)
										: pressed || hovered
											? (colors.background.subtle as string)
											: "transparent",
								};
							}}
						>
							<Caption
								weight="semibold"
								color={selected ? (colors.text.inverse as string) : "secondary"}
							>
								{option.label}
							</Caption>
						</Pressable>
					);
				})}
			</ScrollView>

			<View
				style={{
					paddingLeft: spacing[2],
					paddingRight: gutter,
				}}
			>
				<Pressable
					onPress={onOpenFilters}
					hitSlop={4}
					accessibilityRole="button"
					accessibilityLabel={active ? `Filters, ${count} on` : "Filters"}
					{...focusable}
					style={(state) => {
						const { pressed, hovered } = state as PressState;
						return {
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
							height: 36,
							minWidth: 36,
							justifyContent: "center",
							paddingHorizontal: isDesktop || active ? spacing[3] : 0,
							borderRadius: 999,
							borderWidth: 1,
							borderColor: active
								? (colors.text.primary as string)
								: colors.border.medium,
							backgroundColor:
								pressed || hovered
									? (colors.background.subtle as string)
									: "transparent",
						};
					}}
				>
					<SlidersHorizontal
						size={15}
						strokeWidth={2}
						color={colors.text.primary as string}
					/>
					{isDesktop && (
						<Caption weight="semibold" color="primary">
							Filters
						</Caption>
					)}
					{active && <CountBadge count={count} />}
				</Pressable>
			</View>
		</View>
	);
}

/** Ink on the page: the count, not a decorative dot. */
function CountBadge({ count }: { count: number }) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				minWidth: 18,
				height: 18,
				paddingHorizontal: spacing[1],
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: colors.text.primary as string,
			}}
		>
			<Micro weight="bold" color={colors.text.inverse as string}>
				{count}
			</Micro>
		</View>
	);
}

/**
 * What to see, and which causes. Changes are staged until Apply - on a
 * phone the sheet covers the feed, so filtering live would mean tapping
 * through a list nobody can see.
 *
 * This was two tile grids: five 96pt tiles for the content type (four
 * across, so "Updates" wrapped alone and stretched the full width) and the
 * same tile per cause, whose 88pt minimum broke "Environment" and
 * "Healthcare" mid-word. The content type is now a single-line segmented
 * control - five short peers, exactly one chosen - and causes are wrapping
 * chips that size to their names, so no label can break.
 */
export function FeedFilterSheet({
	visible,
	onClose,
	categories,
	categoryIds,
	onCategories,
	content,
	onContent,
}: {
	visible: boolean;
	onClose: () => void;
	categories: Category[];
	categoryIds: string[];
	onCategories: (ids: string[]) => void;
	content: FeedContent;
	onContent: (value: FeedContent) => void;
}) {
	const { spacing } = useTheme();
	const [draftCategoryIds, setDraftCategoryIds] = useState(categoryIds);
	const [draftContent, setDraftContent] = useState(content);

	useEffect(() => {
		if (visible) {
			setDraftCategoryIds(categoryIds);
			setDraftContent(content);
		}
	}, [visible, categoryIds, content]);

	const toggleCategory = (id: string) => {
		setDraftCategoryIds((current) =>
			current.includes(id)
				? current.filter((value) => value !== id)
				: [...current, id],
		);
	};
	const apply = () => {
		onCategories(draftCategoryIds);
		onContent(draftContent);
		onClose();
	};
	const reset = () => {
		setDraftCategoryIds([]);
		setDraftContent("all");
	};

	const activeCount = feedFilterCount(draftCategoryIds, draftContent);

	return (
		<Sheet
			visible={visible}
			onClose={onClose}
			title="Filters"
			footer={
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<Button
						variant="ghost"
						onPress={reset}
						disabled={activeCount === 0}
						accessibilityLabel="Reset filters"
					>
						Reset
					</Button>
					<Button onPress={apply} style={{ flex: 1 }}>
						{activeCount > 0 ? `Apply (${activeCount})` : "Apply"}
					</Button>
				</View>
			}
		>
			<View style={{ paddingBottom: spacing[3], gap: spacing[6] }}>
				<FilterSection title="Show">
					<Segmented
						label="Show"
						options={CONTENT_OPTIONS}
						value={draftContent}
						onChange={setDraftContent}
					/>
				</FilterSection>

				<FilterSection
					title="Causes"
					hint={
						draftCategoryIds.length === 0
							? "Any cause"
							: `${draftCategoryIds.length} selected`
					}
				>
					{categories.length === 0 ? (
						<Caption color="quaternary">No causes to filter by yet.</Caption>
					) : (
						<MultiChoiceChips
							label="Causes"
							options={categories.map((category) => ({
								value: category.id,
								label: category.name,
							}))}
							values={draftCategoryIds}
							onToggle={toggleCategory}
						/>
					)}
				</FilterSection>
			</View>
		</Sheet>
	);
}

function FilterSection({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ gap: spacing[3] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "baseline",
					justifyContent: "space-between",
				}}
			>
				<Label weight="semibold" accessibilityRole="header">
					{title}
				</Label>
				{hint && <Caption color="quaternary">{hint}</Caption>}
			</View>
			{children}
		</View>
	);
}

/**
 * A single-line segmented control: equal segments on an inset track, the
 * chosen one lifted onto the card surface. Radio semantics.
 */
function Segmented<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: ReadonlyArray<{ value: T; label: string }>;
	value: T;
	onChange: (value: T) => void;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();

	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={{
				flexDirection: "row",
				padding: 3,
				gap: 2,
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						accessibilityRole="radio"
						accessibilityLabel={option.label}
						accessibilityState={{ checked: selected }}
						{...focusable}
						style={(state) => {
							const { hovered } = state as PressState;
							return {
								flex: 1,
								minWidth: 0,
								height: 36,
								alignItems: "center",
								justifyContent: "center",
								paddingHorizontal: spacing[1],
								borderRadius: borderRadius.md - 2,
								backgroundColor: selected
									? isDark
										? colors.background.overlay
										: colors.background.card
									: hovered
										? colors.background.tertiary
										: "transparent",
								...(selected && !isDark ? elevation.card : {}),
							};
						}}
					>
						<Caption
							weight="semibold"
							numberOfLines={1}
							color={selected ? "primary" : "tertiary"}
						>
							{option.label}
						</Caption>
					</Pressable>
				);
			})}
		</View>
	);
}
