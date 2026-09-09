import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
	BadgeCheck,
	Bookmark,
	CalendarDays,
	Clock,
	Heart,
	MapPin,
	MessageCircle,
	MoreHorizontal,
	Pin,
	Share2,
	Users,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
	Animated,
	Easing,
	Share,
	useWindowDimensions,
	View,
} from "react-native";
import { FeedCommentsSheet } from "@/components/feed/feed-comments-sheet";
import {
	FeedMediaCarousel,
	FeedMediaViewer,
	type MediaViewerActions,
} from "@/components/feed/feed-media";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H5, Label } from "@/components/ui/typography";
import { useRecordFeedInteraction } from "@/hooks/use-feed";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
import { useTheme } from "@/hooks/use-theme";
import { formatDateRange, formatRelative } from "@/lib/format";
import { splitPostText } from "@/lib/post-text";
import type {
	FeedEventItem,
	FeedItem,
	FeedMedia,
	FeedNeedItem,
	FeedPostItem,
	PublicNeed,
} from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

const DAY_MS = 86_400_000;

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
	onRespond: (item: FeedNeedItem) => void;
	onToggleFollow: (organizationId: string, following: boolean) => void;
	onToggleLike?: (item: FeedItem, liked: boolean) => void;
	onToggleSave?: (item: FeedItem, saved: boolean) => void;
	/**
	 * Supplied only where the viewer authored the row — the NGO feed passes it
	 * for that org's own posts. Present means an overflow control is drawn in
	 * the header; absent means the card has no owner affordances at all, which
	 * is every volunteer's view of it.
	 */
	onDelete?: (item: FeedItem) => void;
}

