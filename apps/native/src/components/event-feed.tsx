import { useRouter } from "expo-router";
import { CalendarDays, MapPin, Search, Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import { EmptyState, FilterChips, Surface } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { useMedia } from "@/hooks/useMedia";
import { eventsApi, queryKeys } from "@/lib/api";
import { focusWithin } from "@/lib/focus";
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
 * and a paged list of cards. Three columns on desktop, one on a phone.
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
	const { colors, spacing, borderRadius } = useTheme();
	const { isDesktop } = useMedia();
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

			<View
				{...focusWithin}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					backgroundColor: colors.background.subtle,
					borderRadius: borderRadius.lg,
					paddingHorizontal: spacing[3.5],
					marginBottom: spacing[3],
				}}
			>
				<Search size={18} color={colors.text.quaternary as string} />
				<Input
					placeholder="Search events or NGOs"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
					accessibilityLabel="Search events"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3],
					}}
				/>
			</View>

			<FilterChips options={WHEN_FILTERS} value={when} onChange={setWhen} />

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				loadingLabel="Finding events"
				keyExtractor={(item) => item.id}
				numColumns={isDesktop ? 3 : 1}
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
	const { colors, spacing } = useTheme();
	const remaining = Math.max(event.volunteersNeeded - event.acceptedCount, 0);
	const orgInitial =
		event.organization.organizationName?.charAt(0).toUpperCase() ?? "E";
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
				<View
					style={{
						width: 32,
						height: 32,
						borderRadius: 16,
						backgroundColor: colors.primary.tint,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Caption weight="bold" color={colors.primary.ink}>
						{orgInitial}
					</Caption>
				</View>
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
