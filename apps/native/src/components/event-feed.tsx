import { useRouter } from "expo-router";
import { CalendarDays, MapPin, Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { OrgLogo } from "@/components/org-branding";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import { EmptyState, FilterChips, Surface } from "@/components/screen-shell";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { eventsApi, queryKeys } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

type When = "upcoming" | "past" | "all";

const WHEN_FILTERS: Array<{ value: When; label: string }> = [
	{ value: "upcoming", label: "Upcoming" },
	{ value: "past", label: "Past" },
	{ value: "all", label: "All" },
];

/**
 * The browsable list of public events: search, an Upcoming / Past / All lens,
 * and a paged list of cards. Up to three columns on desktop (by window
 * width, `useGridColumns`), one on a phone.
 *
 * The search field and chips sit above the list rather than inside it, so a
 * keystroke that empties the results does not unmount the field mid-word.
 */
export function EventFeed({
	header,
	contentPaddingTop,
}: {
	header?: React.ReactNode;
	contentPaddingTop?: number;
}) {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const columns = useGridColumns();
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [when, setWhen] = useState<When>("upcoming");
	const debouncedSearch = useDebounced(search.trim());

	const filters = {
		when,
		...(debouncedSearch ? { search: debouncedSearch } : {}),
	};
	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.publicEvents({ ...filters, limit: PAGE_SIZE }),
		fetchPage: (page) =>
			eventsApi.listPublic({ ...filters, page, limit: PAGE_SIZE }),
	});

	return (
		<View style={{ flex: 1, paddingTop: contentPaddingTop }}>
			{header}

			{/* One row on desktop: the field and its lens side by side, so the
			    grid starts a row higher. Stacked on a phone. */}
			<View
				style={{
					flexDirection: isDesktop ? "row" : "column",
					alignItems: isDesktop ? "center" : "stretch",
					gap: isDesktop ? spacing[4] : spacing[3],
					marginBottom: spacing[5],
				}}
			>
				<View style={{ flex: isDesktop ? 1 : undefined }}>
					<SearchField
						value={search}
						onChange={setSearch}
						placeholder="Search events or NGOs"
						accessibilityLabel="Search events"
						pending={search.trim() !== debouncedSearch}
						maxWidth={isDesktop ? 480 : undefined}
					/>
				</View>
				<FilterChips
					options={WHEN_FILTERS}
					value={when}
					onChange={setWhen}
					inline
				/>
			</View>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Finding events"
				keyExtractor={(item) => item.id}
				// The shared breakpoints (1 / 2 / 3 by window width), not a flat 3:
				// at 800pt three columns were 240pt cards with titles in two words.
				numColumns={columns}
				empty={
					<EmptyState
						icon={CalendarDays}
						title={
							debouncedSearch
								? "No events match"
								: when === "past"
									? "No past events"
									: "No events yet"
						}
						description={
							debouncedSearch
								? "Try another word, or clear the search to see everything."
								: when === "upcoming"
									? "When a verified NGO publishes an event, it appears here."
									: "Finished events will show up here."
						}
						action={
							debouncedSearch ? (
								<Button
									size="sm"
									variant="outline"
									onPress={() => setSearch("")}
								>
									Clear search
								</Button>
							) : when !== "all" ? (
								<Button
									size="sm"
									variant="outline"
									onPress={() => setWhen("all")}
								>
									Show all events
								</Button>
							) : undefined
						}
					/>
				}
				renderItem={(item) => (
					<EventCard
						event={item}
						onPress={() => router.push(`/events/${item.id}`)}
					/>
				)}
			/>
		</View>
	);
}

/**
 * One event. Who is running it, what it is, when and where, and how many
 * places are left - the number a volunteer is actually deciding on.
 */
export function EventCard({
	event,
	onPress,
}: {
	event: PublicEvent;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	const remaining = Math.max(event.volunteersNeeded - event.acceptedCount, 0);
	const place = event.city ?? "Online";

	return (
		<Surface onPress={onPress}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2.5],
					marginBottom: spacing[3],
				}}
			>
				<OrgLogo
					name={event.organization.organizationName}
					imageKey={event.organization.logo}
					size={32}
				/>
				<Caption color="secondary" numberOfLines={1} style={{ flex: 1 }}>
					{event.organization.organizationName}
				</Caption>
			</View>

			<H5 numberOfLines={2}>{event.title}</H5>
			<Caption
				color="tertiary"
				numberOfLines={2}
				style={{ marginTop: spacing[1] }}
			>
				{event.description}
			</Caption>

			<View style={{ gap: spacing[1.5], marginTop: spacing[3] }}>
				<Fact
					icon={CalendarDays}
					text={formatDateRange(event.startAt, event.endAt)}
				/>
				<Fact icon={MapPin} text={place} />
				<Fact
					icon={Users}
					text={
						remaining > 0 ? `${remaining} places left` : "All places filled"
					}
					tone={remaining > 0 ? "default" : "muted"}
				/>
			</View>
		</Surface>
	);
}

function Fact({
	icon: Icon,
	text,
	tone = "default",
}: {
	icon: typeof CalendarDays;
	text: string;
	tone?: "default" | "muted";
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
		>
			<Icon
				size={14}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<Label
				weight={tone === "muted" ? "normal" : "medium"}
				color={tone === "muted" ? "quaternary" : "secondary"}
				numberOfLines={1}
				style={{ flex: 1 }}
			>
				{text}
			</Label>
		</View>
	);
}
