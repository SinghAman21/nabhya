import { useRouter } from "expo-router";
import { memo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { FeedCommentsSheet } from "@/components/feed/feed-comments-sheet";
import {
	FeedMediaViewer,
	type MediaViewerActions,
} from "@/components/feed/feed-media";
import { useRecordFeedInteraction } from "@/hooks/use-feed";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { publicUrl, shareLink } from "@/lib/share-link";
import type {
	FeedItem,
	FeedMedia,
	FeedNeedItem,
	PublicNeed,
} from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { CardActions } from "./card-actions";
import { CardBody } from "./card-body";
import { CtaButton, primaryCta } from "./card-cta";
import { CardHeader } from "./card-header";

export { NeedFacts } from "./card-facts";
export { CardKicker } from "./card-meta";

/**
 * A feed row.
 *
 * The surface is deliberately identical to `Surface` in `screen-shell.tsx`,
 * which is what every other raised block in the app uses: `background.card`,
 * `borderRadius.xl`, `elevation.card` **in light mode only**, and no border at
 * all. Getting that wrong is most of why this card looked like a foreign
 * object - it carried a 1px hairline outline and a shadow in dark mode, so
 * where the rest of the app has soft, edgeless panels the feed had a column of
 * outlined tiles.
 *
 * It is also near-monochrome. Type hierarchy and arrangement do the work - see
 * `card-body.tsx` for how the four kinds differ - and the brand colour appears
 * exactly twice: a need's progress bar and the one solid button.
 */

/**
 * Media height ceilings, and the main lever on how tall a card gets.
 *
 * A cap is needed at all because aspect is measured from the file: a portrait
 * photo at column width is taller than the viewport, which pushes the card's
 * own actions below the fold. Desktop takes the tighter number because the
 * window is landscape.
 */
const MEDIA_MAX_HEIGHT = { desktop: 280, mobile: 380 } as const;
/** Never let media take more of the window than this, whatever the platform. */
const MEDIA_MAX_VIEWPORT_FRACTION = 0.4;

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
	/** Omit to hide Follow (an NGO account cannot follow - the server 403s). */
	onToggleFollow?: (organizationId: string, following: boolean) => void;
	onToggleLike?: (item: FeedItem, liked: boolean) => void;
	onToggleSave?: (item: FeedItem, saved: boolean) => void;
	/**
	 * Supplied only where the viewer authored the row - the NGO feed passes it
	 * for that org's own posts. Present means a delete control is drawn in the
	 * header; absent means the card has no owner affordances at all, which is
	 * every volunteer's view of it.
	 */
	onDelete?: (item: FeedItem) => void;
}

