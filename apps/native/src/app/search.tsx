import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	Building2,
	CalendarDays,
	HeartHandshake,
	MessageSquareText,
	Search,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, type ViewToken } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	Screen,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import { SearchField } from "@/components/search-field";
import {
	feedEntry,
	groupFeed,
	isSearchTab,
	orgEntry,
	SEARCH_SUGGESTIONS,
	SEARCH_TABS,
	type SearchEntry,
	SearchEntryRow,
	type SearchSection,
	SearchSectionHeading,
	type SearchTab,
	TAB_NOUN,
	useStartSections,
} from "@/components/search-panel";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useToggleFollow } from "@/hooks/use-engagement";
import { useFeedReaction, useRecordFeedInteraction } from "@/hooks/use-feed";
import { useSearch } from "@/hooks/use-search";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { focusable, type PressState } from "@/lib/focus";
import { useRecentSearches } from "@/lib/recent-searches";
import { verticalScrollbar } from "@/lib/scroll";
import type { FeedItem, FeedNeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * Search, as its own page.
 *
 * There is more to find than one list can hold - an NGO by name, a specific
 * item, an event in another city - so the field gets a screen with the
 * keyboard up from the first frame. Search is the one place the city scope is
 * dropped on purpose: someone typing a name wants that name, wherever it is.
 *
 * **Before typing** it offers what search is for, in the order it is used:
 * recent searches (device-local, `lib/recent-searches.ts`), suggestions that
 * each name the tab they belong to, and the two browse destinations. The same
 * sections drop from the desktop search field (`SearchFloat`), so the two
 * never teach different things.
 *
 * **Once a term is in**, results are rows, not feed cards: a search result is
 * something you scan for and open, and a column of full cards showed two
 * results per screen. All groups the top three of each kind with "See all";
 * a kind tab lists them all. Updates are the exception - they have no page of
 * their own to open, so that tab reads them in place as cards.
 *
 * `/search?q=&tab=` opens straight onto results - the desktop panel's "See
 * all results" and Enter both land here.
 */

const PAGE_LIMIT = 30;
const ALL_PER_KIND = 3;

function SearchScreen() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const params = useLocalSearchParams<{ q?: string; tab?: string }>();
	const email = useAuthStore((state) => state.email);
	const [query, setQuery] = useState(params.q ?? "");
	const [tab, setTab] = useState<SearchTab>(
		isSearchTab(params.tab) ? params.tab : "all",
	);
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);
	const recent = useRecentSearches();

	// Pushed again with a new term (the desktop field, a deep link).
	useEffect(() => {
		if (params.q !== undefined) setQuery(params.q);
		if (isSearchTab(params.tab)) setTab(params.tab);
	}, [params.q, params.tab]);

	const term = useDebounced(query.trim());
	const typed = query.trim().length > 0;
	const active = term.length > 0;

	// "Updates" is two scopes on the server - announcements and posts.
	const primary = useSearch(
		term,
		tab === "updates" ? "story" : tab,
		active,
		PAGE_LIMIT,
	);
	const posts = useSearch(
		term,
		"post",
		active && tab === "updates",
		PAGE_LIMIT,
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
	const requireSignIn = useCallback(() => {
		if (email) return true;
		toast.info("Sign in to follow NGOs, like posts, or save posts.", {
			label: "Sign in",
			onPress: () => router.push("/(auth)/login"),
		});
		return false;
	}, [email, router]);

	/** Opening a result is as much a commit as pressing Search. */
	const open = useCallback(
		(href: string) => {
			if (query.trim()) recent.record(query);
			router.push(href as never);
		},
		[query, recent, router],
	);
	const browse = useCallback(
		(href: string) => router.push(href as never),
		[router],
	);
	const pickTerm = useCallback((value: string, nextTab?: SearchTab) => {
		setQuery(value);
		setTab(nextTab ?? "all");
	}, []);

	const startSections = useStartSections({
		recent,
		onTerm: pickTerm,
		open: browse,
	});

	/* ---- Results, by tab ------------------------------------------------- */
	const orgs = primary.data?.organizations.items ?? [];
	const grouped = useMemo(
		() => groupFeed(primary.data?.feed.items ?? []),
		[primary.data],
	);
	const updates = useMemo(() => {
		if (tab !== "updates") return grouped.updates;
		const merged = [...grouped.updates, ...(posts.data?.feed.items ?? [])];
		const unique = new Map(
			merged.map((item) => [`${item.kind}:${item.id}`, item]),
		);
		return [...unique.values()].sort((a, b) =>
			b.postedAt.localeCompare(a.postedAt),
		);
	}, [tab, grouped.updates, posts.data]);

	const toUpdates = useCallback(() => setTab("updates"), []);
	const sections = useMemo<SearchSection[]>(() => {
		const orgRows = orgs.map((org) => orgEntry(org, open));
		const row = (item: FeedItem) => feedEntry(item, open, toUpdates);
		const kinds: Array<{
			key: Exclude<SearchTab, "all" | "updates">;
			title: string;
			entries: SearchEntry[];
		}> = [
			{ key: "ngos", title: "NGOs", entries: orgRows },
			{ key: "need", title: "Needs", entries: grouped.need.map(row) },
			{ key: "event", title: "Events", entries: grouped.event.map(row) },
		];
		if (tab === "all") {
			const all: SearchSection[] = kinds
				.filter((kind) => kind.entries.length > 0)
				.map((kind) => ({
					key: kind.key,
					title: kind.title,
					entries: kind.entries.slice(0, ALL_PER_KIND),
					...(kind.entries.length > ALL_PER_KIND
						? {
								action: {
									label: "See all",
									onPress: () => setTab(kind.key),
								},
							}
						: {}),
				}));
			if (grouped.updates.length > 0) {
				all.push({
					key: "updates",
					title: "Updates",
					entries: grouped.updates.slice(0, ALL_PER_KIND).map(row),
					action: { label: "See all", onPress: toUpdates },
				});
			}
			return all;
		}
		const one = kinds.find((kind) => kind.key === tab);
		return one && one.entries.length > 0
			? [{ key: one.key, entries: one.entries }]
			: [];
	}, [tab, orgs, grouped, open, toUpdates]);

	const showCards = tab === "updates";
	const loading =
		typed &&
		(!active ||
			primary.isLoading ||
			(showCards && posts.isLoading) ||
			// Placeholder data from the previous term stands in while the next
			// one loads - fine to look at, not grounds for "nothing found".
			primary.isPlaceholderData);
	const error = active
		? (primary.error ?? (showCards ? posts.error : null))
		: null;
	const nothing =
		active &&
		!loading &&
		!error &&
		(showCards ? updates.length === 0 : sections.length === 0);

	/* ---- Stable handlers for the memoised `FeedCard` ---------------------- */
	const updatesRef = useRef<FeedItem[]>([]);
	useEffect(() => {
		updatesRef.current = updates;
	});
	const handleToggleFollow = useCallback(
		(organizationId: string, following: boolean) => {
			if (!requireSignIn()) return;
			toggleFollow.mutate(
				{ organizationId, following },
				{
					onSuccess: () => {
						if (following) return;
						const name = updatesRef.current.find(
							(row) => row.organization?.id === organizationId,
						)?.organization?.organizationName;
						toast.success(name ? `Following ${name}` : "Following", {
							label: "Undo",
							onPress: () => {
								if (!requireSignIn()) return;
								toggleFollow.mutate({ organizationId, following: true });
							},
						});
					},
					onError: (err) => toast.error(apiErrorMessage(err)),
				},
			);
		},
		[requireSignIn, toggleFollow.mutate],
	);
	const handleToggleLike = useCallback(
		(row: FeedItem, isLiked: boolean) => {
			if (requireSignIn()) like.mutate({ item: row, on: !isLiked });
		},
		[like.mutate, requireSignIn],
	);
	const handleToggleSave = useCallback(
		(row: FeedItem, isSaved: boolean) => {
			if (requireSignIn()) save.mutate({ item: row, on: !isSaved });
		},
		[requireSignIn, save.mutate],
	);

	/* ---- Before typing ---------------------------------------------------- */
	const start = (
		<View style={{ paddingTop: spacing[5], gap: spacing[6] }}>
			{startSections.map((section) =>
				section.key === "suggested" ? (
					<View key={section.key}>
						<SearchSectionHeading title="Try searching for" />
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								gap: spacing[2],
							}}
						>
							{SEARCH_SUGGESTIONS.map((item) => (
								<SuggestionChip
									key={item.term}
									label={item.term}
									icon={item.icon}
									onPress={() => pickTerm(item.term, item.tab)}
								/>
							))}
						</View>
					</View>
				) : (
					<EntryGroup key={section.key} section={section} />
				),
			)}
			<Caption color="quaternary" style={{ paddingHorizontal: spacing[1] }}>
				Search looks at NGO names and at the titles and descriptions of needs,
				events and updates, across all of India.
			</Caption>
		</View>
	);

	/* ---- Results ---------------------------------------------------------- */
	const results = (
		<View style={{ paddingTop: spacing[4], gap: spacing[5] }}>
			{loading && sections.length === 0 && !showCards ? (
				<SkeletonList variant="row" count={5} label="Searching" />
			) : error ? (
				<ErrorState
					message={apiErrorMessage(error)}
					onRetry={() => {
						primary.refetch();
						if (showCards) posts.refetch();
					}}
				/>
			) : nothing ? (
				<EmptyState
					icon={tabIcon(tab)}
					title={`No ${TAB_NOUN[tab]} for "${term}"`}
					description={
						tab === "all"
							? "Check the spelling, or try a broader word like blankets or teaching."
							: "Try All - it may be listed as something else."
					}
					{...(tab === "all"
						? {}
						: {
								action: (
									<Button
										variant="link"
										size="sm"
										onPress={() => setTab("all")}
									>
										Search everything
									</Button>
								),
							})}
				/>
			) : showCards ? null : (
				sections.map((section) => (
					<EntryGroup key={section.key} section={section} />
				))
			)}
		</View>
	);

	const footer =
		showCards && active && !error && updates.length > 0 ? (
			<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
				<Caption color="quaternary">That's everything</Caption>
			</View>
		) : showCards && loading && updates.length === 0 ? (
			<SkeletonList count={2} label="Searching" />
		) : null;

	return (
		<Screen style={{ paddingHorizontal: 0 }} measure="reading">
			<View
				style={{
					paddingHorizontal: spacing[4],
					paddingBottom: typed ? spacing[3] : spacing[4],
					gap: spacing[3],
					borderBottomWidth: 1,
					borderBottomColor: colors.border.hairline,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					{/* The full 40pt control, centred against the 48pt field. */}
					<BackButton style={{ alignSelf: "center" }} />
					<View style={{ flex: 1 }}>
						<SearchField
							value={query}
							onChange={setQuery}
							onSubmit={recent.record}
							pending={typed && query.trim() !== term}
							placeholder="Search NGOs, needs, events"
							accessibilityLabel="Search NGOs, needs, events and updates"
							large
							autoFocus={!params.q}
						/>
					</View>
				</View>
				{typed && (
					<FilterChips
						options={SEARCH_TABS}
						value={tab}
						onChange={setTab}
						inline
					/>
				)}
			</View>

			<FlashList
				data={showCards && active ? updates : []}
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
				ListHeaderComponent={
					<View style={{ paddingHorizontal: spacing[4] }}>
						{typed ? results : start}
					</View>
				}
				ListFooterComponent={footer}
				ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[12] }}
			/>

			<PledgeSheet
				need={responding ? toPublicNeed(responding) : null}
				onClose={() => setResponding(null)}
			/>
		</Screen>
	);
}