export function FeedCard({
	item,
	onRespond,
	onToggleFollow,
	onToggleLike,
	onToggleSave,
	onDelete,
}: { item: FeedItem } & FeedCardActions) {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();
	const { width } = useWindowDimensions();
	const compactActions = width < 380;
	const [expanded, setExpanded] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const email = useAuthStore((s) => s.email);
	const recordShare = useRecordFeedInteraction("share");

	const org = item.organization;
	const closed = item.kind === "need" && item.need.status !== "OPEN";
	const headline =
		item.title || org?.organizationName || item.author?.fullName || "Post";
	const liked = item.viewer?.liked ?? false;
	const saved = item.viewer?.saved ?? false;

	// One fullscreen viewer per card, shared by post media and cover images.
	// It lives here (not in the carousel) so "comment" can dismiss the modal
	// first — a sheet opened underneath a modal would never be seen.
	const [viewer, setViewer] = useState<{
		media: FeedMedia[];
		index: number;
	} | null>(null);

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
			if (email) recordShare.mutate({ item });
		} catch {
			/* user dismissed or web without Share API */
		}
	};

	const primary: {
		label: string;
		disabled: boolean;
		onPress: () => void;
		tone: "neutral" | "primary" | "success" | "secondary";
	} | null = (() => {
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
					tone: closed
						? "neutral"
						: item.need.type === "WANT"
							? "primary"
							: "success",
				};
			case "event":
				return {
					label: "View & apply",
					disabled: false,
					onPress: () => router.push(`/events/${item.id}`),
					tone: "primary",
				};
			case "story":
				return {
					label: expanded ? "Show less" : "Read more",
					disabled: false,
					onPress: () => setExpanded((v) => !v),
					tone: "secondary",
				};
			default:
				return org
					? {
							label: "View NGO",
							disabled: false,
							onPress: () => router.push(`/ngos/${org.id}`),
							tone: "secondary",
						}
					: null;
		}
	})();

	const shadow = {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 3,
	};

	const mediaActions: MediaViewerActions = {
		headline,
		liked,
		saved,
		likeCount: item.engagement.likes,
		commentCount: item.engagement.comments,
		...(onToggleLike ? { onToggleLike: () => onToggleLike(item, liked) } : {}),
		...(onToggleSave ? { onToggleSave: () => onToggleSave(item, saved) } : {}),
		onComment: () => {
			setViewer(null);
			setCommentsOpen(true);
		},
		onShare: share,
	};
	const openViewer = (media: FeedMedia[], index: number) =>
		setViewer({ media, index });

	// Tile content width for media pages: card minus its outer margins and
	// inner padding. PostBody reuses the same number.
	const mediaWidth = Math.min(width, 720) - spacing[4] * 2 - spacing[3] * 2;

	const coverUrl =
		item.kind === "event"
			? item.event.coverImage
			: item.kind === "story"
				? item.story.coverImage
				: item.kind === "need"
					? item.need.coverImage
					: null;
	const coverMedia: FeedMedia[] = coverUrl
		? [{ id: `${item.id}-cover`, type: "IMAGE", url: coverUrl, sortOrder: 0 }]
		: [];

	return (
		<>
			<View
				style={{
					backgroundColor: colors.background.card,
					borderRadius: borderRadius["2xl"],
					marginHorizontal: spacing[3],
					marginVertical: spacing[2],
					overflow: "hidden",
					...shadow,
				}}
			>
				{/* HEADER — the follow button only exists until you follow;
				    after that there is nothing to do here. */}
				<PosterHeader
					item={item}
					onOpen={org ? () => router.push(`/ngos/${org.id}`) : undefined}
					onToggleFollow={
						org && !item.isFollowing
							? () => onToggleFollow(org.id, false)
							: undefined
					}
					{...(onDelete ? { onDelete: () => onDelete(item) } : {})}
				/>

				{/* CONTENT */}
				<View
					style={{
						paddingHorizontal: spacing[4],
						paddingBottom: spacing[3],
						gap: spacing[3],
					}}
				>
					{/* Kind pill + Urgent / Pinned */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
							flexWrap: "wrap",
						}}
					>
						<KindPill
							kind={item.kind}
							needType={item.kind === "need" ? item.need.type : undefined}
						/>
						{item.isUrgent && <UrgentPill />}
						{item.kind === "story" && item.story.isPinned && (
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[1],
								}}
							>
								<Pin size={12} color={colors.text.quaternary as string} />
								<Caption color="quaternary" weight="medium">
									Pinned
								</Caption>
							</View>
						)}
					</View>

					{/* Title */}
					{item.title ? (
						<H5 numberOfLines={2} style={{ lineHeight: 24 }}>
							{item.title}
						</H5>
					) : null}

					{/* Body */}
					{item.kind === "post" ? (
						<PostBody
							item={item}
							expanded={expanded}
							onExpand={setExpanded}
							pageWidth={mediaWidth}
							onOpenViewer={(index) =>
								item.kind === "post" && openViewer(item.post.media, index)
							}
						/>
					) : item.description ? (
						<Body
							color="secondary"
							numberOfLines={
								item.kind === "story" ? (expanded ? undefined : 4) : 3
							}
						>
							{item.description}
						</Body>
					) : null}
					{item.kind === "story" &&
						item.description &&
						item.description.length > 180 &&
						!expanded && (
							<Pressable
								onPress={() => setExpanded(true)}
								hitSlop={6}
								style={{
									alignSelf: "flex-start",
									marginTop: -spacing[1],
								}}
							>
								<Caption weight="semibold" color={colors.primary.ink as string}>
									Read more
								</Caption>
							</Pressable>
						)}

					{/* Need / Event facts */}
					{item.kind === "need" && <NeedFacts item={item} />}
					{item.kind === "event" && <EventFacts item={item} />}

					{/* Cover media — same carousel + viewer as post media. */}
					{coverMedia.length > 0 && (
						<FeedMediaCarousel
							media={coverMedia}
							pageWidth={mediaWidth}
							onOpenViewer={(index) => openViewer(coverMedia, index)}
						/>
					)}
				</View>

				{/* PRIMARY CTA */}
				{primary && (
					<View
						style={{
							paddingHorizontal: spacing[4],
							paddingBottom: spacing[3],
						}}
					>
						<PrimaryButton {...primary} />
					</View>
				)}

				{/* DIVIDER */}
				<View
					style={{
						height: 1,
						backgroundColor: colors.border.hairline,
						marginHorizontal: spacing[4],
					}}
				/>

				{/* REACTION BAR */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingVertical: spacing[2],
						paddingHorizontal: spacing[3],
					}}
				>
					<View
						style={{
							flex: 1,
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1],
						}}
					>
						<AnimatedReaction
							icon={Heart}
							active={liked}
							count={item.engagement.likes}
							label={liked ? "Unlike" : "Like"}
							activeColor={colors.error.main as string}
							compact={compactActions}
							onPress={
								onToggleLike ? () => onToggleLike(item, liked) : undefined
							}
						/>
						<ReactionDivider />
						<Reaction
							icon={MessageCircle}
							count={item.engagement.comments}
							label={`Comments on ${headline}`}
							compact={compactActions}
							onPress={() => setCommentsOpen(true)}
						/>
						<ReactionDivider />
						<Reaction
							icon={Bookmark}
							active={saved}
							label={saved ? "Unsave" : "Save"}
							activeColor={colors.text.primary as string}
							compact={compactActions}
							onPress={
								onToggleSave ? () => onToggleSave(item, saved) : undefined
							}
						/>
						<ReactionDivider />
						<Reaction
							icon={Share2}
							label={`Share ${headline}`}
							compact={compactActions}
							onPress={share}
						/>
					</View>
				</View>
			</View>
			{viewer && (
				<FeedMediaViewer
					visible
					media={viewer.media}
					initialIndex={viewer.index}
					actions={mediaActions}
					onClose={() => setViewer(null)}
				/>
			)}
			{commentsOpen && (
				<FeedCommentsSheet item={item} onClose={() => setCommentsOpen(false)} />
			)}
		</>
	);
}

