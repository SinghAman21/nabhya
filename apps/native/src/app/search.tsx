import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import {
	Bookmark,
	Building2,
	CalendarDays,
	Clock,
	HeartHandshake,
	Megaphone,
	Search,
	X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, type ViewToken } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	ListGroup,
	ListRow,
	LoadingState,
	Screen,
	SectionTitle,
} from "@/components/screen-shell";
import { SearchField } from "@/components/search-field";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeedReaction, useRecordFeedInteraction } from "@/hooks/use-feed";
import { useSearch } from "@/hooks/use-search";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { useRecentSearches } from "@/lib/recent-searches";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedItem, FeedKind, FeedNeedItem } from "@/lib/types";

/**
 * Search, as its own page.
 *
 * There is more to find than one list can hold - an NGO by name, a specific
 * item, an event in another city - so the field gets a screen with a keyboard
 * up from the first frame. Before a term is typed the page teaches what it can
 * find: a few example searches and the two browse destinations. Once a term is
 * in, result tabs split by what the person is looking for: everything, NGOs,
 * needs, events or updates. Search is the one place the city scope is dropped
 * on purpose - someone typing a name wants that name, wherever it is.
 *
 * Recent terms sit above the examples once there are any, because on a phone
 * the commonest search is one already made: the same NGO, the same item, a day
 * later. They are device-local (`lib/recent-searches.ts`) and a term is only
 * recorded when it is committed - the Search key, or opening a result - so the
 * list holds words rather than the prefixes typed on the way to them.
 */

type Scope = "all" | "ngos" | FeedKind;

const SCOPES: { value: Scope; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "ngos", label: "NGOs" },
	{ value: "need", label: "Needs" },
	{ value: "event", label: "Events" },
	{ value: "story", label: "Updates" },
	{ value: "post", label: "Posts" },
];

/** Concrete, not abstract: a person should be able to tap one and see results. */
const EXAMPLES = [
	"Blankets",
	"Books",
	"Food drive",
	"Medical camp",
	"Tree planting",
	"Teaching",
	"Old age home",
	"Laptops",
];

