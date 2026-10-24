import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	ArrowUpRight,
	Building2,
	CalendarDays,
	Clock,
	HeartHandshake,
	MessageSquareText,
	Search,
	Users,
	X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	ScrollView,
	type TextInput,
	View,
} from "react-native";
import { OrgLogo } from "@/components/org-branding";
import { SearchField } from "@/components/search-field";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useSearch } from "@/hooks/use-search";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { focusable, type PressState } from "@/lib/focus";
import { formatDate, formatRelative } from "@/lib/format";
import { useRecentSearches } from "@/lib/recent-searches";
import type { FeedItem, PublicOrganization } from "@/lib/types";

/**
 * Search's shared parts: what to offer before a term is typed, how a result
 * reads as a row, and the desktop floating panel.
 *
 * The search page (`app/search.tsx`) and the panel under a desktop search
 * field (`SearchFloat`, in the volunteer top bar and the NGO feed header) show
 * the **same** content - recent searches, suggestions, browse shortcuts, and
 * results grouped by kind - so a person who learns one has learnt both. The
 * panel is the quick look (three of each kind); Enter or "See all results"
 * opens the page with the term and the full tabs.
 */

/* -------------------------------------------------------------------------- */
/* Tabs, suggestions, hrefs                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The result tabs. "Updates" is an NGO's writing, whichever row type carries
 * it - an announcement (`story`) or a plain post (`post`) - because from the
 * reader's side they are the same thing; the server takes one scope, so the
 * page asks for both and merges.
 */
export type SearchTab = "all" | "ngos" | "need" | "event" | "updates";

export const SEARCH_TABS: { value: SearchTab; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "ngos", label: "NGOs" },
	{ value: "need", label: "Needs" },
	{ value: "event", label: "Events" },
	{ value: "updates", label: "Updates" },
];

export function isSearchTab(value: unknown): value is SearchTab {
	return SEARCH_TABS.some((tab) => tab.value === value);
}

/**
 * Concrete, and each tied to the tab it belongs in, so a suggestion says what
 * it will find ("Blankets" is a need, "Medical camp" an event) instead of
 * being a loose word in a pill.
 */
export const SEARCH_SUGGESTIONS: {
	term: string;
	tab: SearchTab;
	icon: LucideIcon;
}[] = [
	{ term: "Blankets", tab: "need", icon: HeartHandshake },
	{ term: "Books", tab: "need", icon: HeartHandshake },
	{ term: "Laptops", tab: "need", icon: HeartHandshake },
	{ term: "Medical camp", tab: "event", icon: CalendarDays },
	{ term: "Tree planting", tab: "event", icon: CalendarDays },
	{ term: "Food drive", tab: "event", icon: CalendarDays },
	{ term: "Old age home", tab: "ngos", icon: Building2 },
	{ term: "Teaching", tab: "ngos", icon: Building2 },
];

export const TAB_NOUN: Record<SearchTab, string> = {
	all: "results",
	ngos: "NGOs",
	need: "needs",
	event: "events",
	updates: "updates",
};

export function searchHref(term: string, tab?: SearchTab) {
	const params = [`q=${encodeURIComponent(term.trim())}`];
	if (tab && tab !== "all") params.push(`tab=${tab}`);
	return `/search?${params.join("&")}`;
}

/* -------------------------------------------------------------------------- */
/* Result rows                                                                */
/* -------------------------------------------------------------------------- */

/** One thing the person can choose, in the panel or on the page. */
export interface SearchEntry {
	key: string;
	label: string;
	meta?: string;
	icon?: LucideIcon;
	/** An NGO row leads with its logo instead of an icon. */
	org?: { name: string; logo: string | null };
	onSelect: () => void;
	/** A second control at the row's end - "remove this recent search". */
	onRemove?: () => void;
	removeLabel?: string;
	/** Draw the label in brand ink: "See all results". */
	accent?: boolean;
}

export interface SearchSection {
	key: string;
	title?: string;
	action?: { label: string; onPress: () => void };
	entries: SearchEntry[];
}

function joinMeta(parts: Array<string | null | undefined | false>) {
	return parts.filter(Boolean).join(" · ");
}

function place(city: string | null, state: string | null) {
	return [city, state].filter(Boolean).join(", ") || null;
}