/* ────────────────────────────────────────────────────────────────────────────
   PIECES
   ──────────────────────────────────────────────────────────────────────────── */

export function KindPill({
	kind,
	needType,
}: {
	kind: FeedItem["kind"];
	needType?: "WANT" | "OFFER";
}) {
	const { colors, spacing } = useTheme();
	/*
	 * Every tone comes from the token scales. These four pills were hardcoded
	 * light-mode hexes, so on a dark card they drew as bright white-tinted
	 * blocks — and each `textColor` was a `main`-grade colour on its own tint,
	 * which is the combination the colour rules single out as unreadable. `bg`
	 * plus `ink` is the pair that is contrast-checked in both schemes.
	 */
	const config = {
		need: {
			text: needType === "WANT" ? "Needs items" : "Giving away",
			bg: (needType === "WANT" ? colors.error.bg : colors.success.bg) as string,
			textColor: (needType === "WANT"
				? colors.error.ink
				: colors.success.ink) as string,
		},
		event: {
			text: "Volunteer event",
			bg: colors.info.bg as string,
			textColor: colors.info.ink as string,
		},
		story: {
			text: "Story",
			bg: colors.accent.bg as string,
			textColor: colors.accent.ink as string,
		},
		post: {
			text: "Update",
			bg: colors.background.subtle as string,
			textColor: colors.text.secondary as string,
		},
	};
	const c = config[kind];
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[1],
				paddingHorizontal: spacing[2.5],
				paddingVertical: spacing[1],
				borderRadius: 999,
				backgroundColor: c.bg,
			}}
		>
			<View
				style={{
					width: 6,
					height: 6,
					borderRadius: 3,
					backgroundColor: c.textColor,
				}}
			/>
			<Caption weight="semibold" style={{ color: c.textColor, fontSize: 11 }}>
				{c.text}
			</Caption>
		</View>
	);
}

