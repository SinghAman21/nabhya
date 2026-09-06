import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
	BadgeCheck,
	Bookmark,
	CalendarDays,
	Heart,
	MapPin,
	Pin,
	Share2,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { Share, useWindowDimensions, View } from "react-native";
import { Surface } from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H5, Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { formatDateRange, formatProgress, formatRelative } from "@/lib/format";
import { splitPostText } from "@/lib/post-text";
import type {
	FeedEventItem,
	FeedItem,
	FeedNeedItem,
	FeedPostItem,
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
		organization: item.organization ?? {
			id: "",
			organizationName: "NGO",
			logo: null,
			city: null,
			state: null,
		},
		...item.need,
	};
}

export interface FeedCardActions {
	/** Opens the pledge sheet for a need. Events navigate to their own page. */
	onRespond: (item: FeedNeedItem) => void;
	onToggleFollow: (organizationId: string, following: boolean) => void;
	onToggleLike?: (item: FeedItem, liked: boolean) => void;
	onToggleSave?: (item: FeedItem, saved: boolean) => void;
}

/**
 * One post in the feed, whatever its kind.
 *
 * Every card reads the same way top to bottom — who, what kind of thing, what,
 * the facts that decide it, then one action — so the eye never has to relearn
 * the layout between a need, an event, an update and a plain post. Kind is
 * said in words on the eyebrow line, never by colour alone. The footer holds
 * the one primary action on the left and the light-touch reactions on the
 * right, in the order people expect from every other feed: like, save, share.
 */
