import {
	Bookmark,
	Heart,
	type LucideIcon,
	MessageCircle,
	Share2,
} from "lucide-react-native";
import { useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Micro } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";
import type { FeedItem } from "@/lib/types";

/**
 * The reaction bar.
 *
 * **No like count, anywhere.** There was a "12 likes · 3 comments" summary line
 * above the divider and a running total beside the heart. Both are gone: a
 * visible like count turns a feed of NGOs asking for help into a leaderboard,
 * and on a young feed nearly every row honestly reads zero, which makes every
 * post look ignored. Whether *you* liked something is worth showing; how many
 * others did is not. The comment count survives, above zero only, because it
 * promises something to read rather than scoring the post.
 *
 * Two shapes. **Beside a CTA** (needs and open events) it is four 40pt icons
 * at the end of the CTA's own row, with no rule above: a separate labelled row
 * under a one-button card spent a whole line, and a hairline, on four glyphs.
 * **Without a CTA** (stories, updates) there is nothing to share a line with,
 * so the labelled row below stays.
 *
 * In the labelled row, grouped rather than evenly spaced: like, comment and share sit together on
 * the left because they are all things done to the conversation; save sits
 * alone on the right because it is a thing done for yourself.
 *
 * Hover is read from the style callback, not held in state. A `useState` hover
 * hook re-rendered the whole card - and its video player - every time the
 * pointer crossed one of these four buttons.
 */

/** The icon-only footer's hit target. */
const ICON_TARGET = 40;