export function UrgentPill() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[1],
				paddingHorizontal: spacing[2.5],
				paddingVertical: spacing[1],
				borderRadius: 999,
				backgroundColor: colors.error.bg as string,
			}}
		>
			{/* The dot is the one place `main` is right: it is a fill. The word
			    beside it is type, so it takes `ink`. */}
			<View
				style={{
					width: 6,
					height: 6,
					borderRadius: 3,
					backgroundColor: colors.error.main as string,
				}}
			/>
			<Caption
				weight="semibold"
				style={{ color: colors.error.ink as string, fontSize: 11 }}
			>
				Urgent
			</Caption>
		</View>
	);
}

function PrimaryButton({
	label,
	disabled,
	onPress,
	tone,
}: {
	label: string;
	disabled: boolean;
	onPress: () => void;
	tone: "primary" | "success" | "secondary" | "neutral";
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const bg = disabled
		? (colors.background.subtle as string)
		: tone === "primary"
			? (colors.primary.main as string)
			: tone === "success"
				? (colors.success.main as string)
				: tone === "secondary"
					? (colors.background.subtle as string)
					: (colors.background.subtle as string);
	const text = disabled
		? (colors.text.tertiary as string)
		: tone === "primary" || tone === "success"
			? "#FFFFFF"
			: (colors.primary.ink as string);

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			accessibilityLabel={`${label}: ${label}`}
			style={({ pressed }) => ({
				alignItems: "center",
				justifyContent: "center",
				paddingVertical: spacing[3],
				borderRadius: borderRadius.lg,
				backgroundColor:
					pressed && !disabled
						? tone === "primary" || tone === "success"
							? (colors.primary.ink as string)
							: (colors.background.tertiary as string)
						: bg,
				opacity: disabled ? 0.5 : 1,
			})}
		>
			<Label weight="semibold" style={{ color: text }}>
				{label}
			</Label>
		</Pressable>
	);
}

/** Like button with a spring-scale animation when toggled. */
function AnimatedReaction({
	icon: Icon,
	active,
	count,
	label,
	activeColor,
	onPress,
	compact = false,
}: {
	icon: typeof Heart;
	active?: boolean;
	count?: number;
	label: string;
	activeColor?: string;
	onPress?: () => void;
	compact?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const scale = useRef(new Animated.Value(1)).current;
	const color = active
		? (activeColor ?? (colors.text.primary as string))
		: (colors.text.tertiary as string);

	const trigger = () => {
		if (!onPress) return;
		onPress();
		Animated.sequence([
			Animated.timing(scale, {
				toValue: 1.35,
				duration: 120,
				easing: Easing.out(Easing.ease),
				useNativeDriver: true,
			}),
			Animated.timing(scale, {
				toValue: 1,
				duration: 180,
				easing: Easing.elastic(1.2),
				useNativeDriver: true,
			}),
		]).start();
	};

	return (
		<Pressable
			onPress={trigger}
			disabled={!onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={
				active === undefined ? undefined : { selected: active }
			}
			hitSlop={6}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: spacing[1],
				paddingHorizontal: compact ? spacing[2] : spacing[3],
				paddingVertical: spacing[2],
				borderRadius: borderRadius.md,
				backgroundColor: pressed
					? (colors.background.subtle as string)
					: "transparent",
				minWidth: compact ? 52 : 64,
			})}
		>
			<Animated.View style={{ transform: [{ scale }] }}>
				<Icon
					size={20}
					color={color}
					strokeWidth={1.8}
					fill={active ? color : "transparent"}
				/>
			</Animated.View>
			{count !== undefined && count > 0 ? (
				<Caption weight="semibold" color={active ? color : "tertiary"}>
					{compact && count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
				</Caption>
			) : null}
		</Pressable>
	);
}

