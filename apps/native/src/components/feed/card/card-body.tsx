import { useCallback, useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { FeedMediaCarousel } from "@/components/feed/feed-media";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H4, H5 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";
import { splitPostText } from "@/lib/post-text";
import type { FeedItem, FeedMedia } from "@/lib/types";
import { EventDate, EventFacts, eventStart, NeedFacts } from "./card-facts";
import { CardKicker } from "./card-meta";

/**
 * The body - and the one place the four kinds are genuinely different.
 *
 * They are told apart by **arrangement**, not colour. An earlier pass gave each
 * kind a tone and tinted its pill, its facts panel and its button to match,
 * which said "this is an event" by turning a third of the card blue: expensive,
 * useless in greyscale, and hopeless in a feed where forty consecutive rows are
 * the same kind.
 *
 * - **An event indents.** Its date sits in a 38pt left column with everything
 *   else beside it. No other kind has a left column.
 * - **A story leads with its picture** and sets its title a step larger.
 * - **A need ends with its facts block** - remainder, bar, drop-off place and
 *   deadline in one grey inset - with the action directly beneath it.
 * - **An update is just words** - which is what makes the other three legible
 *   as *not* that.
 *
 * Because the shape carries the distinction, the kind label above the title was
 * removed for three of the four; see `card-meta.tsx`.
 */

type CardLayout = "need" | "event" | "story" | "update";

/**
 * A row's arrangement. Only `post` is renamed - an update is what it is to a
 * reader, and "post" is the table it came out of.
 *
 * This was a `kind.ts` module returning a label, an icon and a layout. The
 * label and the icon died with the kind pill (see `card-meta.tsx`), and what
 * was left did not earn a file.
 */
function cardLayout(item: FeedItem): CardLayout {
	return item.kind === "post" ? "update" : item.kind;
}

/** Collapsed line budget per layout. This is what bounds the card's height. */
const CLAMP_LINES = { story: 5, need: 2, other: 3 } as const;
/**
 * Roughly how many characters fit in a clamped line at this ramp step. Used
 * only to decide whether to *offer* "Read more" - over-offering it on a body
 * that happens to fit is a smaller failure than silently clipping one that does
 * not, which is what a flat 220-character threshold did to every need.
 */
const CHARS_PER_LINE = 55;

interface ResolvedBody {
	title: string | null;
	text: string;
	media: FeedMedia[];
}

function resolveBody(item: FeedItem): ResolvedBody {
	if (item.kind === "post") {
		// A posts row carries one text blob; the composer writes the title as the
		// first paragraph, so the split is the only place that knows the shape.
		const split = splitPostText(item.post.text);
		return {
			title: split.title,
			text: split.description,
			media: item.post.media,
		};
	}

	const cover =
		item.kind === "event"
			? item.event.coverImage
			: item.kind === "story"
				? item.story.coverImage
				: null;

	return {
		title: item.title || null,
		text: item.description,
		// A cover is a single-image carousel, so tapping it opens the same
		// fullscreen viewer as post media instead of being the one image on the
		// card that does nothing when tapped.
		media: cover
			? [{ id: `${item.id}-cover`, type: "IMAGE", url: cover, sortOrder: 0 }]
			: [],
	};
}

/**
 * The media block, which measures **itself** rather than being handed the
 * card's width.
 *
 * This is the fix for "Maximum update depth exceeded" on web. The card shell
 * used to carry the `onLayout` and derive the media's height ceiling from its
 * own measured width - so width set height, height set the page's scroll
 * extent, the scrollbar's appearance set the width back, and react-native-web's
 * `ResizeObserver` ran that circle until React gave up. Here the observed box
 * is a plain wrapper whose width comes from the parent's fixed padding and
 * whose height changes cannot feed back into it, so the cycle has nowhere to
 * close.
 */
function Media({
	media,
	maxHeight,
	active,
	onOpenViewer,
}: {
	media: FeedMedia[];
	maxHeight: number;
	active: boolean;
	onOpenViewer: (index: number) => void;
}) {
	const [width, setWidth] = useState(0);

	const onLayout = useCallback((e: LayoutChangeEvent) => {
		const next = Math.round(e.nativeEvent.layout.width);
		setWidth((prev) => (prev === next ? prev : next));
	}, []);

	return (
		<View onLayout={onLayout}>
			{width > 0 && (
				<FeedMediaCarousel
					media={media}
					pageWidth={width}
					maxHeight={maxHeight}
					active={active}
					onOpenViewer={onOpenViewer}
				/>
			)}
		</View>
	);
}

export function CardBody({
	item,
	expanded,
	onToggleExpand,
	mediaMaxHeight,
	mediaActive,
	onOpenViewer,
}: {
	item: FeedItem;
	expanded: boolean;
	onToggleExpand: () => void;
	mediaMaxHeight: number;
	/** False while something else is playing this media - see the card shell. */
	mediaActive: boolean;
	onOpenViewer: (media: FeedMedia[], index: number) => void;
}) {
	const { spacing } = useTheme();
	const { title, text, media } = resolveBody(item);
	const layout = cardLayout(item);

	// A need's two lines: its facts block below already says how many, where
	// and by when, so the prose is context, not the substance.
	const clamp =
		layout === "story"
			? CLAMP_LINES.story
			: layout === "need"
				? CLAMP_LINES.need
				: CLAMP_LINES.other;
	const expandable = text.length > clamp * CHARS_PER_LINE;

	const kicker = <CardKicker item={item} />;

	const heading = title ? (
		layout === "story" ? (
			<H4 numberOfLines={3}>{title}</H4>
		) : (
			<H5 numberOfLines={2}>{title}</H5>
		)
	) : null;

	const prose = text ? (
		<View style={{ gap: spacing[0.5] }}>
			<Body color="secondary" numberOfLines={expanded ? undefined : clamp}>
				{text}
			</Body>
			{expandable && (
				<Pressable
					onPress={onToggleExpand}
					accessibilityRole="button"
					accessibilityLabel={expanded ? "Show less" : "Read the full post"}
					accessibilityState={{ expanded }}
					hitSlop={8}
					{...focusable}
					style={{ alignSelf: "flex-start", paddingVertical: spacing[0.5] }}
				>
					<Caption color="tertiary" weight="semibold">
						{expanded ? "Show less" : "Read more"}
					</Caption>
				</Pressable>
			)}
		</View>
	) : null;

	const mediaBlock =
		media.length > 0 ? (
			<Media
				media={media}
				maxHeight={mediaMaxHeight}
				active={mediaActive}
				onOpenViewer={(index) => onOpenViewer(media, index)}
			/>
		) : null;

	if (layout === "story") {
		return (
			<View style={{ gap: spacing[2.5] }}>
				{mediaBlock}
				{kicker}
				{heading}
				{prose}
			</View>
		);
	}

	if (layout === "event" && item.kind === "event") {
		const start = eventStart(item);
		return (
			<View style={{ gap: spacing[2.5] }}>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					{start && <EventDate start={start} />}
					<View style={{ flex: 1, gap: spacing[2] }}>
						{kicker}
						{heading}
						<EventFacts item={item} />
					</View>
				</View>
				{prose}
				{mediaBlock}
			</View>
		);
	}

	if (layout === "need" && item.kind === "need") {
		return (
			<View style={{ gap: spacing[2.5] }}>
				{kicker}
				{heading}
				{prose}
				{mediaBlock}
				<NeedFacts item={item} />
			</View>
		);
	}

	return (
		<View style={{ gap: spacing[2.5] }}>
			{kicker}
			{heading}
			{prose}
			{mediaBlock}
		</View>
	);
}
