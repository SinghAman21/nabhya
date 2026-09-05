import type { FeedKind } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	Bookmark,
	Building2,
	CalendarDays,
	HeartHandshake,
	Megaphone,
	Search,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { FeedCard, toPublicNeed } from "@/components/feed/feed-card";
import { SearchField } from "@/components/feed/search-field";
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
import { Pressable } from "@/components/ui/pressable";
import { Caption } from "@/components/ui/typography";
import { useOrganizations } from "@/hooks/use-directory";
import { useToggleBookmark } from "@/hooks/use-engagement";
import { useFeed } from "@/hooks/use-feed";
import { useDebounced } from "@/hooks/useDebounced";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import type { FeedItem, FeedNeedItem } from "@/lib/types";

/**
 * Search, as its own page.
 *
 * There is more to find than one list can hold — an NGO by name, a specific
 * item, an event in another city — so the field gets a screen with a keyboard
 * up from the first frame. Before a term is typed the page teaches what it can
 * find: a few example searches and the two browse destinations. Once a term is
 * in, result tabs split by what the person is looking for: everything, NGOs,
 * needs, events or updates. Search is the one place the city scope is dropped
 * on purpose — someone typing a name wants that name, wherever it is.
 */

type Scope = "all" | "ngos" | FeedKind;

const SCOPES: Array<{ value: Scope; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "ngos", label: "NGOs" },
	{ value: "need", label: "Needs" },
	{ value: "event", label: "Events" },
	{ value: "story", label: "Updates" },
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

export default function SearchScreen() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [scope, setScope] = useState<Scope>("all");
	const [responding, setResponding] = useState<FeedNeedItem | null>(null);

	const term = useDebounced(query.trim());
	const active = term.length > 0;
	const wantOrgs = active && (scope === "all" || scope === "ngos");
	const wantPosts = active && scope !== "ngos";

	const orgs = useOrganizations(
		wantOrgs ? { search: term, limit: scope === "ngos" ? 25 : 5 } : {},
	);
	const feed = useFeed(
		wantPosts
			? {
					tab: "for_you",
					search: term,
					...(scope === "all" ? {} : { kind: scope }),
				}
			: {},
	);
	const toggleFollow = useToggleBookmark();

	const items = useMemo(
		() =>
			wantPosts ? (feed.data?.pages.flatMap((page) => page.items) ?? []) : [],
		[wantPosts, feed.data],
	);
	const orgItems = wantOrgs ? (orgs.data?.items ?? []) : [];
	const loading = (wantPosts && feed.isLoading) || (wantOrgs && orgs.isLoading);
	const error = wantPosts && feed.isError ? feed.error : null;
	const nothing =
		active && !loading && !error && items.length === 0 && orgItems.length === 0;

	const loadMore = () => {
		if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
	};

	/* ---- Before typing: teach what search can do ------------------------- */
	const guide = (
		<View style={{ paddingTop: spacing[5] }}>
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
			{orgItems.length > 0 && (
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
								onPress={() => router.push(`/ngos/${org.id}`)}
							/>
						))}
					</ListGroup>
				</View>
			)}
			{items.length > 0 && scope === "all" && (
				<SectionTitle>Posts across India</SectionTitle>
			)}
		</View>
	);

	const footer = !active ? null : loading ? (
		<LoadingState label="Searching…" />
	) : error ? (
		<ErrorState
			message={apiErrorMessage(error)}
			onRetry={() => feed.refetch()}
		/>
	) : nothing ? (
		<EmptyState
			icon={scopeIcon(scope)}
			title={`No ${scopeNoun(scope)} for “${term}”`}
			description={
				scope === "all"
					? "Check the spelling, or try a broader word like “blankets” or “teaching”."
					: "Try the All tab — it may be listed as something else."
			}
		/>
	) : feed.isFetchingNextPage ? (
		<View style={{ paddingVertical: spacing[6], alignItems: "center" }}>
			<ActivityIndicator color={colors.text.quaternary as string} />
		</View>
	) : items.length > 0 && !feed.hasNextPage ? (
		<View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
			<Caption color="quaternary">That's everything</Caption>
		</View>
	) : null;

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
				<BackButton />
				<View style={{ flex: 1 }}>
					<SearchField
						value={query}
						onChange={setQuery}
						pending={query.trim() !== term}
						autoFocus
					/>
				</View>
			</View>

			<FlatList
				data={items}
				keyExtractor={(item: FeedItem) => `${item.kind}:${item.id}`}
				renderItem={({ item }) => (
					<FeedCard
						item={item}
						onRespond={setResponding}
						onToggleFollow={(id) => toggleFollow.mutate(id)}
					/>
				)}
				ListHeaderComponent={active ? resultsHeader : guide}
				ListFooterComponent={footer}
				ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
				onEndReached={loadMore}
				onEndReachedThreshold={0.6}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				showsVerticalScrollIndicator={false}
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