function SearchScreen() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [scope, setScope] = useState<Scope>("all");
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);
	const recent = useRecentSearches();

	const term = useDebounced(query.trim());
	const active = term.length > 0;
	const result = useSearch(term, scope, active);
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

	const orgItems = active ? (result.data?.organizations.items ?? []) : [];
	const feedItems = active ? (result.data?.feed.items ?? []) : [];
	const loading = active && result.isLoading;
	const error = active && result.isError ? result.error : null;
	const nothing =
		active &&
		!loading &&
		!error &&
		orgItems.length === 0 &&
		feedItems.length === 0;

	/** Opening a result is as much a commit as pressing Search. */
	const openOrg = (organizationId: string) => {
		recent.record(query);
		router.push(`/ngos/${organizationId}`);
	};

	/* ---- Before typing: teach what search can do ------------------------- */
	const guide = (
		<View style={{ paddingTop: spacing[5] }}>
			{recent.terms.length > 0 && (
				<View style={{ marginBottom: spacing[6] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<SectionTitle>Recent</SectionTitle>
						<Pressable
							onPress={recent.clear}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Clear recent searches"
							{...focusable}
							style={{ minHeight: 32, justifyContent: "center" }}
						>
							<Caption weight="medium" color={colors.primary.ink}>
								Clear
							</Caption>
						</Pressable>
					</View>
					<ListGroup>
						{recent.terms.map((term) => (
							<ListRow
								key={term}
								icon={Clock}
								label={term}
								onPress={() => setQuery(term)}
								value={
									<Pressable
										onPress={() => recent.remove(term)}
										accessibilityRole="button"
										accessibilityLabel={`Remove ${term} from recent searches`}
										{...focusable}
										// A 44pt target, pulled into the row's own padding by
										// the negative margin so the row does not grow to fit
										// it. At 32 it relied on hitSlop, which the focus ring
										// and the pressed state never showed.
										style={{
											width: 44,
											height: 44,
											marginVertical: -spacing[1.5],
											alignItems: "center",
											justifyContent: "center",
											borderRadius: 999,
										}}
									>
										<X
											size={14}
											color={colors.text.quaternary as string}
											strokeWidth={2}
										/>
									</Pressable>
								}
							/>
						))}
					</ListGroup>
				</View>
			)}

			<SectionTitle>Try searching for</SectionTitle>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: spacing[2],
					marginBottom: spacing[6],
				}}
			>
				{EXAMPLES.map((example) => (
					<Pressable
						key={example}
						onPress={() => setQuery(example)}
						accessibilityRole="button"
						accessibilityLabel={`Search ${example}`}
						{...focusable}
						style={({ pressed }) => ({
							minHeight: 36,
							justifyContent: "center",
							paddingHorizontal: spacing[3.5],
							borderRadius: 999,
							backgroundColor: pressed
								? colors.background.tertiary
								: colors.background.subtle,
						})}
					>
						<Caption weight="medium" color="secondary">
							{example}
						</Caption>
					</Pressable>
				))}
			</View>

			<SectionTitle>Or browse</SectionTitle>
			<ListGroup>
				<ListRow
					icon={Building2}
					label="All verified NGOs"
					hint="Every organisation on Nabhya, by city"
					onPress={() => router.push("/ngos")}
				/>
				<ListRow
					icon={Bookmark}
					label="NGOs you follow"
					hint="Saved organisations"
					onPress={() => router.push("/bookmarks")}
				/>
				<ListRow
					icon={CalendarDays}
					label="Upcoming events"
					hint="Everything you can sign up for"
					onPress={() => router.push("/events")}
				/>
			</ListGroup>

			<View style={{ marginTop: spacing[6], gap: spacing[1] }}>
				<Caption color="quaternary">
					Search looks at post titles, descriptions and NGO names across all of
					India.
				</Caption>
			</View>
		</View>
	);

	/* ---- Results ----------------------------------------------------------- */
	const resultsHeader = (
		<View style={{ paddingTop: spacing[3] }}>
			<FilterChips options={SCOPES} value={scope} onChange={setScope} />
			{orgItems.length > 0 && (scope === "all" || scope === "ngos") && (
				<View style={{ marginBottom: spacing[5] }}>
					<SectionTitle>NGOs</SectionTitle>
					<ListGroup>
						{orgItems.map((org) => (
							<ListRow
								key={org.id}
								icon={Building2}
								label={org.organizationName}
								hint={
									[org.city, org.state].filter(Boolean).join(", ") ||
									"Verified NGO"
								}
								onPress={() => openOrg(org.id)}
							/>
						))}
					</ListGroup>
				</View>
			)}
			{feedItems.length > 0 && scope === "all" && (
				<SectionTitle>Posts across India</SectionTitle>
			)}
		</View>
	);

	const footer = !active ? null : loading ? (
		<LoadingState label="Searching…" />
	) : error ? (
		<ErrorState
			message={apiErrorMessage(error)}
			onRetry={() => result.refetch()}
		/>
	) : nothing ? (
		<EmptyState
			icon={scopeIcon(scope)}
			title={`No ${scopeNoun(scope)} for “${term}”`}
			description={
				scope === "all"
					? "Check the spelling, or try a broader word like “blankets” or “teaching”."
					: "Try the All tab - it may be listed as something else."
			}
		/>
	) : active && feedItems.length > 0 ? (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<Caption color="quaternary">That&apos;s everything</Caption>
		</View>
	) : null;

	/*
	 * Stable handlers, so `FeedCard`'s `memo` can actually hold.
	 *
	 * Written inline in `renderItem` these were a new function on every render,
	 * which fails the memo comparison for every card in the list - so a like,
	 * which now writes straight into the query cache, re-rendered every card
	 * and every video player in it. Each closes only over a mutation's `mutate`,
	 * which react-query keeps stable, so these dependencies never change.
	 */
	// Follow vanishes from the card on press, so the toast is the only sign it
	// worked and the only way back short of the NGO page. The name comes from a
	// ref so this handler stays stable for the memoised card.
	const feedItemsRef = useRef<FeedItem[]>([]);
	useEffect(() => {
		feedItemsRef.current = feedItems;
	});
	const handleToggleFollow = useCallback(
		(organizationId: string, following: boolean) =>
			toggleFollow.mutate(
				{ organizationId, following },
				{
					onSuccess: () => {
						if (following) return;
						const name = feedItemsRef.current.find(
							(row) => row.organization?.id === organizationId,
						)?.organization?.organizationName;
						toast.success(name ? `Following ${name}` : "Following", {
							label: "Undo",
							onPress: () =>
								toggleFollow.mutate({ organizationId, following: true }),
						});
					},
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			),
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

	return (
		<Screen style={{ paddingHorizontal: 0 }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					paddingHorizontal: spacing[5],
					paddingBottom: spacing[3],
					borderBottomWidth: 1,
					borderBottomColor: colors.border.hairline,
				}}
			>
				{/* The full 40pt control, as on every pushed page. It was narrowed to
				    24 to buy the search field width, which left a target smaller
				    than the glyph's own row. Centred because BackButton top-aligns
				    itself for `ScreenHeader`, and the field beside it is 44. */}
				<BackButton style={{ alignSelf: "center" }} />
				<View style={{ flex: 1 }}>
					<SearchField
						value={query}
						onChange={setQuery}
						onSubmit={recent.record}
						pending={query.trim() !== term}
						placeholder="Search items, events, causes or NGOs"
						autoFocus
					/>
				</View>
			</View>

			<FlashList
				data={feedItems}
				keyExtractor={(item: FeedItem) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={setResponding}
						onToggleFollow={handleToggleFollow}
						onToggleLike={handleToggleLike}
						onToggleSave={handleToggleSave}
					/>
				)}
				ListHeaderComponent={active ? resultsHeader : guide}
				ListFooterComponent={footer}
				ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
				{...verticalScrollbar}
				contentContainerStyle={{
					paddingHorizontal: spacing[5],
					paddingBottom: spacing[12],
				}}
			/>

			<PledgeSheet
				need={responding ? toPublicNeed(responding) : null}
				onClose={() => setResponding(null)}
			/>
		</Screen>
	);
}

function scopeIcon(scope: Scope) {
	switch (scope) {
		case "ngos":
			return Building2;
		case "need":
			return HeartHandshake;
		case "event":
			return CalendarDays;
		case "story":
			return Megaphone;
		default:
			return Search;
	}
}

function scopeNoun(scope: Scope) {
	switch (scope) {
		case "ngos":
			return "NGOs";
		case "need":
			return "needs";
		case "event":
			return "events";
		case "story":
			return "updates";
		default:
			return "results";
	}
}

export default withAppShell(SearchScreen);