export function orgEntry(
	org: PublicOrganization,
	open: (href: string) => void,
): SearchEntry {
	return {
		key: `org:${org.id}`,
		label: org.organizationName,
		meta: joinMeta(["NGO", place(org.city, org.state)]),
		org: { name: org.organizationName, logo: org.logo },
		onSelect: () => open(`/ngos/${org.id}`),
	};
}

/**
 * A feed row as a search result: what it is, who posted it, where, and the
 * one date that matters for its kind - an event's start, a need's age.
 * Updates have no page of their own, so they open the NGO that wrote them.
 */
export function feedEntry(
	item: FeedItem,
	open: (href: string) => void,
	fallback: () => void,
): SearchEntry {
	const org = item.organization?.organizationName;
	const key = `${item.kind}:${item.id}`;
	switch (item.kind) {
		case "need":
			return {
				key,
				label: item.title || "Need",
				icon: HeartHandshake,
				meta: joinMeta([
					item.isUrgent && "Urgent",
					item.need.type === "OFFER" ? "Giving away" : "Needs help",
					org,
					item.city,
				]),
				onSelect: () => open(`/needs/${item.id}`),
			};
		case "event":
			return {
				key,
				label: item.title || "Event",
				icon: CalendarDays,
				meta: joinMeta([formatDate(item.event.startAt), org, item.city]),
				onSelect: () => open(`/events/${item.id}`),
			};
		default: {
			const text =
				item.title ||
				(item.kind === "post" ? item.post.text : item.description) ||
				"Update";
			return {
				key,
				label: text.replace(/\s+/g, " ").trim(),
				icon: item.kind === "post" ? MessageSquareText : Users,
				meta: joinMeta([
					"Update",
					org ?? item.author?.fullName,
					`Posted ${formatRelative(item.postedAt)}`,
				]),
				onSelect: item.organization
					? () => open(`/ngos/${item.organization?.id}`)
					: fallback,
			};
		}
	}
}

/** Feed results split into the page's tabs. */
export function groupFeed(items: FeedItem[]) {
	return {
		need: items.filter((item) => item.kind === "need"),
		event: items.filter((item) => item.kind === "event"),
		updates: items.filter(
			(item) => item.kind === "story" || item.kind === "post",
		),
	};
}

/**
 * One result. A fixed 36pt leading slot (logo, or the kind's glyph in an
 * inset well) so every title starts on the same line; title on one line,
 * the facts muted under it. `highlighted` is the keyboard cursor in the
 * floating panel.
 */
export function SearchEntryRow({
	entry,
	highlighted,
	dense,
}: {
	entry: SearchEntry;
	highlighted?: boolean;
	/** 44pt rows with a 32pt slot, for the floating panel. */
	dense?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const slot = dense ? 32 : 36;
	const Icon = entry.icon;

	const row = (
		<Pressable
			onPress={entry.onSelect}
			accessibilityRole={entry.accent ? "link" : "button"}
			accessibilityLabel={
				entry.meta ? `${entry.label}. ${entry.meta}` : entry.label
			}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					minHeight: dense ? 48 : 56,
					paddingHorizontal: spacing[3],
					paddingVertical: spacing[2],
					borderRadius: borderRadius.md,
					backgroundColor:
						highlighted || pressed || hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			<View
				style={{
					width: slot,
					height: slot,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{entry.org ? (
					<OrgLogo
						name={entry.org.name}
						imageKey={entry.org.logo}
						size={slot}
					/>
				) : Icon ? (
					<View
						style={{
							width: slot,
							height: slot,
							borderRadius: borderRadius.md,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: entry.accent
								? "transparent"
								: colors.background.subtle,
						}}
					>
						<Icon
							size={dense ? 16 : 17}
							strokeWidth={1.9}
							color={
								(entry.accent
									? colors.primary.ink
									: colors.text.tertiary) as string
							}
						/>
					</View>
				) : null}
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Body
					weight="medium"
					numberOfLines={1}
					color={entry.accent ? (colors.primary.ink as string) : "primary"}
				>
					{entry.label}
				</Body>
				{entry.meta ? (
					<Caption color="tertiary" numberOfLines={1}>
						{entry.meta}
					</Caption>
				) : null}
			</View>
		</Pressable>
	);

	if (!entry.onRemove) return row;

	// Beside the row's pressable, never inside it: no button in a button.
	return (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			<View style={{ flex: 1, minWidth: 0 }}>{row}</View>
			<Pressable
				onPress={entry.onRemove}
				accessibilityRole="button"
				accessibilityLabel={entry.removeLabel ?? `Remove ${entry.label}`}
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						width: 40,
						height: 40,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor:
							pressed || hovered ? colors.background.subtle : "transparent",
					};
				}}
			>
				<X size={15} color={colors.text.quaternary as string} strokeWidth={2} />
			</Pressable>
		</View>
	);
}

