import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import { EmptyState, Screen, ScreenHeader } from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useMarkNotificationsRead } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { notificationsApi, queryKeys } from "@/lib/api";
import { focusable } from "@/lib/focus";
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

/**
 * The full inbox. One grouped list, newest first, unread rows carry a dot in
 * the gutter and a bold title. Tapping marks the row read and opens whatever it
 * is about, when it is about something the app can show.
 */
function Notifications() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const markRead = useMarkNotificationsRead();

	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.notifications({ limit: PAGE_SIZE }),
		fetchPage: (page) => notificationsApi.list({ page, limit: PAGE_SIZE }),
	});
	const unread = first?.unreadCount ?? 0;

	const open = (item: NotificationItem) => {
		if (!item.readAt) markRead.mutate({ ids: [item.id] });
		const destination = destinationFor(item);
		if (destination) router.push(destination as never);
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Notifications"
				{...(unread > 0 ? { subtitle: `${unread} unread` } : {})}
				action={
					unread > 0 ? (
						<Pressable
							onPress={() => markRead.mutate({})}
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel="Mark all notifications as read"
							{...focusable}
						>
							<Caption weight="medium" color={colors.primary.ink}>
								Mark all read
							</Caption>
						</Pressable>
					) : undefined
				}
			/>

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				grouped
				keyExtractor={(item) => item.id}
				empty={
					<EmptyState
						icon={Bell}
						title="You're all caught up"
						description="When an NGO reviews your application or pledge, or issues a certificate, it will show up here."
					/>
				}
				renderItem={(item) => {
					const destination = destinationFor(item);
					return (
						<Pressable
							onPress={() => open(item)}
							accessibilityRole="button"
							accessibilityLabel={`${item.title}${item.body ? `. ${item.body}` : ""}${item.readAt ? "" : ". Unread"}`}
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as {
									pressed: boolean;
									hovered?: boolean;
								};
								return {
									flexDirection: "row",
									alignItems: "flex-start",
									gap: spacing[3],
									paddingHorizontal: spacing[4],
									paddingVertical: spacing[3.5],
									backgroundColor:
										pressed || hovered
											? colors.background.subtle
											: "transparent",
								};
							}}
						>
							{/* Unread dot lives in the gutter so titles share a baseline. */}
							<View style={{ width: 7, paddingTop: 8 }}>
								{!item.readAt && (
									<View
										style={{
											width: 7,
											height: 7,
											borderRadius: 4,
											backgroundColor: colors.primary.main,
										}}
									/>
								)}
							</View>
							<View style={{ flex: 1, minWidth: 0 }}>
								<Body
									weight={item.readAt ? "medium" : "bold"}
									numberOfLines={2}
								>
									{item.title}
								</Body>
								{item.body && (
									<Caption
										color="secondary"
										numberOfLines={3}
										style={{ marginTop: spacing[0.5] }}
									>
										{item.body}
									</Caption>
								)}
								<Caption color="quaternary" style={{ marginTop: spacing[1.5] }}>
									{formatRelative(item.createdAt)}
									{destination ? " · Tap to open" : ""}
								</Caption>
							</View>
						</Pressable>
					);
				}}
			/>
		</Screen>
	);
}

export default withAppShell(Notifications);
