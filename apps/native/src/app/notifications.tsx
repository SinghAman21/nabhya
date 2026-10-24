import { useRouter } from "expo-router";
import { Bell, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import { PAGE_SIZE, PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useMarkNotificationsRead } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { notificationsApi, queryKeys } from "@/lib/api";
import { focusable, type PressState } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import { notificationDestination } from "@/lib/notification-destination";
import type { NotificationItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

/**
 * The full inbox, newest first, grouped by day.
 *
 * **The page is the scroller.** It used to be a capped 720 column holding one
 * grouped card that scrolled *inside itself* - a second scrollbar a hand's
 * width from the page edge, under a header that never moved, beside a sidebar
 * and a back chevron that both said "leave". Now the title and the filter row
 * are the list's header, so the whole page scrolls as one, and each day is its
 * own grouped card under a quiet day label.
 *
 * All / Unread is a server filter (`unreadOnly`), not a client one: the list is
 * paged, and filtering twenty rows in the browser would show "no unread" with
 * forty more unread on page three.
 */

type Filter = "all" | "unread";

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
	weekday: "short",
	day: "numeric",
	month: "short",
});

const TIME_LABEL = new Intl.DateTimeFormat("en-IN", {
	hour: "numeric",
	minute: "2-digit",
});

interface DayGroup {
	key: string;
	label: string;
	today: boolean;
	items: NotificationItem[];
}

/** Today / Yesterday / "Mon, 12 Oct", in the order the rows arrive. */
function groupByDay(items: NotificationItem[]): DayGroup[] {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const today = start.getTime();
	const yesterday = today - 86_400_000;

	const groups: DayGroup[] = [];
	const index = new Map<string, number>();

	for (const item of items) {
		const date = new Date(item.createdAt);
		date.setHours(0, 0, 0, 0);
		const time = date.getTime();
		const key = String(time);
		const label =
			time === today
				? "Today"
				: time === yesterday
					? "Yesterday"
					: DAY_LABEL.format(date);

		const at = index.get(key);
		if (at === undefined) {
			index.set(key, groups.length);
			groups.push({ key, label, today: time === today, items: [item] });
		} else {
			groups[at]?.items.push(item);
		}
	}

	return groups;
}

function Notifications() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const role = useAuthStore((state) => state.role);
	const markRead = useMarkNotificationsRead();
	const [filter, setFilter] = useState<Filter>("all");
	const unreadOnly = filter === "unread";

	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.notifications({ limit: PAGE_SIZE, unreadOnly }),
		fetchPage: (page) =>
			notificationsApi.list({ page, limit: PAGE_SIZE, unreadOnly }),
	});
	const unread = first?.unreadCount ?? 0;
	const groups = useMemo(() => groupByDay(items), [items]);

	const open = (item: NotificationItem) => {
		if (!item.readAt) markRead.mutate({ ids: [item.id] });
		const destination = notificationDestination(item, role);
		if (destination) router.push(destination as never);
	};

	const header = (
		<View>
			<ScreenHeader
				back
				title="Notifications"
				{...(unread > 0 ? { subtitle: `${unread} unread` } : {})}
				action={
					unread > 0 ? (
						<Pressable
							onPress={() => markRead.mutate({})}
							accessibilityRole="button"
							accessibilityLabel="Mark all notifications as read"
							{...focusable}
							style={(state) => {
								const { pressed, hovered } = state as PressState;
								return {
									minHeight: 40,
									paddingHorizontal: spacing[3],
									justifyContent: "center",
									borderRadius: 999,
									backgroundColor: pressed
										? colors.background.overlay
										: hovered
											? colors.background.subtle
											: "transparent",
								};
							}}
						>
							<Caption weight="medium" color="secondary">
								Mark all read
							</Caption>
						</Pressable>
					) : undefined
				}
			/>
			<FilterChips
				label="Show notifications"
				options={[
					{ value: "all", label: "All" },
					{ value: "unread", label: "Unread", count: unread },
				]}
				value={filter}
				onChange={setFilter}
			/>
		</View>
	);

	return (
		<Screen>
			<PagedList
				query={query}
				items={groups}
				loadMore={loadMore}
				header={header}
				keyExtractor={(group) => group.key}
				empty={
					<EmptyState
						icon={Bell}
						title={unreadOnly ? "Nothing unread" : "You're all caught up"}
						description={
							unreadOnly
								? "Everything here has been read. Switch to All to see past notifications."
								: role === "organisation"
									? "New applicants, pledges, reviews and donations, and news about your verification and team, show up here."
									: "When an NGO reviews your application or pledge, or issues a certificate, it will show up here."
						}
					/>
				}
				renderItem={(group) => (
					<View style={{ paddingTop: spacing[2] }}>
						<SectionTitle>{group.label}</SectionTitle>
						<Surface padded={false} style={{ overflow: "hidden" }}>
							{group.items.map((item, index) => (
								<View key={item.id}>
									{index > 0 ? (
										<View
											style={{
												height: 1,
												marginLeft: spacing[4] + 7 + spacing[3],
												backgroundColor: colors.border.hairline,
											}}
										/>
									) : null}
									<NotificationRow
										item={item}
										today={group.today}
										hasDestination={!!notificationDestination(item, role)}
										onPress={() => open(item)}
									/>
								</View>
							))}
						</Surface>
					</View>
				)}
			/>
		</Screen>
	);
}

function NotificationRow({
	item,
	today,
	hasDestination,
	onPress,
}: {
	item: NotificationItem;
	today: boolean;
	hasDestination: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	// Under a "Today" heading "2 hours ago" is the useful figure; under a date
	// the heading already says the day, so the row says the time.
	const when = today
		? formatRelative(item.createdAt)
		: TIME_LABEL.format(new Date(item.createdAt));

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${item.title}${item.body ? `. ${item.body}` : ""}. ${when}${item.readAt ? "" : ". Unread"}`}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "flex-start",
					gap: spacing[3],
					paddingHorizontal: spacing[4],
					paddingVertical: spacing[3.5],
					backgroundColor: pressed
						? colors.background.overlay
						: hovered
							? colors.background.subtle
							: "transparent",
				};
			}}
		>
			{/* Unread dot lives in the gutter so titles share a left edge. */}
			<View style={{ width: 7, paddingTop: 9 }}>
				{!item.readAt ? (
					<View
						style={{
							width: 7,
							height: 7,
							borderRadius: 4,
							backgroundColor: colors.primary.main,
						}}
					/>
				) : null}
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Body weight={item.readAt ? "medium" : "bold"} numberOfLines={2}>
					{item.title}
				</Body>
				{item.body ? (
					<Caption
						color="secondary"
						numberOfLines={3}
						style={{ marginTop: spacing[0.5] }}
					>
						{item.body}
					</Caption>
				) : null}
				<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
					{when}
				</Caption>
			</View>
			{hasDestination ? (
				<View style={{ paddingTop: 3 }}>
					<ChevronRight
						size={16}
						strokeWidth={1.75}
						color={colors.text.quaternary as string}
					/>
				</View>
			) : null}
		</Pressable>
	);
}

export default withAppShell(Notifications);