/** A section's small heading row, with an optional text action at the end. */
export function SearchSectionHeading({
	title,
	action,
	dense,
}: {
	title: string;
	action?: { label: string; onPress: () => void };
	dense?: boolean;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				minHeight: 32,
				paddingHorizontal: dense ? spacing[3] : spacing[1],
				marginBottom: dense ? 0 : spacing[1],
			}}
		>
			<Caption weight="semibold" color="tertiary" accessibilityRole="header">
				{title}
			</Caption>
			{action && (
				<Pressable
					onPress={action.onPress}
					accessibilityRole="button"
					hitSlop={8}
					{...focusable}
					style={{ minHeight: 32, justifyContent: "center" }}
				>
					<Caption weight="semibold" color={colors.primary.ink as string}>
						{action.label}
					</Caption>
				</Pressable>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Before typing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * What to offer on an empty field: recent searches (most recent first, five
 * at most here), then suggestions, then the browse shortcuts. The page and
 * the panel both build theirs from this.
 */
export function useStartSections({
	recent,
	onTerm,
	open,
	recentLimit = 5,
	suggestionLimit = SEARCH_SUGGESTIONS.length,
}: {
	recent: ReturnType<typeof useRecentSearches>;
	onTerm: (term: string, tab?: SearchTab) => void;
	open: (href: string) => void;
	recentLimit?: number;
	suggestionLimit?: number;
}): SearchSection[] {
	return useMemo(() => {
		const sections: SearchSection[] = [];
		if (recent.terms.length > 0) {
			sections.push({
				key: "recent",
				title: "Recent",
				action: { label: "Clear", onPress: recent.clear },
				entries: recent.terms.slice(0, recentLimit).map((term) => ({
					key: `recent:${term}`,
					label: term,
					icon: Clock,
					onSelect: () => onTerm(term),
					onRemove: () => recent.remove(term),
					removeLabel: `Remove ${term} from recent searches`,
				})),
			});
		}
		sections.push({
			key: "suggested",
			title: "Try",
			entries: SEARCH_SUGGESTIONS.slice(0, suggestionLimit).map((item) => ({
				key: `try:${item.term}`,
				label: item.term,
				meta: `in ${SEARCH_TABS.find((tab) => tab.value === item.tab)?.label}`,
				icon: item.icon,
				onSelect: () => onTerm(item.term, item.tab),
			})),
		});
		sections.push({
			key: "browse",
			title: "Browse",
			entries: [
				{
					key: "browse:ngos",
					label: "All verified NGOs",
					meta: "Every organisation on Nabhya, by city",
					icon: Building2,
					onSelect: () => open("/ngos"),
				},
				{
					key: "browse:events",
					label: "Upcoming events",
					meta: "Everything you can sign up for",
					icon: CalendarDays,
					onSelect: () => open("/events"),
				},
			],
		});
		return sections;
	}, [recent, onTerm, open, recentLimit, suggestionLimit]);
}

/* -------------------------------------------------------------------------- */
/* Desktop floating panel                                                     */
/* -------------------------------------------------------------------------- */

const PREVIEW_PER_KIND = 3;

/**
 * A search field with a panel that drops from it while it is in use: on an
 * empty field, recent searches, suggestions and browse shortcuts; once a term
 * is typed, the top few NGOs, needs, events and updates, and "See all
 * results", which (like Enter) opens `/search?q=`.
 *
 * **Anchored, not portalled.** The panel is absolutely positioned inside the
 * field's own wrapper, so it moves with it and needs no measuring. That puts
 * the burden on the *host* to sit above whatever follows it: the top bar and
 * the NGO feed header each set a `zIndex` on their row for exactly this.
 * Closes on Escape, on a press outside the field and panel, and when focus
 * leaves both; Up/Down move a cursor through the rows and Enter opens it.
 * Web only, in practice - it is mounted on desktop layouts - but nothing in it
 * breaks on native, where the keyboard and pointer listeners are skipped.
 */
export function SearchFloat({
	placeholder,
	maxWidth,
	compact,
}: {
	placeholder: string;
	maxWidth?: number;
	compact?: boolean;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const router = useRouter();
	const recent = useRecentSearches();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [cursor, setCursor] = useState(-1);
	const containerRef = useRef<View>(null);
	const inputRef = useRef<TextInput>(null);

	const term = useDebounced(query.trim());
	const result = useSearch(term, "all", open && term.length > 0, 12);

	const close = useCallback(() => {
		setOpen(false);
		setCursor(-1);
	}, []);

	const go = useCallback(
		(href: string) => {
			close();
			inputRef.current?.blur();
			router.push(href as never);
		},
		[close, router],
	);

	/** Opening anything from a typed term commits it to recent searches. */
	const openResult = useCallback(
		(href: string) => {
			if (query.trim()) recent.record(query);
			go(href);
		},
		[go, query, recent],
	);

	const seeAll = useCallback(
		(raw: string, tab?: SearchTab) => {
			const value = raw.trim();
			if (!value) return;
			recent.record(value);
			setQuery("");
			go(searchHref(value, tab));
		},
		[go, recent],
	);

	const onTerm = useCallback(
		(value: string, tab?: SearchTab) => seeAll(value, tab),
		[seeAll],
	);

	const startSections = useStartSections({
		recent,
		onTerm,
		open: go,
		suggestionLimit: 4,
	});

	const typed = query.trim().length > 0;
	const settled = typed && term === query.trim();
	const loading = typed && (!settled || result.isLoading);

	const resultSections = useMemo<SearchSection[]>(() => {
		if (!typed) return [];
		const sections: SearchSection[] = [];
		const data = result.data;
		if (data) {
			const orgs = data.organizations.items.slice(0, PREVIEW_PER_KIND);
			const grouped = groupFeed(data.feed.items);
			const fallback = () => seeAll(query, "updates");
			if (orgs.length)
				sections.push({
					key: "ngos",
					title: "NGOs",
					entries: orgs.map((org) => orgEntry(org, openResult)),
				});
			for (const [key, title] of [
				["need", "Needs"],
				["event", "Events"],
				["updates", "Updates"],
			] as const) {
				const rows = grouped[key].slice(0, PREVIEW_PER_KIND);
				if (rows.length)
					sections.push({
						key,
						title,
						entries: rows.map((item) => feedEntry(item, openResult, fallback)),
					});
			}
		}
		sections.push({
			key: "see-all",
			entries: [
				{
					key: "see-all",
					label: `See all results for "${query.trim()}"`,
					icon: ArrowUpRight,
					accent: true,
					onSelect: () => seeAll(query),
				},
			],
		});
		return sections;
	}, [typed, result.data, query, openResult, seeAll]);

	const sections = typed ? resultSections : startSections;
	const flat = useMemo(
		() => sections.flatMap((section) => section.entries),
		[sections],
	);

	// Escape, the arrow keys and Enter, while focus is inside the field or
	// panel. A native listener on the wrapper, because the keys have to be
	// read from the input and from a focused row alike.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const node = containerRef.current as unknown as HTMLElement | null;
		if (!node?.addEventListener) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (!open) return;
				event.preventDefault();
				close();
				inputRef.current?.blur();
				return;
			}
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				if (!open) {
					setOpen(true);
					return;
				}
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				setCursor((current) => {
					const count = flat.length;
					if (count === 0) return -1;
					const next = current + step;
					if (next < -1) return count - 1;
					if (next >= count) return -1;
					return next;
				});
				return;
			}
			if (event.key === "Enter") {
				const target = event.target as HTMLElement | null;
				// A focused row handles its own Enter as a press.
				if (target?.tagName !== "INPUT") return;
				event.preventDefault();
				const entry = cursor >= 0 ? flat[cursor] : undefined;
				if (entry) entry.onSelect();
				else seeAll(query);
			}
		};
		node.addEventListener("keydown", onKey);
		return () => node.removeEventListener("keydown", onKey);
	}, [open, close, flat, cursor, query, seeAll]);

	// A press or focus outside both the field and the panel closes it.
	useEffect(() => {
		if (!open || Platform.OS !== "web" || typeof document === "undefined") {
			return;
		}
		const node = containerRef.current as unknown as HTMLElement | null;
		const outside = (event: Event) => {
			if (node && !node.contains(event.target as Node)) close();
		};
		document.addEventListener("mousedown", outside);
		document.addEventListener("focusin", outside);
		return () => {
			document.removeEventListener("mousedown", outside);
			document.removeEventListener("focusin", outside);
		};
	}, [open, close]);

	const activeKey = cursor >= 0 ? flat[cursor]?.key : undefined;

	return (
		<View
			ref={containerRef}
			style={{
				width: "100%",
				...(maxWidth ? { maxWidth } : {}),
				position: "relative",
			}}
		>
			<SearchField
				inputRef={inputRef}
				value={query}
				onChange={(next) => {
					setQuery(next);
					// The cursor belongs to the list it was moved through.
					setCursor(-1);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				placeholder={placeholder}
				pending={typed && !settled}
				compact={compact}
				expanded={open}
			/>
			{open && (
				<View
					style={{
						position: "absolute",
						top: (compact ? 40 : 44) + spacing[1.5],
						left: 0,
						right: 0,
						zIndex: 100,
						maxHeight: 520,
						borderRadius: borderRadius.lg,
						backgroundColor: colors.background.card,
						borderWidth: isDark ? 1 : 0,
						borderColor: colors.border.hairline,
						overflow: "hidden",
						...(isDark ? {} : elevation.raised),
					}}
				>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{
							padding: spacing[1.5],
						}}
					>
						{typed && loading && !result.data ? (
							<StatusLine>
								<ActivityIndicator
									size="small"
									color={colors.text.quaternary as string}
								/>
								<Caption color="tertiary">Searching...</Caption>
							</StatusLine>
						) : null}
						{typed && result.isError ? (
							<StatusLine>
								<Caption color="tertiary" numberOfLines={2}>
									{apiErrorMessage(result.error)}
								</Caption>
							</StatusLine>
						) : null}
						{typed && settled && result.data && resultSections.length === 1 ? (
							<StatusLine>
								<Search
									size={15}
									color={colors.text.quaternary as string}
									strokeWidth={1.9}
								/>
								<Caption color="tertiary">
									No quick matches. Try the full search.
								</Caption>
							</StatusLine>
						) : null}
						{sections.map((section, index) => (
							<View
								key={section.key}
								style={{
									paddingTop: index > 0 && section.title ? spacing[2] : 0,
									...(section.key === "see-all" && index > 0
										? {
												marginTop: spacing[1.5],
												paddingTop: spacing[1.5],
												borderTopWidth: 1,
												borderTopColor: colors.border.hairline,
											}
										: {}),
								}}
							>
								{section.title && (
									<SearchSectionHeading
										title={section.title}
										action={section.action}
										dense
									/>
								)}
								{section.entries.map((entry) => (
									<SearchEntryRow
										key={entry.key}
										entry={entry}
										highlighted={entry.key === activeKey}
										dense
									/>
								))}
							</View>
						))}
					</ScrollView>
				</View>
			)}
		</View>
	);
}

function StatusLine({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();
	return (
		<View
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				minHeight: 44,
				paddingHorizontal: spacing[3],
			}}
		>
			{children}
		</View>
	);
}

/**
 * The phone's way into search: a 44pt icon button that pushes `/search`. One
 * component so every header that offers search (volunteer Home, the NGO
 * feed) draws the same glyph at the same size.
 */
export function SearchButton() {
	const { colors } = useTheme();
	const router = useRouter();
	return (
		<Pressable
			onPress={() => router.push("/search")}
			accessibilityRole="button"
			accessibilityLabel="Search"
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					width: 44,
					height: 44,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			<Search size={21} color={colors.text.primary as string} strokeWidth={2} />
		</Pressable>
	);
}
