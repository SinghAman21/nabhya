import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { EmptyState, ListRow, LoadingState } from "@/components/screen-shell";
import { Caption, Label } from "@/components/ui/typography";
import {
	useMarkNotificationsRead,
	useNotifications,
	useUnreadCount,
} from "@/hooks/use-engagement";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { focusable } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

/**
 * Inbox entry point with an unread badge.
 *
 * On a phone this pushes `/notifications`, because a full screen is the right
 * shape for a list you scroll and act on. On desktop it opens a **popover** —
 * navigating a 1400px window away from what you were reading to show a column
 * of twelve rows is a mobile pattern wearing a desktop layout, and a sheet is
 * worse still: it dims the whole page to show a glance-sized list.
 */
export function NotificationBell() {
	const { colors, borderRadius, elevation, isDark } = useTheme();
	const { isDesktop } = useMedia();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [open, setOpen] = useState(false);

	const { data } = useUnreadCount(!!email);
	const unread = data?.unreadCount ?? 0;

	if (!email) return null;

	const label =
		unread > 0
			? `Notifications, ${unread} unread`
			: "Notifications, none unread";

	const trigger = (
		<Pressable
			onPress={() =>
				isDesktop ? setOpen((o) => !o) : router.push("/notifications")
			}
			hitSlop={10}
			accessibilityRole="button"
			accessibilityLabel={label}
			{...(isDesktop ? { accessibilityState: { expanded: open } } : {})}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as {
					pressed: boolean;
					hovered?: boolean;
				};
				return {
					width: 40,
					height: 40,
					borderRadius: borderRadius.sm,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor:
						open || pressed || hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			<Bell
				size={20}
				color={colors.text.secondary as string}
				strokeWidth={1.9}
			/>

			{unread > 0 && (
				<View
					style={{
						position: "absolute",
						top: 5,
						right: 3,
						minWidth: 17,
						height: 17,
						borderRadius: 9,
						paddingHorizontal: 4,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.primary.main,
					}}
				>
					<Caption
						weight="bold"
						color={colors.primary.contrast as string}
						style={{ fontSize: 10, lineHeight: 13 }}
					>
						{unread > 9 ? "9+" : unread}
					</Caption>
				</View>
			)}
		</Pressable>
	);

	if (!isDesktop || !open) return trigger;

	return (
		<View>
			{trigger}

			{/* Click-away. Sits behind the panel and covers the window. */}
			<Pressable
				onPress={() => setOpen(false)}
				accessibilityLabel="Close notifications"
				style={{
					position: "absolute",
					top: -2000,
					left: -2000,
					right: -2000,
					bottom: -2000,
					zIndex: 40,
				}}
			/>

			<View
				style={{
					position: "absolute",
					top: 46,
					right: 0,
					width: 340,
					zIndex: 50,
					backgroundColor: colors.background.card,
					borderRadius: borderRadius.lg,
					borderWidth: isDark ? 1 : 0,
					borderColor: colors.border.hairline,
					overflow: "hidden",
					...(isDark ? {} : elevation.raised),
				}}
			>
				<NotificationPanel
					onSeeAll={() => {
						setOpen(false);
						router.push("/notifications");
					}}
				/>
			</View>
		</View>
	);
}

/** The popover body: latest few, then a way through to the full screen. */
function NotificationPanel({ onSeeAll }: { onSeeAll: () => void }) {
	const { colors, spacing } = useTheme();
	const query = useNotifications({ limit: 6 });
	const markRead = useMarkNotificationsRead();

	const items = query.data?.items ?? [];
	const anyUnread = items.some((item) => !item.readAt);

	return (
		<>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					paddingHorizontal: spacing[4],
					paddingVertical: spacing[3],
					borderBottomWidth: 1,
					borderBottomColor: colors.border.hairline,
				}}
			>
				<Label weight="semibold">Notifications</Label>
				{anyUnread && (
					<Pressable
						onPress={() => markRead.mutate({})}
						accessibilityRole="button"
						hitSlop={6}
						{...focusable}
					>
						<Caption weight="medium" color={colors.primary.ink}>
							Mark all read
						</Caption>
					</Pressable>
				)}
			</View>

			{query.isLoading ? (
				<LoadingState />
			) : items.length === 0 ? (
				<EmptyState icon={Bell} title="Nothing yet" />
			) : (
				<ScrollView style={{ maxHeight: 360 }}>
					{items.map((item, index) => (
						<View key={item.id}>
							{index > 0 && (
								<View
									style={{
										height: 1,
										marginLeft: spacing[4],
										backgroundColor: colors.border.hairline,
									}}
								/>
							)}
							<ListRow
								label={item.title}
								hint={item.body ?? formatRelative(item.createdAt)}
								value={
									item.readAt ? null : (
										<View
											style={{
												width: 7,
												height: 7,
												borderRadius: 4,
												backgroundColor: colors.primary.main,
											}}
										/>
									)
								}
							/>
						</View>
					))}
				</ScrollView>
			)}

			<Pressable
				onPress={onSeeAll}
				accessibilityRole="button"
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as {
						pressed: boolean;
						hovered?: boolean;
					};
					return {
						alignItems: "center",
						paddingVertical: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
						backgroundColor:
							pressed || hovered ? colors.background.subtle : "transparent",
					};
				}}
			>
				<Caption weight="medium" color={colors.primary.ink}>
					See all
				</Caption>
			</Pressable>
		</>
	);
}
