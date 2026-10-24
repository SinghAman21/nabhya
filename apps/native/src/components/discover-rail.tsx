import { useRouter } from "expo-router";
import { View } from "react-native";
import { Surface } from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label, Micro } from "@/components/ui/typography";
import { usePublicEvents } from "@/hooks/use-events";
import { useFeed } from "@/hooks/use-feed";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import type { FeedNeedItem } from "@/lib/types";
import { useFeedStore } from "@/store/feed-store";

/**
 * The second column on desktop Discover.
 *
 * Its job is to surface what the feed's current filter and scroll position hide -
 * so both sections are **server-filtered**, not a slice of the page already on
 * screen. The urgent rail reuses the feed's `urgent` + `kind=need` filter,
 * while upcoming events come from the public event list. Both follow the
 * feed's city scope.
 *
 * **Each section is one card, heading inside it** - the `Surface` recipe the
 * feed cards use, so the rail reads as part of the page rather than a column
 * of loose list rows. A row leads with what it is (the need, the event) and
 * puts the NGO in the muted line under it, with the one number that makes it
 * worth opening: how much is still needed, how many spots are left. It used to
 * be a title with the NGO's name alone underneath, which on a young platform
 * read as the same org name repeated down the column.
 *
 * Deliberately not here: "trending". There is no metric for it yet; inventing
 * it client-side would be a ranked list of nothing.
 */

const RAIL_LIMIT = 4;

export function DiscoverRail() {
	const { spacing } = useTheme();

	return (
		<View style={{ gap: spacing[4] }}>
			<UrgentNow />
			<HappeningSoon />
		</View>
	);
}

/* -------------------------------------------------------------------------- */

function RailCard({
	title,
	action,
	children,
}: {
	title: string;
	action?: { label: string; onPress: () => void };
	children: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();
	return (
		<Surface padded={false} style={{ paddingVertical: spacing[2] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					minHeight: 36,
					paddingHorizontal: spacing[4],
				}}
			>
				<Label weight="semibold" accessibilityRole="header">
					{title}
				</Label>
				{action && (
					<Pressable
						onPress={action.onPress}
						accessibilityRole="link"
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
			<View style={{ paddingHorizontal: spacing[1.5] }}>{children}</View>
		</Surface>
	);
}

function RailRow({
	title,
	meta,
	leading,
	trailing,
	onPress,
}: {
	title: string;
	meta: string;
	leading?: React.ReactNode;
	trailing?: React.ReactNode;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="link"
			accessibilityLabel={`${title}. ${meta}`}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					paddingHorizontal: spacing[2.5],
					paddingVertical: spacing[2.5],
					borderRadius: borderRadius.md,
					backgroundColor:
						pressed || hovered ? colors.background.subtle : "transparent",
				};
			}}
		>
			{leading}
			<View style={{ flex: 1, minWidth: 0, gap: 2 }}>
				<Label numberOfLines={2}>{title}</Label>
				<Caption color="tertiary" numberOfLines={1}>
					{meta}
				</Caption>
			</View>
			{trailing}
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */

/**
 * Exported alongside `DiscoverRail` so a caller can take one section without
 * the other. Both rails that exist today - the volunteer home's and the NGO
 * feed's - take the pair, and an NGO wants it for the same reason a volunteer
 * does: it is how you find out somebody two districts over needs the thing you
 * have a surplus of.
 */
export function UrgentNow() {
	const router = useRouter();
	const city = useFeedStore((s) => s.city);
	const query = useFeed(
		{ tab: "urgent", kind: "need", ...(city ? { city } : {}) },
		true,
	);
	const needs =
		query.data?.pages
			.flatMap((page) => page.items)
			.filter((item): item is FeedNeedItem => item.kind === "need")
			.slice(0, RAIL_LIMIT) ?? [];

	if (needs.length === 0) return null;

	return (
		<RailCard title="Urgent now">
			{needs.map((need) => {
				const { quantity, fulfilledQuantity, unit } = need.need;
				const left =
					quantity != null ? Math.max(0, quantity - fulfilledQuantity) : null;
				const meta = [
					need.organization?.organizationName,
					left != null && left > 0
						? `${left}${unit ? ` ${unit}` : ""} still needed`
						: need.city,
				]
					.filter(Boolean)
					.join(" · ");
				return (
					<RailRow
						key={need.id}
						title={need.title}
						meta={meta}
						leading={<UrgentDot />}
						onPress={() => router.push(`/needs/${need.id}`)}
					/>
				);
			})}
		</RailCard>
	);
}

/** The card's own urgency mark, so the rail and the feed say it the same way. */
function UrgentDot() {
	const { colors } = useTheme();
	return (
		<View style={{ width: 8, alignItems: "center", alignSelf: "flex-start" }}>
			<View
				style={{
					width: 6,
					height: 6,
					marginTop: 7,
					borderRadius: 999,
					backgroundColor: colors.error.main,
				}}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/**
 * Events in the rail rather than interleaved into the feed: two paginated
 * endpoints cannot be interleaved client-side without a merged cursor. Each
 * leads with its date, the way the feed's event card does.
 */
export function HappeningSoon() {
	const router = useRouter();
	const city = useFeedStore((s) => s.city);
	const query = usePublicEvents({
		when: "upcoming",
		limit: RAIL_LIMIT,
		...(city ? { city } : {}),
	});
	const events = query.data?.items ?? [];

	if (events.length === 0) return null;

	return (
		<RailCard
			title="Happening soon"
			action={{ label: "All events", onPress: () => router.push("/events") }}
		>
			{events.map((event) => {
				const spotsLeft = Math.max(
					0,
					event.volunteersNeeded - event.acceptedCount,
				);
				const start = new Date(event.startAt);
				return (
					<RailRow
						key={event.id}
						title={event.title}
						meta={[
							event.organization.organizationName,
							formatRelative(event.startAt),
						].join(" · ")}
						leading={
							Number.isNaN(start.getTime()) ? undefined : (
								<DateBlock
									day={start.getDate()}
									month={MONTHS[start.getMonth()] ?? ""}
								/>
							)
						}
						trailing={
							spotsLeft > 0 ? (
								<Caption color="tertiary">{`${spotsLeft} left`}</Caption>
							) : (
								<Caption color="quaternary">Full</Caption>
							)
						}
						onPress={() => router.push(`/events/${event.id}`)}
					/>
				);
			})}
		</RailCard>
	);
}

function DateBlock({ day, month }: { day: number; month: string }) {
	return (
		<View style={{ width: 32, alignItems: "center" }}>
			<Micro weight="semibold" color="tertiary">
				{month.toUpperCase()}
			</Micro>
			<Label weight="bold">{String(day)}</Label>
		</View>
	);
}