function FeedCardImpl({
	item,
	onRespond,
	onToggleFollow,
	onToggleLike,
	onToggleSave,
	onDelete,
}: { item: FeedItem } & FeedCardActions) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const router = useRouter();
	const { height: windowHeight } = useWindowDimensions();
	// Breakpoints come from the window, not from the card's own measured width.
	// Measuring the card and then sizing its media from that measurement is what
	// produced the web "Maximum update depth exceeded" - see `Media` in
	// `card-body.tsx` for the full account.
	const { isDesktop } = useMedia();
	const email = useAuthStore((s) => s.email);
	const recordShare = useRecordFeedInteraction("share");

	const [expanded, setExpanded] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	// One fullscreen viewer per card, shared by post media and cover images. It
	// lives here (not in the carousel) so "comment" can dismiss the modal first
	// - a sheet opened underneath a modal would never be seen.
	const [viewer, setViewer] = useState<{
		media: FeedMedia[];
		index: number;
	} | null>(null);

	const org = item.organization;
	const headline =
		item.title || org?.organizationName || item.author?.fullName || "Post";
	const liked = item.viewer?.liked ?? false;
	const saved = item.viewer?.saved ?? false;

	const mediaMaxHeight = Math.min(
		isDesktop ? MEDIA_MAX_HEIGHT.desktop : MEDIA_MAX_HEIGHT.mobile,
		windowHeight * MEDIA_MAX_VIEWPORT_FRACTION,
	);

	const share = async () => {
		// Needs have their own page now (`app/needs/[id].tsx`); a shared need
		// used to open the NGO's profile and leave the reader to find it.
		const path =
			item.kind === "event"
				? `/events/${item.id}`
				: item.kind === "need"
					? `/needs/${item.id}`
					: org
						? `/ngos/${org.id}`
						: "/";
		// `shareLink` copies the link where there is no share sheet - desktop
		// Chrome and Firefox lack `navigator.share`, so `Share.share` did nothing.
		await shareLink({
			message: `${headline}${org ? ` - ${org.organizationName}` : ""} on Nabhya`,
			url: publicUrl(path),
		});
		if (email) recordShare.mutate({ item });
	};

	const cta = primaryCta(item, {
		onRespond,
		openEvent: () => router.push(`/events/${item.id}`),
	});

	const actionProps = {
		item,
		liked,
		saved,
		headline,
		...(onToggleLike ? { onToggleLike: () => onToggleLike(item, liked) } : {}),
		...(onToggleSave ? { onToggleSave: () => onToggleSave(item, saved) } : {}),
		onComment: () => setCommentsOpen(true),
		onShare: share,
	};

	const mediaActions: MediaViewerActions = {
		headline,
		liked,
		saved,
		commentCount: item.engagement.comments,
		...(onToggleLike ? { onToggleLike: () => onToggleLike(item, liked) } : {}),
		...(onToggleSave ? { onToggleSave: () => onToggleSave(item, saved) } : {}),
		onComment: () => {
			setViewer(null);
			setCommentsOpen(true);
		},
		onShare: share,
	};

	return (
		<>
			<View
				style={{
					backgroundColor: colors.background.card,
					borderRadius: borderRadius.xl,
					marginHorizontal: spacing[3],
					marginVertical: spacing[1.5],
					padding: spacing[4],
					gap: spacing[3],
					overflow: "hidden",
					// `Surface`'s exact recipe: elevation in light mode, nothing in
					// dark. A shadow on near-black is invisible, and the hairline
					// border that used to stand in for it made every row an outlined
					// tile - the one thing in the app drawn that way.
					...(isDark ? {} : elevation.card),
				}}
			>
				<CardHeader
					item={item}
					{...(org ? { onOpen: () => router.push(`/ngos/${org.id}`) } : {})}
					{...(org && !item.isFollowing && onToggleFollow
						? { onToggleFollow: () => onToggleFollow(org.id, false) }
						: {})}
					{...(onDelete ? { onDelete: () => onDelete(item) } : {})}
				/>

				<CardBody
					item={item}
					expanded={expanded}
					onToggleExpand={() => setExpanded((v) => !v)}
					mediaMaxHeight={mediaMaxHeight}
					// The fullscreen viewer mounts a second player on the same file,
					// unmuted. Without this both run at once and the muted tile keeps
					// decoding underneath the modal.
					mediaActive={viewer === null}
					onOpenViewer={(media, index) => setViewer({ media, index })}
				/>

				{cta ? (
					// The CTA and the reactions share one row: the button sized to
					// its label on the left, four icons on the right. This replaced a
					// CTA line followed by a ruled, labelled action row - two lines
					// and a hairline to hold one button and four glyphs.
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: spacing[2],
						}}
					>
						<CtaButton cta={cta} />
						<CardActions {...actionProps} compact showLabels={false} iconOnly />
					</View>
				) : (
					<CardActions
						{...actionProps}
						compact={!isDesktop}
						showLabels={isDesktop}
					/>
				)}
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

/**
 * Memoised on the row and its handlers.
 *
 * Every card re-rendered on every list render before this - and each one holds
 * a media carousel that re-measures, plus a video player per video. With the
 * reaction mutations now writing straight into the cache, a like re-renders the
 * list, so a card that ignores an unchanged `item` is what keeps that from
 * costing a full pass over twelve cards and their players.
 */
export const FeedCard = memo(FeedCardImpl);