export function FeedCard({
	item,
	onRespond,
	onToggleFollow,
	onToggleLike,
	onToggleSave,
}: { item: FeedItem } & FeedCardActions) {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [expanded, setExpanded] = useState(false);

	const org = item.organization;
	const closed = item.kind === "need" && item.need.status !== "OPEN";
	const headline =
		item.title || org?.organizationName || item.author?.fullName || "Post";

	const share = async () => {
		const path =
			item.kind === "event"
				? `/events/${item.id}`
				: org
					? `/ngos/${org.id}`
					: "/";
		try {
			await Share.share({
				message: `${headline}${org ? ` — ${org.organizationName}` : ""} on Nabhya\n${Linking.createURL(path)}`,
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
			case "story":
				return {
					label: expanded ? "Show less" : "Read more",
					disabled: false,
					onPress: () => setExpanded((v) => !v),
				};
			default:
				return org
					? {
							label: "View NGO",
							disabled: false,
							onPress: () => router.push(`/ngos/${org.id}`),
						}
					: null;
		}
	})();

	const liked = item.viewer?.liked ?? false;
	const saved = item.viewer?.saved ?? false;

	return (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<View style={{ padding: spacing[4], gap: spacing[3] }}>
				<PosterHeader
					item={item}
					onOpen={org ? () => router.push(`/ngos/${org.id}`) : undefined}
					onToggleFollow={
						org ? () => onToggleFollow(org.id, item.isFollowing) : undefined
					}
				/>

				{item.kind === "post" ? (
					<PostBody item={item} expanded={expanded} onExpand={setExpanded} />
				) : (
					<View style={{ gap: spacing[1] }}>
						<Eyebrow item={item} />
						<H5 numberOfLines={2}>{item.title}</H5>
						{item.description ? (
							<Caption
								color="tertiary"
								numberOfLines={
									item.kind === "story" ? (expanded ? undefined : 4) : 2
								}
							>
								{item.description}
							</Caption>
						) : null}
					</View>
				)}

				{item.kind === "need" && <NeedFacts item={item} />}
				{item.kind === "event" && <EventFacts item={item} />}
			</View>

			<View style={{ height: 1, backgroundColor: colors.border.hairline }} />

			<View
				style={{ flexDirection: "row", alignItems: "stretch", minHeight: 48 }}
			>
				{primary ? (
					<Pressable
						onPress={primary.onPress}
						disabled={primary.disabled}
						accessibilityRole="button"
						accessibilityState={{ disabled: primary.disabled }}
						accessibilityLabel={`${primary.label}: ${headline}`}
						style={({ pressed }) => ({
							flex: 1,
							alignItems: "center",
							justifyContent: "center",
							paddingVertical: spacing[3],
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
				) : (
					<View style={{ flex: 1 }} />
				)}
				<Reaction
					icon={Heart}
					active={liked}
					count={item.engagement.likes}
					label={liked ? "Unlike" : "Like"}
					activeColor={colors.error.main as string}
					onPress={onToggleLike ? () => onToggleLike(item, liked) : undefined}
				/>
				<Reaction
					icon={Bookmark}
					active={saved}
					label={saved ? "Unsave" : "Save"}
					activeColor={colors.text.primary as string}
					onPress={onToggleSave ? () => onToggleSave(item, saved) : undefined}
				/>
				<Reaction icon={Share2} label={`Share ${headline}`} onPress={share} />
			</View>
		</Surface>
	);
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Reaction({
	icon: Icon,
	active,
	count,
	label,
	activeColor,
	onPress,
}: {
	icon: typeof Heart;
	active?: boolean;
	count?: number;
	label: string;
	activeColor?: string;
	onPress?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const color = active
		? (activeColor ?? (colors.text.primary as string))
		: (colors.text.tertiary as string);
	return (
		<>
			<View style={{ width: 1, backgroundColor: colors.border.hairline }} />
			<Pressable
				onPress={onPress}
				disabled={!onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={
					active === undefined ? undefined : { selected: active }
				}
				hitSlop={4}
				style={({ pressed }) => ({
					minWidth: 52,
					paddingHorizontal: spacing[2.5],
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: spacing[1],
					backgroundColor: pressed
						? (colors.background.subtle as string)
						: "transparent",
				})}
			>
				<Icon
					size={18}
					color={color}
					strokeWidth={1.9}
					fill={active ? color : "transparent"}
				/>
				{count ? (
					<Caption weight="medium" color={active ? color : "tertiary"}>
						{count}
					</Caption>
				) : null}
			</Pressable>
		</>
	);
}

function PosterHeader({
	item,
	onOpen,
	onToggleFollow,
}: {
	item: FeedItem;
	onOpen?: () => void;
	onToggleFollow?: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const org = item.organization;
	const name = org?.organizationName ?? item.author?.fullName ?? "Volunteer";
	const place = item.city ?? item.state ?? "India";
	const initial = name.charAt(0).toUpperCase() || "N";

	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
		>
			<Pressable
				onPress={onOpen}
				disabled={!onOpen}
				accessibilityRole={onOpen ? "link" : undefined}
				accessibilityLabel={onOpen ? `Open ${name}` : name}
				hitSlop={4}
				style={{
					flex: 1,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2.5],
				}}
			>
				{org?.logo ? (
					<Image
						source={{ uri: org.logo }}
						style={{ width: 36, height: 36, borderRadius: borderRadius.sm }}
						contentFit="cover"
						accessibilityIgnoresInvertColors
					/>
				) : (
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: org ? borderRadius.sm : 18,
							backgroundColor: colors.background.subtle,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Label weight="bold">{initial}</Label>
					</View>
				)}
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
							{name}
						</Label>
						{org && (
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

			{onToggleFollow && org && (
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
						backgroundColor:
							item.isFollowing || pressed
								? (colors.background.subtle as string)
								: "transparent",
					})}
				>
					<Caption
						weight="medium"
						color={
							item.isFollowing ? "tertiary" : (colors.primary.ink as string)
						}
					>
						{item.isFollowing ? "Following" : "Follow"}
					</Caption>
				</Pressable>
			)}
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

/**
 * A plain post: the text, then up to four media tiles. One image gets the
 * full width at 4:3; two or more share a row of squares. Videos show a still
 * frame placeholder — playback is the detail page's job.
 */
function PostBody({
	item,
	expanded,
	onExpand,
}: {
	item: FeedPostItem;
	expanded: boolean;
	onExpand: (next: boolean) => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const { width } = useWindowDimensions();
	const post = item.post;
	const media = post.media.filter((m) => m.type === "IMAGE").slice(0, 4);
	const body = splitPostText(post.text);
	const long = post.text.length > 220;
	// Card width minus page gutters and card padding, capped for desktop.
	const inner = Math.min(width, 720) - spacing[5] * 2 - spacing[4] * 2;
	const gap = spacing[1.5];
	const tile = media.length > 1 ? (inner - gap) / 2 : inner;

	return (
		<View style={{ gap: spacing[3] }}>
			{body.title ? <H5 numberOfLines={2}>{body.title}</H5> : null}
			{body.description ? (
				<Body numberOfLines={expanded ? undefined : 6}>{body.description}</Body>
			) : null}
			{long && (
				<Pressable
					onPress={() => onExpand(!expanded)}
					accessibilityRole="button"
					hitSlop={6}
					style={{ alignSelf: "flex-start" }}
				>
					<Caption weight="medium" color={colors.primary.ink as string}>
						{expanded ? "Show less" : "Read more"}
					</Caption>
				</Pressable>
			)}
			{media.length > 0 && (
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
					{media.map((m) => (
						<Image
							key={m.id}
							source={{ uri: m.url }}
							contentFit="cover"
							transition={150}
							accessibilityIgnoresInvertColors
							style={{
								width: tile,
								height: media.length === 1 ? tile * 0.75 : tile,
								borderRadius: borderRadius.md,
								backgroundColor: colors.background.subtle,
							}}
						/>
					))}
				</View>
			)}
		</View>
	);
}

function NeedFacts({ item }: { item: FeedNeedItem }) {
	const { colors, spacing } = useTheme();
	const [now] = useState(() => Date.now());
	const { need } = item;

	const target = need.quantity ?? 0;
	const done = need.fulfilledQuantity ?? 0;
	const ratio = target > 0 ? Math.min(1, done / target) : 0;
	const remaining = Math.max(0, target - done);

	const expiresAt = need.expiresAt ? new Date(need.expiresAt) : null;
	const msLeft = expiresAt ? expiresAt.getTime() - now : null;
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
				{item.isUrgent && remaining > 0 && (
					<Caption color={colors.warning.ink}>Starts soon</Caption>
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
