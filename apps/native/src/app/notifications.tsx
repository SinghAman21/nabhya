import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { BackButton } from "@/components/back-button";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption, H2 } from "@/components/ui/typography";
import {
	useMarkNotificationsRead,
	useNotifications,
} from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";

/** Where each notification type sends you when tapped. */
function destinationFor(item: NotificationItem): string | null {
	switch (item.entityName) {
		case "EVENT":
			return item.entityId ? `/events/${item.entityId}` : null;
		case "CERTIFICATE":
			return "/certificates";
		case "ORGANIZATION_NEED":
			return "/(volunteer)";
		default:
			return null;
	}
}

export default function Notifications() {
	const { colors, spacing } = useTheme();
	const router = useRouter();

	const query = useNotifications();
	const markRead = useMarkNotificationsRead();

	const items = query.data?.items ?? [];
	const unread = query.data?.unreadCount ?? 0;

	const open = (item: NotificationItem) => {
		if (!item.readAt) markRead.mutate({ ids: [item.id] });
		const destination = destinationFor(item);
		if (destination) router.push(destination as never);
	};

	return (
		<Screen>
			<BackButton />

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: spacing[5],
				}}
			>
				<H2>Notifications</H2>
				{unread > 0 && (
					<Pressable onPress={() => markRead.mutate({})} hitSlop={8}>
						<Caption weight="medium" color={colors.primary.main as string}>
							Mark all read
						</Caption>
					</Pressable>
				)}
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={items}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Bell}
							title="Nothing yet"
							description="Updates about your applications, pledges and certificates land here."
						/>
					}
					renderItem={({ item }) => (
						<Surface
							onPress={() => open(item)}
							style={
								item.readAt
									? undefined
									: {
											borderColor: colors.primary.main,
											backgroundColor: colors.background.secondary,
										}
							}
						>
							<View
								style={{
									flexDirection: "row",
									alignItems: "flex-start",
									gap: spacing[3],
								}}
							>
								{!item.readAt && (
									<View
										style={{
											width: 8,
											height: 8,
											borderRadius: 4,
											marginTop: 6,
											backgroundColor: colors.primary.main,
										}}
									/>
								)}
								<View style={{ flex: 1 }}>
									<Body weight={item.readAt ? "medium" : "bold"}>
										{item.title}
									</Body>
									{item.body && (
										<Caption color="secondary" style={{ marginTop: 2 }}>
											{item.body}
										</Caption>
									)}
									<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
										{formatRelative(item.createdAt)}
									</Caption>
								</View>
							</View>
						</Surface>
					)}
				/>
			)}
		</Screen>
	);
}