function Reaction({
	icon: Icon,
	active,
	count,
	label,
	activeColor,
	onPress,
	compact = false,
}: {
	icon: typeof Heart;
	active?: boolean;
	count?: number;
	label: string;
	activeColor?: string;
	onPress?: () => void;
	compact?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const color = active
		? (activeColor ?? (colors.text.primary as string))
		: (colors.text.tertiary as string);

	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={
				active === undefined ? undefined : { selected: active }
			}
			hitSlop={6}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: spacing[1],
				paddingHorizontal: compact ? spacing[2] : spacing[3],
				paddingVertical: spacing[2],
				borderRadius: borderRadius.md,
				backgroundColor: pressed
					? (colors.background.subtle as string)
					: "transparent",
				minWidth: compact ? 52 : 64,
			})}
		>
			<Icon
				size={20}
				color={color}
				strokeWidth={1.8}
				fill={active ? color : "transparent"}
			/>
			{count !== undefined && count > 0 ? (
				<Caption weight="semibold" color={active ? color : "tertiary"}>
					{compact && count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
				</Caption>
			) : null}
		</Pressable>
	);
}

function ReactionDivider() {
	const { colors } = useTheme();
	return (
		<View
			style={{
				width: 1,
				height: 20,
				backgroundColor: colors.border.hairline,
				marginHorizontal: 2,
			}}
		/>
	);
}

/* ── Header ── */
function PosterHeader({
	item,
	onOpen,
	onToggleFollow,
	onDelete,
}: {
	item: FeedItem;
	onOpen?: () => void;
	onToggleFollow?: () => void;
	/** Owner-only. Confirmation is the caller's job, not the header's. */
	onDelete?: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const org = item.organization;
	const name = org?.organizationName ?? item.author?.fullName ?? "Volunteer";
	const place = item.city ?? item.state ?? "India";
	const initial = name.charAt(0).toUpperCase() || "N";
	const avatarSize = 40;
	// `logo` and `profileImage` are private storage **keys**, not URLs — passing
	// one to `<Image>` renders nothing, which is why every card drew an initial
	// even for an NGO that had uploaded a logo. Onboarding now collects one, so
	// this had to start resolving them.
	const avatarUrl = useStoredImageUrl(
		org?.logo ?? item.author?.profileImage ?? null,
	);

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				padding: spacing[4],
				paddingBottom: spacing[2],
			}}
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
					gap: spacing[3],
				}}
			>
				{/* Avatar with optional verified badge */}
				<View>
					{avatarUrl ? (
						<Image
							source={{ uri: avatarUrl }}
							style={{
								width: avatarSize,
								height: avatarSize,
								borderRadius: org ? borderRadius.md : avatarSize / 2,
							}}
							contentFit="cover"
							accessibilityIgnoresInvertColors
						/>
					) : (
						<View
							style={{
								width: avatarSize,
								height: avatarSize,
								borderRadius: org ? borderRadius.md : avatarSize / 2,
								backgroundColor: colors.background.subtle,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Label weight="bold" style={{ fontSize: 16 }}>
								{initial}
							</Label>
						</View>
					)}
					{org && (
						<View
							style={{
								position: "absolute",
								bottom: -2,
								right: -2,
								backgroundColor: colors.background.card,
								borderRadius: 999,
								padding: 1,
							}}
						>
							<BadgeCheck
								size={14}
								color={colors.info.main as string}
								strokeWidth={2.5}
							/>
						</View>
					)}
				</View>

				{/* Name + meta */}
				<View style={{ flex: 1, justifyContent: "center" }}>
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
							style={{ flexShrink: 1, fontSize: 15 }}
						>
							{name}
						</Label>
					</View>
					<Caption
						color="quaternary"
						numberOfLines={1}
						style={{ marginTop: 1 }}
					>
						{place} · {formatRelative(item.postedAt)}
					</Caption>
				</View>
			</Pressable>

			{/* Rendered only while not following (the card hides it after).
		    Unfollow lives on the NGO page, not in the feed. */}
			{onToggleFollow && org && !item.isFollowing && (
				<Pressable
					onPress={onToggleFollow}
					accessibilityRole="button"
					accessibilityLabel={`Follow ${org.organizationName}`}
					hitSlop={8}
					style={({ pressed }) => ({
						paddingHorizontal: spacing[3.5],
						paddingVertical: spacing[1.5],
						borderRadius: 999,
						backgroundColor: pressed
							? (colors.primary.ink as string)
							: (colors.primary.main as string),
					})}
				>
					<Caption
						weight="semibold"
						style={{
							color: "#FFFFFF",
							fontSize: 12,
						}}
					>
						Follow
					</Caption>
				</Pressable>
			)}

			{/* Owner controls. Drawn only when the caller supplied a handler, so a
			    volunteer's feed keeps a header with nothing to press. */}
			{onDelete && (
				<Pressable
					onPress={onDelete}
					accessibilityRole="button"
					accessibilityLabel="Post options"
					hitSlop={8}
					style={({ pressed }) => ({
						width: 32,
						height: 32,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: pressed
							? (colors.background.subtle as string)
							: "transparent",
					})}
				>
					<MoreHorizontal
						size={18}
						color={colors.text.tertiary as string}
						strokeWidth={2}
					/>
				</Pressable>
			)}
		</View>
	);
}
/* ── Post body (text + media carousel) ── */
function PostBody({
	item,
	expanded,
	onExpand,
	pageWidth,
	onOpenViewer,
}: {
	item: FeedPostItem;
	expanded: boolean;
	onExpand: (next: boolean) => void;
	pageWidth: number;
	onOpenViewer: (index: number) => void;
}) {
	const { colors, spacing } = useTheme();
	const post = item.post;
	const body = splitPostText(post.text);
	const long = post.text.length > 220;

	return (
		<View style={{ gap: spacing[2] }}>
			{body.title ? <H5 numberOfLines={2}>{body.title}</H5> : null}
			{body.description ? (
				<Body color="secondary" numberOfLines={expanded ? undefined : 5}>
					{body.description}
				</Body>
			) : null}
			{long && (
				<Pressable
					onPress={() => onExpand(!expanded)}
					accessibilityRole="button"
					hitSlop={6}
					style={{ alignSelf: "flex-start" }}
				>
					<Caption weight="semibold" color={colors.primary.ink as string}>
						{expanded ? "Show less" : "Read more"}
					</Caption>
				</Pressable>
			)}
			{post.media.length > 0 && (
				<FeedMediaCarousel
					media={post.media}
					pageWidth={pageWidth}
					onOpenViewer={onOpenViewer}
				/>
			)}
		</View>
	);
}