/** A section of rows on one surface, under its heading. */
function EntryGroup({ section }: { section: SearchSection }) {
	const { spacing } = useTheme();
	return (
		<View>
			{section.title && (
				<SearchSectionHeading title={section.title} action={section.action} />
			)}
			<Surface padded={false} style={{ padding: spacing[1.5] }}>
				{section.entries.map((entry) => (
					<SearchEntryRow key={entry.key} entry={entry} />
				))}
			</Surface>
		</View>
	);
}

/**
 * A suggestion, with the glyph of the tab it searches - a need, an event, an
 * NGO - so a row of them reads as a set of kinds rather than loose words.
 */
function SuggestionChip({
	label,
	icon: Icon,
	onPress,
}: {
	label: string;
	icon: LucideIcon;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`Search ${label}`}
			hitSlop={4}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					height: 38,
					paddingLeft: spacing[3],
					paddingRight: spacing[3.5],
					borderRadius: 999,
					borderWidth: 1,
					borderColor: colors.border.medium,
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			<Icon
				size={15}
				color={colors.text.tertiary as string}
				strokeWidth={1.9}
			/>
			<Caption weight="medium" color="secondary">
				{label}
			</Caption>
		</Pressable>
	);
}

function tabIcon(tab: SearchTab): LucideIcon {
	switch (tab) {
		case "ngos":
			return Building2;
		case "need":
			return HeartHandshake;
		case "event":
			return CalendarDays;
		case "updates":
			return MessageSquareText;
		default:
			return Search;
	}
}

export default withAppShell(SearchScreen);
