import { useRouter } from "expo-router";
import { CalendarCheck } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { EventFeed } from "@/components/event-feed";
import { NotificationBell } from "@/components/notification-bell";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useMyApplications } from "@/hooks/use-events";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateRange } from "@/lib/format";
import type { ApplicationListItem } from "@/lib/types";

type Tab = "browse" | "applications";

const TABS: Array<{ value: Tab; label: string }> = [
	{ value: "browse", label: "Browse" },
	{ value: "applications", label: "My applications" },
];

export default function VolunteerEvents() {
	const { colors, spacing } = useTheme();
	const [tab, setTab] = useState<Tab>("browse");

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<ScreenHeader
				title="Events"
				subtitle="Find something to help with, and track what you've applied to."
				action={<NotificationBell />}
			/>

			<FilterChips options={TABS} value={tab} onChange={setTab} />

			{tab === "browse" ? <EventFeed /> : <MyApplications />}
		</View>
	);
}

function MyApplications() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const query = useMyApplications();

	if (query.isLoading) return <LoadingState label="Loading applications…" />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
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
					icon={CalendarCheck}
					title="No applications yet"
					description="Events you apply to will appear here so you can track their status."
				/>
			}
			renderItem={({ item }) => (
				<ApplicationRow
					application={item}
					onPress={() => router.push(`/events/${item.event.id}`)}
				/>
			)}
		/>
	);
}

function ApplicationRow({
	application,
	onPress,
}: {
	application: ApplicationListItem;
	onPress: () => void;
}) {
	const { spacing } = useTheme();

	return (
		<Surface onPress={onPress}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[3],
					marginBottom: spacing[2],
				}}
			>
				<Caption color="secondary" numberOfLines={1} style={{ flex: 1 }}>
					{application.organization.organizationName}
				</Caption>
				<StatusPill
					label={humanizeStatus(application.status)}
					tone={applicationTone(application.status)}
				/>
			</View>

			<Body weight="bold" numberOfLines={2}>
				{application.event.title}
			</Body>
			<Caption color="tertiary" style={{ marginTop: 4 }}>
				{formatDateRange(application.event.startAt, application.event.endAt)}
				{application.event.city ? ` · ${application.event.city}` : ""}
			</Caption>

			{application.reviewNote && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{application.reviewNote}”
				</Caption>
			)}
		</Surface>
	);
}
