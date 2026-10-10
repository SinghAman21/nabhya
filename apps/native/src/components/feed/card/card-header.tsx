import { Image } from "expo-image";
import { BadgeCheck, Trash2 } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, H5, Label } from "@/components/ui/typography";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
import { useTheme } from "@/hooks/use-theme";
import { focusable, type PressState } from "@/lib/focus";
import { formatRelative } from "@/lib/format";
import type { FeedItem } from "@/lib/types";

const AVATAR = 40;

/**
 * Resolves whatever the row carried into something `<Image>` can load.
 *
 * The two sources are not the same shape, which is why this exists. The feed
 * ranker signs an NGO logo on the server (`orgSummary` calls
 * `createDownloadUrl`), so `organization.logo` arrives as a **URL**; a
 * volunteer's `author.profileImage` comes straight off the user row and is
 * still a **key**. Passing the signed URL to `useStoredImageUrl` posted it to
 * `/api/uploads/download-url` as though it were a key, which fails - so every
 * NGO in the feed fell back to a letter tile even when it had uploaded a logo.
 *
 * `useStoredImageUrl` is called unconditionally (its query is disabled on a
 * null key), so hook order is fixed regardless of which source won.
 */
function useAvatarSource(value: string | null | undefined) {
	const alreadySigned =
		typeof value === "string" && /^https?:\/\//i.test(value);
	const resolved = useStoredImageUrl(alreadySigned ? null : value);
	return alreadySigned ? value : resolved;
}

export interface CardHeaderProps {
	item: FeedItem;
	onOpen?: () => void;
	onToggleFollow?: () => void;
	/** Owner-only. Confirmation is the caller's job, not the header's. */
	onDelete?: () => void;
}

/**
 * Who posted, from where, and how long ago - plus the two controls that belong
 * to the poster rather than to the post.
 *
 * An organisation gets a rounded-square avatar and a volunteer gets a circle.
 * That is not decoration: the feed mixes NGO rows and volunteer rows, and the
 * shape is the only cue that survives being glanced at, since both are a
 * 42-point image with a name beside it.
 */
export function CardHeader({
	item,
	onOpen,
	onToggleFollow,
	onDelete,
}: CardHeaderProps) {
	const { colors, spacing, borderRadius } = useTheme();
	const org = item.organization;
	const name = org?.organizationName ?? item.author?.fullName ?? "Volunteer";
	// "City, State" - a city alone is ambiguous across a national feed.
	const place = [item.city, item.state].filter(Boolean).join(", ") || "India";
	const initial = name.charAt(0).toUpperCase() || "N";
	const avatarUrl = useAvatarSource(org?.logo ?? item.author?.profileImage);
	const following = item.isFollowing;
	// Asserted rather than assumed. The adapter currently stamps every feed org
	// VERIFIED because only verified NGOs are supposed to reach the feed, but a
	// tick is a claim about a real organisation and should be drawn from the
	// field that carries that claim, not from the row's presence.
	const verified = org?.verificationStatus === "VERIFIED";

	return (
		// No padding of its own: the card shell pads once, for every section, so
		// the header's left edge lines up with the title beneath it.
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
			}}
		>
			<Pressable
				onPress={onOpen}
				disabled={!onOpen}
				accessibilityRole={onOpen ? "link" : undefined}
				accessibilityLabel={onOpen ? `Open ${name}` : name}
				hitSlop={4}
				{...(onOpen ? focusable : {})}
				style={{
					flex: 1,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				{avatarUrl ? (
					<Image
						source={{ uri: avatarUrl }}
						style={{
							width: AVATAR,
							height: AVATAR,
							borderRadius: org ? borderRadius.md : AVATAR / 2,
							backgroundColor: colors.background.subtle,
						}}
						contentFit="cover"
						transition={150}
						accessibilityIgnoresInvertColors
					/>
				) : (
					<View
						style={{
							width: AVATAR,
							height: AVATAR,
							borderRadius: org ? borderRadius.md : AVATAR / 2,
							backgroundColor: colors.background.subtle,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<H5 color="tertiary">{initial}</H5>
					</View>
				)}

				<View style={{ flex: 1, justifyContent: "center", gap: 1 }}>
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
						{/*
						 * The tick sits inline beside the name rather than clipped to
						 * the avatar's corner. As an overlay it was a 14pt glyph on a
						 * 2pt cut-out that collided with the avatar's own rounding, and
						 * on a dark card its white plate read as a notch taken out of
						 * the logo.
						 */}
						{verified && (
							<BadgeCheck
								size={15}
								color={colors.info.main as string}
								strokeWidth={2.25}
							/>
						)}
					</View>
					<Caption color="quaternary" numberOfLines={1}>
						{/*
						 * "Posted" is said out loud because a need's urgency is now its
						 * deadline, in the facts block. Bare, "3 days ago" read as how
						 * long the need had left; it is only how old the post is.
						 */}
						{place} · Posted {formatRelative(item.postedAt)}
					</Caption>
				</View>
			</Pressable>

			{/*
			 * Follow disappears once you follow.
			 *
			 * A previous pass kept a checked "Following" marker in its place on the
			 * theory that the control's absence is ambiguous. In a feed it is not:
			 * the rows you see are largely the rows you already follow, so the
			 * marker appeared on most cards and became a permanent word of chrome
			 * saying something the reader already knew. Unfollowing lives on the
			 * NGO page, which the name above links to.
			 *
			 * Because the control vanishes, the *caller* toasts "Following X" with
			 * Undo once the request lands - it owns the mutation and so knows when
			 * it succeeded; the header only knows it was pressed.
			 */}
			{org && !following && onToggleFollow && (
				<Pressable
					onPress={onToggleFollow}
					accessibilityRole="button"
					accessibilityLabel={`Follow ${org.organizationName}`}
					hitSlop={10}
					{...focusable}
					style={(state) => {
						const { pressed, hovered } = state as PressState;
						return {
							paddingHorizontal: spacing[3],
							paddingVertical: spacing[1.5],
							borderRadius: borderRadius.full,
							// A compact neutral pill, not a word and not a brand fill. As a
							// bare word it did not read as a control at the end of the
							// header row; as a brand-tinted button it was the loudest thing
							// in a list of forty. `background.subtle` is the same inset
							// grey as the need's facts block.
							backgroundColor: (pressed || hovered
								? colors.background.overlay
								: colors.background.subtle) as string,
						};
					}}
				>
					<Caption weight="semibold">Follow</Caption>
				</Pressable>
			)}

			{/*
			 * Owner control. Drawn only when the caller supplied a handler, so a
			 * volunteer's feed keeps a header with nothing to press.
			 *
			 * It says what it does. The icon was `MoreHorizontal` labelled "Post
			 * options", but there is one option and it deletes the post - an
			 * overflow affordance that opens nothing is a menu that lies.
			 */}
			{onDelete && (
				<Pressable
					onPress={onDelete}
					accessibilityRole="button"
					accessibilityLabel="Delete this post"
					hitSlop={8}
					{...focusable}
					style={({ pressed }) => ({
						width: 34,
						height: 34,
						borderRadius: 999,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: pressed
							? (colors.error.bg as string)
							: "transparent",
					})}
				>
					<Trash2
						size={17}
						color={colors.text.tertiary as string}
						strokeWidth={2}
					/>
				</Pressable>
			)}
		</View>
	);
}
