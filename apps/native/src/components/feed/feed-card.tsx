import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
	BadgeCheck,
	CalendarDays,
	MapPin,
	Pin,
	Share2,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { Share, View } from "react-native";
import { Surface } from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { formatDateRange, formatProgress, formatRelative } from "@/lib/format";
import type {
	FeedEventItem,
	FeedItem,
	FeedNeedItem,
	PublicNeed,
} from "@/lib/types";

const DAY_MS = 86_400_000;

/** The pledge sheet takes a `PublicNeed`; a feed row carries the same facts. */
export function toPublicNeed(item: FeedNeedItem): PublicNeed {
	return {
		id: item.id,
		title: item.title,
		description: item.description,
		city: item.city,
		state: item.state,
		createdAt: item.postedAt,
		organization: item.organization,
		...item.need,
	};
}

/**
 * One post in the feed, whatever its kind.
 *
 * Every card reads the same way top to bottom — who, what kind of thing, what,
 * the facts that decide it, then one action — so the eye never has to relearn
 * the layout between a need, an event and an update. Kind is said in words on
 * the eyebrow line, never by colour alone.
 */
export function FeedCard({
	item,
	onRespond,
	onToggleFollow,
}: {
	item: FeedItem;
	/** Opens the pledge sheet for a need. Events navigate to their own page. */
	onRespond: (item: FeedNeedItem) => void;
	onToggleFollow: (organizationId: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [expanded, setExpanded] = useState(false);

	const org = item.organization;
	const closed = item.kind === "need" && item.need.status !== "OPEN";

	const share = async () => {
		const path =
			item.kind === "event" ? `/events/${item.id}` : `/ngos/${org.id}`;
		try {
			await Share.share({
				message: `${item.title} — ${org.organizationName} on Nabhya\n${Linking.createURL(path)}`,
			});
		} catch {
			// Web without the share API, or the user dismissed the sheet.
		}
	};

	const primary = (() => {
		switch (item.kind) {
			case "need":
				return {
					label: closed
						? "Closed"
						: item.need.type === "WANT"
							? "I can help"
							: "Claim this",
					disabled: closed,
					onPress: () => onRespond(item),
				};
			case "event":
				return {
					label: "View & apply",
					disabled: false,
					onPress: () => router.push(`/events/${item.id}`),
				};
			default:
				return {
					label: expanded ? "Show less" : "Read more",
					disabled: false,
					onPress: () => setExpanded((v) => !v),
				};
		}
	})();

	return (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<View style={{ padding: spacing[4], gap: spacing[3] }}>
				<OrgHeader
					item={item}
					onOpen={() => router.push(`/ngos/${org.id}`)}
					onToggleFollow={() => onToggleFollow(org.id)}
				/>

				<View style={{ gap: spacing[1] }}>
					<Eyebrow item={item} />
					<H5 numberOfLines={2}>{item.title}</H5>
					<Caption
						color="tertiary"
						numberOfLines={
							item.kind === "story" ? (expanded ? undefined : 4) : 2
						}
					>
						{item.description}
					</Caption>
				</View>

				{item.kind === "need" && <NeedFacts item={item} />}
				{item.kind === "event" && <EventFacts item={item} />}
			</View>

			<View style={{ height: 1, backgroundColor: colors.border.hairline }} />

			<View style={{ flexDirection: "row", alignItems: "stretch" }}>
				<Pressable
					onPress={primary.onPress}
					disabled={primary.disabled}
					accessibilityRole="button"
					accessibilityState={{ disabled: primary.disabled }}
					accessibilityLabel={`${primary.label}: ${item.title}`}
					style={({ pressed }) => ({
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
						paddingVertical: spacing[3.5],
						opacity: primary.disabled ? 0.45 : 1,
						backgroundColor: pressed
							? (colors.background.subtle as string)
							: "transparent",
					})}
				>
					<Label weight="semibold" color={colors.primary.ink}>
						{primary.label}
					</Label>
				</Pressable>
				<View style={{ width: 1, backgroundColor: colors.border.hairline }} />
				<Pressable
					onPress={share}
					accessibilityRole="button"
					accessibilityLabel={`Share ${item.title}`}
					hitSlop={6}
					style={({ pressed }) => ({
						width: 56,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: pressed
							? (colors.background.subtle as string)
							: "transparent",
					})}
				>
					<Share2
						size={18}
						color={colors.text.tertiary as string}
						strokeWidth={1.9}
					/>
				</Pressable>
			</View>
		</Surface>
	);
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function OrgHeader({
	item,
	onOpen,
	onToggleFollow,
}: {
	item: FeedItem;
	onOpen: () => void;
	onToggleFollow: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const org = item.organization;
	const verified = org.verificationStatus === "VERIFIED";
	const place = item.city ?? org.city ?? item.state ?? "India";
	const initial = org.organizationName?.charAt(0).toUpperCase() ?? "N";

	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
		>
			<Pressable
				onPress={onOpen}
				accessibilityRole="link"
				accessibilityLabel={`Open ${org.organizationName}`}
				hitSlop={4}
				style={{
					flex: 1,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2.5],
				}}
			>
				<View
					style={{
						width: 36,
						height: 36,
						borderRadius: borderRadius.sm,
						backgroundColor: colors.background.subtle,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Label weight="bold">{initial}</Label>
				</View>
				<View style={{ flex: 1 }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1],
						}}
					>
						<Label
							weight="semibold"
							numberOfLines={1}
							style={{ flexShrink: 1 }}
						>
							{org.organizationName}
						</Label>
						{verified && (
							<BadgeCheck
								size={15}
								color={colors.info.ink}
								strokeWidth={2.2}
								accessibilityLabel="Verified NGO"
							/>
						)}
					</View>
					<Caption color="quaternary" numberOfLines={1}>
						{place} · {formatRelative(item.postedAt)}
					</Caption>
				</View>
			</Pressable>

			<Pressable
				onPress={onToggleFollow}
				accessibilityRole="button"
				accessibilityState={{ selected: item.isFollowing }}
				accessibilityLabel={
					item.isFollowing
						? `Unfollow ${org.organizationName}`
						: `Follow ${org.organizationName}`
				}
				hitSlop={8}
				style={({ pressed }) => ({
					minHeight: 30,
					justifyContent: "center",
					paddingHorizontal: spacing[3],
					borderRadius: 999,
					borderWidth: 1,
					borderColor: item.isFollowing
						? "transparent"
						: (colors.border.medium as string),
					backgroundColor: item.isFollowing
						? (colors.background.subtle as string)
						: pressed
							? (colors.background.subtle as string)
							: "transparent",
				})}
			>
				<Caption
					weight="medium"
					color={item.isFollowing ? "tertiary" : (colors.primary.ink as string)}
				>
					{item.isFollowing ? "Following" : "Follow"}
				</Caption>
			</Pressable>
		</View>
	);
}

/** Says what kind of post this is, in words. */
function Eyebrow({ item }: { item: FeedItem }) {
	const { colors, spacing } = useTheme();

	const text =
		item.kind === "need"
			? item.need.type === "WANT"
				? "Needs items"
				: "Giving away"
			: item.kind === "event"
				? "Volunteer event"
				: "Update";

	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
		>
			<Caption weight="medium" color="secondary">
				{text}
			</Caption>
			{item.isUrgent && <StatusPill label="Urgent" tone="error" />}
			{item.kind === "story" && item.story.isPinned && (
				<Pin size={12} color={colors.text.quaternary as string} />
			)}
		</View>
	);
}

function NeedFacts({ item }: { item: FeedNeedItem }) {
	const { colors, spacing } = useTheme();
	const { need } = item;

	const target = need.quantity ?? 0;
	const done = need.fulfilledQuantity ?? 0;
	const ratio = target > 0 ? Math.min(1, done / target) : 0;
	const remaining = Math.max(0, target - done);

	const expiresAt = need.expiresAt ? new Date(need.expiresAt) : null;
	const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : null;
	const closingSoon = msLeft !== null && msLeft > 0 && msLeft < 3 * DAY_MS;

	if (target === 0 && !expiresAt) return null;

	return (
		<View style={{ gap: spacing[2] }}>
			{target > 0 && (
				<>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: spacing[2],
						}}
					>
						<Caption weight="medium">
							{formatProgress(done, need.quantity, need.unit)}
						</Caption>
						<Caption color="quaternary">
							{ratio >= 1
								? "Complete"
								: `${remaining} ${need.unit ?? "more"} to go`}
						</Caption>
					</View>
					<View
						style={{
							height: 4,
							borderRadius: 999,
							backgroundColor: colors.background.subtle,
							overflow: "hidden",
						}}
					>
						<View
							style={{
								width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
								height: "100%",
								borderRadius: 999,
								backgroundColor:
									ratio >= 1
										? (colors.success.main as string)
										: (colors.primary.main as string),
							}}
						/>
					</View>
				</>
			)}
			{expiresAt && (
				<Caption color={closingSoon ? colors.warning.ink : "quaternary"}>
					{msLeft !== null && msLeft <= 0
						? "Closed"
						: `Closes ${formatRelative(need.expiresAt)}`}
				</Caption>
			)}
		</View>
	);
}

function EventFacts({ item }: { item: FeedEventItem }) {
	const { colors, spacing } = useTheme();
	const { event } = item;
	const remaining = Math.max(0, event.volunteersNeeded - event.acceptedCount);
	const place = event.venue ?? item.city;

	return (
		<View style={{ gap: spacing[1.5] }}>
			<Fact icon={CalendarDays}>
				{formatDateRange(event.startAt, event.endAt)}
			</Fact>
			{place && <Fact icon={MapPin}>{place}</Fact>}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[2],
				}}
			>
				<Fact icon={Users}>
					{remaining > 0
						? `${remaining} of ${event.volunteersNeeded} spots left`
						: "All spots filled"}
				</Fact>
				{event.applicationDeadline && remaining > 0 && (
					<Caption color={item.isUrgent ? colors.warning.ink : "quaternary"}>
						Apply {formatRelative(event.applicationDeadline)}
					</Caption>
				)}
			</View>
		</View>
	);
}

function Fact({
	icon: Icon,
	children,
}: {
	icon: typeof MapPin;
	children: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[1.5] }}
		>
			<Icon
				size={13}
				color={colors.text.quaternary as string}
				strokeWidth={2}
			/>
			<Caption color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
				{children}
			</Caption>
		</View>
	);
}
