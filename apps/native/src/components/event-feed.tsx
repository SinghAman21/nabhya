import { useRouter } from "expo-router";
import {
	CalendarDays,
	ChevronRight,
	MapPin,
	Search,
} from "lucide-react-native";
import { useState } from "react";
import {
	FlatList,
	Platform,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
} from "@/components/screen-shell";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { usePublicEvents } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

type When = "upcoming" | "past" | "all";

const WHEN_FILTERS: Array<{ value: When; label: string }> = [
	{ value: "upcoming", label: "Upcoming" },
	{ value: "past", label: "Past" },
	{ value: "all", label: "All" },
];

export function EventFeed({
	header,
	contentPaddingTop,
}: {
	header?: React.ReactNode;
	contentPaddingTop?: number;
}) {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [when, setWhen] = useState<When>("upcoming");

	const query = usePublicEvents({ search: search.trim(), when });
	const events = query.data?.items ?? [];

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
			) : events.length === 0 ? (
				<EmptyState
					icon={CalendarDays}
					title={search ? "No matching events" : "No events yet"}
					description={
						search
							? "Try a different search term or widen the date range."
							: "Verified NGOs will post volunteering events here soon."
					}
				/>
			) : isDesktop ? (
				<DesktopEventGrid
					events={events}
					onPress={(event) => router.push(`/events/${event.id}`)}
				/>
			) : (
				<FlatList
					data={events}
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

function DesktopEventGrid({
	events,
	onPress,
}: {
	events: PublicEvent[];
	onPress: (event: PublicEvent) => void;
}) {
	const { spacing } = useTheme();

	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: spacing[10] }}
		>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					marginHorizontal: -spacing[2],
				}}
			>
				{events.map((event) => (
					<View
						key={event.id}
						style={{
							width: "33.333%",
							paddingHorizontal: spacing[2],
							marginBottom: spacing[4],
						}}
					>
						<EventCard event={event} onPress={() => onPress(event)} />
					</View>
				))}
			</View>
		</ScrollView>
	);
}

export function EventCard({
	event,
	onPress,
}: {
	event: PublicEvent;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const isWeb = Platform.OS === "web";
	const remaining = Math.max(event.volunteersNeeded - event.acceptedCount, 0);
	const orgInitial =
		event.organization.organizationName?.charAt(0).toUpperCase() ?? "E";

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed, hovered }) => ({
				backgroundColor: colors.background.primary,
				borderRadius: borderRadius.lg,
				borderWidth: 1,
				borderColor: pressed ? colors.primary.main : colors.border.light,
				overflow: "hidden",
				...(isWeb && {
					transition: "box-shadow 0.2s, border-color 0.15s",
					boxShadow: hovered
						? "0 4px 12px rgba(0,0,0,0.08)"
						: "0 1px 3px rgba(0,0,0,0.04)",
					cursor: "pointer",
				}),
			})}
		>
			<View style={{ padding: spacing[4] }}>
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
							width: 36,
							height: 36,
							borderRadius: 10,
							backgroundColor: `${colors.primary.main}12`,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Caption
							weight="bold"
							style={{
								fontSize: 15,
								color: colors.primary.main as string,
							}}
						>
							{orgInitial}
						</Caption>
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="semibold" numberOfLines={1}>
							{event.organization.organizationName}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{event.city ?? "Online"}
						</Caption>
					</View>
				</View>

				<Body
					weight="bold"
					numberOfLines={2}
					style={{ fontSize: 16, marginBottom: spacing[1] }}
				>
					{event.title}
				</Body>
				<Caption
					color="tertiary"
					numberOfLines={isWeb ? 2 : 3}
					style={{ lineHeight: 19 }}
				>
					{event.description}
				</Caption>

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
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
						<CalendarDays size={12} color={colors.text.quaternary as string} />
						<Caption color="quaternary" style={{ fontSize: 10.5 }}>
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
							<MapPin size={12} color={colors.text.quaternary as string} />
							<Caption color="quaternary" style={{ fontSize: 10.5 }}>
								{event.city}
							</Caption>
						</View>
					)}
				</View>
			</View>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingVertical: spacing[2.5],
					paddingHorizontal: spacing[4],
					borderTopWidth: 1,
					borderTopColor: colors.border.light,
				}}
			>
				<Caption
					weight="semibold"
					style={{
						fontSize: 12,
						color:
							remaining > 0
								? (colors.success.main as string)
								: (colors.text.tertiary as string),
					}}
				>
					{remaining > 0 ? `${remaining} volunteer spots` : "Event full"}
				</Caption>
				<ChevronRight size={14} color={colors.text.quaternary as string} />
			</View>
		</Pressable>
	);
}