function formatCount(n: number): string {
	if (n < 1000) return String(n);
	if (n < 1_000_000) {
		const k = n / 1000;
		return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
	}
	return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

function Reaction({
	icon: Icon,
	active,
	count,
	label,
	text,
	activeColor,
	onPress,
	compact,
	iconOnly = false,
	animateOnPress = false,
}: {
	icon: LucideIcon;
	active?: boolean;
	/** Shown only above zero. Never passed for likes - see the header. */
	count?: number;
	/** Screen-reader label. Always a full phrase, never just the verb. */
	label: string;
	/** Visible word beside the icon. Wide cards only - see `showLabels`. */
	text?: string;
	activeColor?: string;
	onPress?: () => void;
	compact: boolean;
	/** A 40x40 target with no verb - the footer beside the CTA. */
	iconOnly?: boolean;
	animateOnPress?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const scale = useRef(new Animated.Value(1)).current;
	const color = active
		? (activeColor ?? (colors.text.primary as string))
		: (colors.text.tertiary as string);
	const showCount = count !== undefined && count > 0;

	const trigger = () => {
		if (!onPress) return;
		onPress();
		if (!animateOnPress) return;
		Animated.sequence([
			Animated.timing(scale, {
				toValue: 1.3,
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
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				const fill =
					pressed || hovered
						? (colors.background.subtle as string)
						: "transparent";
				if (iconOnly) {
					return {
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: spacing[0.5],
						// 40 square; a comment count widens it rather than being
						// squeezed into a corner badge that "12" would overrun.
						minWidth: ICON_TARGET,
						height: ICON_TARGET,
						paddingHorizontal: showCount ? spacing[2] : 0,
						borderRadius: borderRadius.md,
						backgroundColor: fill,
					};
				}
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[1.5],
					paddingHorizontal: compact ? spacing[2] : spacing[2.5],
					paddingVertical: spacing[1.5],
					borderRadius: borderRadius.md,
					backgroundColor: fill,
					minHeight: 34,
				};
			}}
		>
			<Animated.View style={{ transform: [{ scale }] }}>
				<Icon
					size={iconOnly ? 20 : 18}
					color={color}
					strokeWidth={1.8}
					fill={active ? color : "transparent"}
				/>
			</Animated.View>
			{iconOnly ? (
				showCount ? (
					<Micro weight="semibold" style={{ color }}>
						{formatCount(count)}
					</Micro>
				) : null
			) : text || showCount ? (
				<Caption weight="medium" style={{ color }}>
					{text}
					{showCount ? `${text ? "  " : ""}${formatCount(count)}` : ""}
				</Caption>
			) : null}
		</Pressable>
	);
}

export interface CardActionsProps {
	item: FeedItem;
	liked: boolean;
	saved: boolean;
	/** Narrow card: tighten the padding. */
	compact: boolean;
	/** Wide card: there is room for the verb beside each icon. */
	showLabels: boolean;
	headline: string;
	/**
	 * Icons only, no rule above, no verbs - for the footer row that shares its
	 * line with the card's CTA. The card passes it whenever there is a CTA.
	 */
	iconOnly?: boolean;
	onToggleLike?: () => void;
	onToggleSave?: () => void;
	onComment: () => void;
	onShare: () => void;
}

export function CardActions({
	item,
	liked,
	saved,
	compact,
	showLabels,
	headline,
	iconOnly = false,
	onToggleLike,
	onToggleSave,
	onComment,
	onShare,
}: CardActionsProps) {
	const { colors, spacing } = useTheme();
	const { comments } = item.engagement;

	if (iconOnly) {
		return (
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					// The last icon's own padding would indent it from the card's
					// right edge; pull the group out by the glyph's inset.
					marginRight: -spacing[2.5],
				}}
			>
				<Reaction
					icon={Heart}
					active={liked}
					label={liked ? "Unlike this post" : "Like this post"}
					activeColor={colors.error.main as string}
					compact
					iconOnly
					animateOnPress
					{...(onToggleLike ? { onPress: onToggleLike } : {})}
				/>
				<Reaction
					icon={MessageCircle}
					count={comments}
					label={
						comments > 0
							? `Read ${comments} comments on ${headline}`
							: `Comment on ${headline}`
					}
					compact
					iconOnly
					onPress={onComment}
				/>
				<Reaction
					icon={Share2}
					label={`Share ${headline}`}
					compact
					iconOnly
					onPress={onShare}
				/>
				<Reaction
					icon={Bookmark}
					active={saved}
					label={saved ? "Remove from saved" : "Save this post"}
					activeColor={colors.text.primary as string}
					compact
					iconOnly
					{...(onToggleSave ? { onPress: onToggleSave } : {})}
				/>
			</View>
		);
	}

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				marginTop: spacing[1],
				paddingTop: spacing[1],
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
				// Pulled out to the card's edge so the buttons' own padding lines the
				// first icon up with the text above it, instead of indenting it by
				// the width of a hit area.
				marginHorizontal: -spacing[2],
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: compact ? 0 : spacing[0.5],
				}}
			>
				<Reaction
					icon={Heart}
					active={liked}
					label={liked ? "Unlike this post" : "Like this post"}
					{...(showLabels ? { text: liked ? "Liked" : "Like" } : {})}
					activeColor={colors.error.main as string}
					compact={compact}
					animateOnPress
					{...(onToggleLike ? { onPress: onToggleLike } : {})}
				/>
				<Reaction
					icon={MessageCircle}
					count={comments}
					label={
						comments > 0
							? `Read ${comments} comments on ${headline}`
							: `Comment on ${headline}`
					}
					{...(showLabels ? { text: "Comment" } : {})}
					compact={compact}
					onPress={onComment}
				/>
				<Reaction
					icon={Share2}
					label={`Share ${headline}`}
					{...(showLabels ? { text: "Share" } : {})}
					compact={compact}
					onPress={onShare}
				/>
			</View>

			<Reaction
				icon={Bookmark}
				active={saved}
				label={saved ? "Remove from saved" : "Save this post"}
				{...(showLabels ? { text: saved ? "Saved" : "Save" } : {})}
				activeColor={colors.text.primary as string}
				compact={compact}
				{...(onToggleSave ? { onPress: onToggleSave } : {})}
			/>
		</View>
	);
}