/* ── Need facts ── */
export function NeedFacts({ item }: { item: FeedNeedItem }) {
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
		<View style={{ gap: spacing[2.5], marginTop: spacing[1] }}>
			{target > 0 && (
				<View style={{ gap: spacing[2] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: spacing[2],
						}}
					>
						<View
							style={{
								flexDirection: "row",
								alignItems: "baseline",
								gap: spacing[1],
							}}
						>
							<Label weight="bold" style={{ fontSize: 18 }}>
								{done}
							</Label>
							<Caption color="secondary" weight="medium">
								{" "}
								/ {target} {need.unit}
							</Caption>
						</View>
						<Caption
							weight="semibold"
							color={
								ratio >= 1 ? "success" : closingSoon ? "warning" : "tertiary"
							}
						>
							{ratio >= 1 ? "Complete ✓" : `${remaining} ${need.unit} to go`}
						</Caption>
					</View>

					{/* Progress track */}
					<View
						style={{
							height: 6,
							borderRadius: 999,
							backgroundColor: colors.background.subtle,
							overflow: "hidden",
						}}
					>
						<View
							style={{
								width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%`,
								height: "100%",
								borderRadius: 999,
								backgroundColor:
									ratio >= 1
										? (colors.success.main as string)
										: closingSoon
											? (colors.warning.main as string)
											: (colors.primary.main as string),
							}}
						/>
					</View>
				</View>
			)}
			{expiresAt && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
					}}
				>
					<Clock
						size={13}
						color={
							closingSoon
								? (colors.warning.main as string)
								: (colors.text.quaternary as string)
						}
						strokeWidth={2}
					/>
					<Caption
						color={closingSoon ? colors.warning.ink : "quaternary"}
						weight={closingSoon ? "semibold" : "medium"}
					>
						{msLeft !== null && msLeft <= 0
							? "Closed"
							: `Closes ${formatRelative(need.expiresAt)}`}
					</Caption>
				</View>
			)}
		</View>
	);
}

/* ── Event facts ── */
function EventFacts({ item }: { item: FeedEventItem }) {
	const { colors, spacing, borderRadius } = useTheme();
	const { event } = item;
	const remaining = Math.max(0, event.volunteersNeeded - event.acceptedCount);
	const place = event.venue ?? item.city;

	return (
		<View style={{ gap: spacing[2], marginTop: spacing[1] }}>
			<View style={{ flexDirection: "row", gap: spacing[2] }}>
				{/* Date chip */}
				<View
					style={{
						flex: 1,
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						padding: spacing[2.5],
						borderRadius: borderRadius.lg,
						backgroundColor: colors.background.subtle as string,
					}}
				>
					<View
						style={{
							width: 32,
							height: 32,
							borderRadius: borderRadius.md,
							backgroundColor: colors.info.bg as string,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<CalendarDays
							size={16}
							color={colors.info.ink as string}
							strokeWidth={2}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Caption weight="semibold" numberOfLines={1}>
							{formatDateRange(event.startAt, event.endAt)}
						</Caption>
						<Caption color="quaternary" style={{ fontSize: 11 }}>
							Event date
						</Caption>
					</View>
				</View>

				{/* Location chip */}
				{place && (
					<View
						style={{
							flex: 1,
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
							padding: spacing[2.5],
							borderRadius: borderRadius.lg,
							backgroundColor: colors.background.subtle as string,
						}}
					>
						<View
							style={{
								width: 32,
								height: 32,
								borderRadius: borderRadius.md,
								backgroundColor: colors.success.bg as string,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<MapPin
								size={16}
								color={colors.success.ink as string}
								strokeWidth={2}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Caption weight="semibold" numberOfLines={1}>
								{place}
							</Caption>
							<Caption color="quaternary" style={{ fontSize: 11 }}>
								Location
							</Caption>
						</View>
					</View>
				)}
			</View>

			{/* Spots row */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[2],
					padding: spacing[2.5],
					borderRadius: borderRadius.lg,
					backgroundColor: colors.background.subtle as string,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<View
						style={{
							width: 32,
							height: 32,
							borderRadius: borderRadius.md,
							backgroundColor: colors.primary.tint as string,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Users
							size={16}
							color={colors.primary.ink as string}
							strokeWidth={2}
						/>
					</View>
					<View>
						<Caption weight="semibold">
							{remaining > 0
								? `${remaining} of ${event.volunteersNeeded} spots left`
								: "All spots filled"}
						</Caption>
						<Caption color="quaternary" style={{ fontSize: 11 }}>
							Volunteers
						</Caption>
					</View>
				</View>
				{item.isUrgent && remaining > 0 && (
					<View
						style={{
							paddingHorizontal: spacing[2],
							paddingVertical: spacing[0.5],
							borderRadius: 999,
							backgroundColor: colors.primary.tint as string,
						}}
					>
						<Caption
							weight="semibold"
							style={{ color: colors.primary.ink as string, fontSize: 11 }}
						>
							Starts soon
						</Caption>
					</View>
				)}
			</View>

			{/* Mini spots progress */}
			{event.volunteersNeeded > 0 && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[1],
						paddingHorizontal: spacing[1],
					}}
				>
					{Array.from({
						length: Math.min(event.volunteersNeeded, 12),
					}).map((_, i) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: static progress segments never reorder
							key={`spot-${i}`}
							style={{
								flex: 1,
								height: 4,
								borderRadius: 999,
								backgroundColor:
									i < event.acceptedCount
										? (colors.primary.main as string)
										: (colors.background.subtle as string),
							}}
						/>
					))}
				</View>
			)}
		</View>
	);
}
