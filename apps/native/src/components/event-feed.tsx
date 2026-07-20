import { useRouter } from "expo-router";
import { CalendarDays, MapPin, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { usePublicEvents } from "@/hooks/use-events";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

type When = "upcoming" | "past" | "all";

const WHEN_FILTERS: Array<{ value: When; label: string }> = [
	{ value: "upcoming", label: "Upcoming" },
	{ value: "past", label: "Past" },
	{ value: "all", label: "All" },
];

/**
 * The public event feed, shared by the anonymous `/events` page and the
 * volunteer Events tab so both stay identical as the card evolves.
 */
export function EventFeed({
	header,
	contentPaddingTop,
}: {
	header?: React.ReactNode;
	contentPaddingTop?: number;
}) {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [when, setWhen] = useState<When>("upcoming");

	const query = usePublicEvents({ search: search.trim(), when });

	return (
		<View style={{ flex: 1, paddingTop: contentPaddingTop }}>
			{header}

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					backgroundColor: colors.background.tertiary,
					borderRadius: 12,
					paddingHorizontal: spacing[3.5],
					marginBottom: spacing[4],
				}}
			>
				<Search size={18} color={colors.text.quaternary as string} />
				<Input
					placeholder="Search events, causes or NGOs"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3.5],
					}}
				/>
			</View>

			<FilterChips options={WHEN_FILTERS} value={when} onChange={setWhen} />

			{query.isLoading ? (
				<LoadingState label="Finding events…" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.data?.items ?? []}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={CalendarDays}
							title={search ? "No matching events" : "No events yet"}
							description={
								search
									? "Try a different search term or widen the date range."
									: "Verified NGOs will post volunteering events here soon."
							}
						/>
					}
					renderItem={({ item }) => (
						<EventCard
							event={item}
							onPress={() => router.push(`/events/${item.id}`)}
						/>
					)}
				/>
			)}
		</View>
	);
}

export function EventCard({
	event,
	onPress,
}: {
	event: PublicEvent;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	const remaining = Math.max(event.volunteersNeeded - event.acceptedCount, 0);

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
						backgroundColor: colors.background.tertiary,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Caption weight="bold" color="secondary">
						{event.organization.organizationName[0]?.toUpperCase()}
					</Caption>
				</View>
				<Caption color="secondary" numberOfLines={1} style={{ flex: 1 }}>
					{event.organization.organizationName}
				</Caption>
				<StatusPill
					label={remaining > 0 ? `${remaining} spots` : "Full"}
					tone={remaining > 0 ? "success" : "neutral"}
				/>
			</View>

			<Body weight="bold" numberOfLines={2}>
				{event.title}
			</Body>
			<Caption color="tertiary" numberOfLines={2} style={{ marginTop: 4 }}>
				{event.description}
			</Caption>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[4],
					marginTop: spacing[3],
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
					}}
				>
					<CalendarDays size={14} color={colors.text.quaternary as string} />
					<Caption color="quaternary">
						{formatDateRange(event.startAt, event.endAt)}
					</Caption>
				</View>
				{event.city && (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1.5],
						}}
					>
						<MapPin size={14} color={colors.text.quaternary as string} />
						<Caption color="quaternary">{event.city}</Caption>
					</View>
				)}
			</View>
		</Surface>
	);
}
