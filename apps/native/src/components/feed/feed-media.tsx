import { useEvent, useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import {
	Bookmark,
	Heart,
	ImageOff,
	Maximize2,
	MessageCircle,
	Play,
	RotateCcw,
	Share2,
	VideoOff,
	Volume2,
	VolumeX,
	X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Modal,
	PanResponder,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label, Micro } from "@/components/ui/typography";
import { mediaColors } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";
import type { FeedMedia } from "@/lib/types";

/**
 * Feed media: a swipeable carousel in the card, a Twitter-style fullscreen
 * viewer on tap.
 *
 * Product decisions, all deliberate:
 *
 * - One media per page in a free-scroll row, never a grid and never
 *   snap-paging. A grid crops everything to squares; snap-paging fights the
 *   user's thumb on a mixed photo+video post. Each page is deliberately a
 *   peek narrower than the tile so the next item always shows a sliver -
 *   that sliver plus the dots is the affordance that the row scrolls.
 * - Aspect is measured, not guessed. The server sends no dimensions, so each
 *   image reports its natural size on load and each video reads one thumbnail
 *   frame (native only; web falls back to 16:9). Ratios are clamped to
 *   4:5–16:9 so one panorama or skyscraper can't stretch a card to infinity -
 *   extremes get a gentle center-crop, never distortion.
 * - One height per row. Every page in a multi-item carousel shares the first
 *   measured ratio, so swiping doesn't bounce the card taller/shorter per
 *   photo. A single item keeps its own ratio.
 * - Video in the feed is tap-to-play and starts muted, with the controls that
 *   fact implies: a mute toggle on the tile (a muted video and a silent one
 *   look identical without it), the time remaining, and a read-only progress
 *   bar. Scrubbing and sound-on playback belong to the fullscreen viewer,
 *   which is one tap away via the expand button.
 * - Nothing ever autoplays. `active` only *pauses* - a card scrolled off
 *   screen stops decoding - because starting a video unasked in a feed of
 *   appeals spends the reader's data and their attention without being asked.
 */

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;
const FALLBACK_RATIO = 1;
const VIDEO_FALLBACK_RATIO = 16 / 9;

function clampRatio(ratio: number): number {
	if (!Number.isFinite(ratio) || ratio <= 0) return FALLBACK_RATIO;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export interface MediaViewerActions {
	headline: string;
	liked: boolean;
	saved: boolean;
	likeCount: number;
	commentCount: number;
	onToggleLike?: () => void;
	onToggleSave?: () => void;
	onComment?: () => void;
	onShare?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Carousel (in the card)                                                     */
/* -------------------------------------------------------------------------- */

export function FeedMediaCarousel({
	media,
	pageWidth,
	maxHeight,
	active = true,
	onOpenViewer,
}: {
	media: FeedMedia[];
	pageWidth: number;
	/**
	 * Tallest the tile may draw, in points. The caller owns this because it is
	 * a layout decision about the *card*, not about the picture: a 4:5 portrait
	 * in a 672pt-wide desktop column is 840pt tall - taller than the window, so
	 * the card's own actions were pushed off screen and the reader had to
	 * scroll a phone-shaped photo to reach the like button. Capping height, not
	 * width, is what keeps the picture as large as the column allows while
	 * bounding it in the direction that actually hurts.
	 */
	maxHeight: number;
	/** False while the card is off screen - see `CarouselVideo`. */
	active?: boolean;
	/** Opens the card-level fullscreen viewer at the tapped page. The viewer
	    lives in the card (not here) so opening comments from it can first
	    dismiss the modal - a sheet opened under a modal would be invisible. */
	onOpenViewer: (index: number) => void;
}) {
	const { colors, spacing } = useTheme();
	const [ratios, setRatios] = useState<Record<string, number>>({});
	const [page, setPage] = useState(0);

	// Free-scroll affordance: with more than one item every page leaves a
	// peek of the next one visible, so the row reads as scrollable without
	// any hint text. A single item takes the full width.
	const gap = spacing[2];
	const peek = spacing[7];
	const itemWidth = media.length > 1 ? pageWidth - peek : pageWidth;
	const stride = itemWidth + gap;

	// Uniform row height for multi-item carousels: the first measured ratio
	// wins, so every page matches and the card never jumps while swiping.
	// Singles keep their own ratio.
	const firstMeasured = media
		.map((m) => ratios[m.id])
		.find((r): r is number => typeof r === "number");
	const pageRatio =
		media.length > 1 ? (firstMeasured ?? FALLBACK_RATIO) : undefined;

	// The narrowest aspect this tile may take before it exceeds `maxHeight`.
	// Raising a ratio to this floor makes the tile shorter and lets
	// `contentFit: "cover"` centre-crop, which is the same trade `MIN_RATIO`
	// already makes for a skyscraper upload.
	const floorRatio = maxHeight > 0 ? itemWidth / maxHeight : 0;
	const tileRatio = (id: string, fallback: number) =>
		Math.max(pageRatio ?? ratios[id] ?? fallback, floorRatio);

	if (media.length === 0) return null;

	const onRatio = (id: string, ratio: number) => {
		const clamped = clampRatio(ratio);
		setRatios((prev) =>
			prev[id] === clamped ? prev : { ...prev, [id]: clamped },
		);
	};

	return (
		<View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap }}
				accessibilityLabel={`Media, ${media.length} item${media.length === 1 ? "" : "s"}. Scroll horizontally for more.`}
				onMomentumScrollEnd={(e) => {
					setPage(
						Math.max(
							0,
							Math.min(
								media.length - 1,
								Math.round(e.nativeEvent.contentOffset.x / stride),
							),
						),
					);
				}}
			>
				{media.map((m, i) => (
					<View key={m.id} style={{ width: itemWidth }}>
						{m.type === "IMAGE" ? (
							<CarouselImage
								url={m.url}
								id={m.id}
								width={itemWidth}
								ratio={tileRatio(m.id, FALLBACK_RATIO)}
								onRatio={onRatio}
								onOpen={() => onOpenViewer(i)}
							/>
						) : (
							<CarouselVideo
								uri={m.url}
								id={m.id}
								width={itemWidth}
								ratio={tileRatio(m.id, VIDEO_FALLBACK_RATIO)}
								onRatio={onRatio}
								active={active}
								onOpen={() => onOpenViewer(i)}
							/>
						)}
					</View>
				))}
			</ScrollView>

			{media.length > 1 && (
				<View
					style={{
						flexDirection: "row",
						justifyContent: "center",
						alignItems: "center",
						gap: spacing[1.5],
						paddingTop: spacing[2],
					}}
					accessibilityLabel={`Showing ${page + 1} of ${media.length}`}
				>
					{media.map((m) => {
						// Not `active` - that name is the carousel's viewport prop now.
						const isCurrent = media[page]?.id === m.id;
						return (
							<View
								key={m.id}
								style={{
									width: isCurrent ? 16 : 6,
									height: 6,
									borderRadius: 3,
									backgroundColor: isCurrent
										? (colors.text.primary as string)
										: (colors.border.medium as string),
								}}
							/>
						);
					})}
				</View>
			)}
		</View>
	);
}

function CarouselImage({
	url,
	id,
	width,
	ratio,
	onRatio,
	onOpen,
}: {
	url: string;
	id: string;
	width: number;
	/** Already resolved and height-capped by the carousel. */
	ratio: number;
	onRatio: (id: string, ratio: number) => void;
	onOpen: () => void;
}) {
	const { colors, borderRadius } = useTheme();
	const [failed, setFailed] = useState(false);

	if (failed) {
		return <MediaErrorTile width={width} icon="image" />;
	}

	return (
		<Pressable
			onPress={onOpen}
			accessibilityRole="imagebutton"
			accessibilityLabel="Open image fullscreen"
			style={{
				borderRadius: borderRadius.lg,
				overflow: "hidden",
				backgroundColor: colors.background.subtle,
			}}
		>
			<Image
				source={{ uri: url }}
				recyclingKey={id}
				contentFit="cover"
				transition={200}
				accessibilityIgnoresInvertColors
				onLoad={(e) => {
					const s = e.source;
					if (s?.width && s?.height) onRatio(id, s.width / s.height);
				}}
				onError={() => setFailed(true)}
				style={{ width, aspectRatio: ratio }}
			/>
		</Pressable>
	);
}

function formatClock(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const sec = total % 60;
	return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

/** Round control on a scrim. The three video affordances share it exactly. */
function VideoControl({
	label,
	onPress,
	children,
	style,
}: {
	label: string;
	onPress: () => void;
	children: React.ReactNode;
	style: object;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={8}
			style={({ pressed }) => ({
				position: "absolute",
				width: 36,
				height: 36,
				borderRadius: 18,
				backgroundColor: pressed ? mediaColors.scrimPressed : mediaColors.scrim,
				alignItems: "center",
				justifyContent: "center",
				...style,
			})}
		>
			{children}
		</Pressable>
	);
}

function CarouselVideo({
	uri,
	id,
	width,
	ratio,
	onRatio,
	onOpen,
	active = true,
}: {
	uri: string;
	id: string;
	width: number;
	/** Already resolved and height-capped by the carousel. */
	ratio: number;
	onRatio: (id: string, ratio: number) => void;
	onOpen: () => void;
	/**
	 * False once the card leaves the viewport. A playing video whose card has
	 * scrolled away keeps decoding frames and, on a long feed, keeps several
	 * players alive at once - so this pauses rather than relying on the reader
	 * to notice. It never *starts* playback: autoplay in a feed of NGO appeals
	 * is a choice the reader should make, and on cellular data it is their bill.
	 */
	active?: boolean;
}) {
	const { borderRadius, spacing } = useTheme();
	const player = useVideoPlayer(uri, (p) => {
		p.muted = true;
		// `timeUpdate` does not fire at all until this is non-zero. Four a second
		// is enough for a 2pt progress bar and cheap enough to leave on.
		p.timeUpdateEventInterval = 0.25;
	});
	const [ended, setEnded] = useState(false);
	const { isPlaying } = useEvent(player, "playingChange", {
		isPlaying: player.playing,
	});
	const { status } = useEvent(player, "statusChange", {
		status: player.status,
	});
	const { muted } = useEvent(player, "mutedChange", { muted: player.muted });
	// No initial value: `TimeUpdateEventPayload` carries four fields (live
	// timestamp and buffer position among them) and supplying a partial one
	// does not typecheck. Until the first tick the player's own clock is the
	// answer, which is 0 on a video that has not been started.
	const timeUpdate = useEvent(player, "timeUpdate");
	useEventListener(player, "playToEnd", () => setEnded(true));

	// Natural dimensions from one thumbnail frame, so the tile matches the
	// upload instead of forcing 16:9. Native only; web keeps the fallback.
	useEffect(() => {
		if (Platform.OS === "web") return;
		let cancelled = false;
		player.generateThumbnailsAsync(0).then(
			([thumb]) => {
				if (!cancelled && thumb?.width && thumb?.height) {
					onRatio(id, thumb.width / thumb.height);
				}
			},
			() => {},
		);
		return () => {
			cancelled = true;
		};
	}, [player, id, onRatio]);

	useEffect(() => {
		if (!active) player.pause();
	}, [active, player]);

	const toggle = () => {
		if (status === "error") return;
		if (ended) {
			setEnded(false);
			player.replay();
			player.play();
		} else if (isPlaying) {
			player.pause();
		} else {
			player.play();
		}
	};

	if (status === "error") {
		return <MediaErrorTile width={width} icon="video" />;
	}

	const duration = player.duration;
	const currentTime = timeUpdate?.currentTime ?? player.currentTime;
	const progress =
		duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
	const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0;
	const loading = status === "loading";

	return (
		<View
			style={{
				width,
				aspectRatio: ratio,
				borderRadius: borderRadius.lg,
				overflow: "hidden",
				backgroundColor: mediaColors.stage,
			}}
		>
			<VideoView
				player={player}
				nativeControls={false}
				contentFit="cover"
				style={{ flex: 1 }}
				accessibilityLabel="Feed video"
			/>

			{/* Tap anywhere toggles play. The round controls sit above this. */}
			<Pressable
				onPress={toggle}
				accessibilityRole="button"
				accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{loading ? (
					<ActivityIndicator color={mediaColors.ink} />
				) : ended ? (
					<View
						style={{
							width: 56,
							height: 56,
							borderRadius: 28,
							backgroundColor: mediaColors.scrim,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<RotateCcw size={24} color={mediaColors.ink} strokeWidth={2} />
					</View>
				) : !isPlaying ? (
					<View
						style={{
							width: 56,
							height: 56,
							borderRadius: 28,
							backgroundColor: mediaColors.scrim,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Play size={24} color={mediaColors.ink} fill={mediaColors.ink} />
					</View>
				) : null}
			</Pressable>

			{/* Expand: the way into the fullscreen viewer with real controls. */}
			<VideoControl
				label="Open video fullscreen"
				onPress={onOpen}
				style={{ top: spacing[2], right: spacing[2] }}
			>
				<Maximize2 size={16} color={mediaColors.ink} strokeWidth={2} />
			</VideoControl>

			{/*
			 * Sound is off in the feed and the control that says so is on the
			 * tile, not buried in the fullscreen viewer. Without it a muted video
			 * is indistinguishable from a video with no audio track, so a reader
			 * who wants the narration has no way to know there is any.
			 */}
			<VideoControl
				label={muted ? "Unmute video" : "Mute video"}
				onPress={() => {
					player.muted = !player.muted;
				}}
				style={{ bottom: spacing[2], left: spacing[2] }}
			>
				{muted ? (
					<VolumeX size={16} color={mediaColors.ink} strokeWidth={2} />
				) : (
					<Volume2 size={16} color={mediaColors.ink} strokeWidth={2} />
				)}
			</VideoControl>

			{/* Time left, so a tap is an informed one. */}
			{duration > 0 && (
				<View
					style={{
						position: "absolute",
						bottom: spacing[2],
						right: spacing[2],
						paddingHorizontal: spacing[2],
						paddingVertical: 2,
						borderRadius: 999,
						backgroundColor: mediaColors.scrim,
					}}
				>
					<Micro weight="semibold" color={mediaColors.ink}>
						{formatClock(isPlaying || currentTime > 0 ? remaining : duration)}
					</Micro>
				</View>
			)}

			{/* Progress. Read-only on the tile - scrubbing belongs to the viewer. */}
			<View
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 0,
					height: 2,
					backgroundColor: mediaColors.track,
				}}
			>
				<View
					style={{
						width: `${progress * 100}%`,
						height: "100%",
						backgroundColor: mediaColors.ink,
					}}
				/>
			</View>
		</View>
	);
}

function MediaErrorTile({
	width,
	icon,
}: {
	width: number;
	icon: "image" | "video";
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const Icon = icon === "image" ? ImageOff : VideoOff;
	return (
		<View
			style={{
				width,
				aspectRatio: FALLBACK_RATIO,
				borderRadius: borderRadius.lg,
				backgroundColor: colors.background.subtle,
				alignItems: "center",
				justifyContent: "center",
				gap: spacing[2],
			}}
			accessibilityLabel="Media couldn't be loaded"
		>
			<Icon
				size={22}
				color={colors.text.quaternary as string}
				strokeWidth={1.5}
			/>
			<Caption color="quaternary">Couldn't load this media</Caption>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Fullscreen viewer (Twitter-style overlay)                                  */
/* -------------------------------------------------------------------------- */

export function FeedMediaViewer({
	visible,
	media,
	initialIndex,
	actions,
	onClose,
}: {
	visible: boolean;
	media: FeedMedia[];
	initialIndex: number;
	actions: MediaViewerActions;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const { width: windowWidth } = useWindowDimensions();
	const [index, setIndex] = useState(initialIndex);
	const scrollRef = useRef<ScrollView>(null);

	// Swipe-down to dismiss, production-style: the content follows the
	// finger, the backdrop fades, past a distance/velocity it closes,
	// otherwise it springs back.
	//
	// Claimed in the CAPTURE phase on purpose: the fullscreen pager is a
	// horizontal ScrollView and it wins bubble-phase negotiation, so a
	// bubble-phase handler here never fires and the drag feels dead.
	// Capture runs before the ScrollView, takes only dominant-vertical
	// moves, and termination is refused so the pager can't steal the
	// gesture back mid-drag. Horizontal swipes fall through untouched.
	const translateY = useRef(new Animated.Value(0)).current;
	const backdropOpacity = translateY.interpolate({
		inputRange: [0, 280],
		outputRange: [1, 0.25],
		extrapolate: "clamp",
	});
	const pan = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponderCapture: (_, gesture) =>
				Math.abs(gesture.dy) > 12 &&
				Math.abs(gesture.dy) > Math.abs(gesture.dx),
			onPanResponderTerminationRequest: () => false,
			onPanResponderMove: (_, gesture) =>
				translateY.setValue(Math.max(0, gesture.dy)),
			onPanResponderRelease: (_, gesture) => {
				if (gesture.dy > 120 || gesture.vy > 0.7) {
					translateY.setValue(0);
					onClose();
				} else {
					Animated.spring(translateY, {
						toValue: 0,
						useNativeDriver: true,
						tension: 120,
						friction: 14,
					}).start();
				}
			},
			onPanResponderTerminate: () => {
				Animated.spring(translateY, {
					toValue: 0,
					useNativeDriver: true,
					tension: 120,
					friction: 14,
				}).start();
			},
		}),
	).current;

	useEffect(() => {
		if (visible) {
			setIndex(initialIndex);
			translateY.setValue(0);
			scrollRef.current?.scrollTo({
				x: initialIndex * windowWidth,
				animated: false,
			});
		}
	}, [visible, initialIndex, windowWidth, translateY]);

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			statusBarTranslucent
			onRequestClose={onClose}
			{...(Platform.OS === "ios"
				? { presentationStyle: "overFullScreen" as const }
				: {})}
		>
			<Animated.View
				style={{
					flex: 1,
					backgroundColor: mediaColors.viewer,
					opacity: backdropOpacity,
				}}
				{...pan.panHandlers}
			>
				<Animated.View style={{ flex: 1, transform: [{ translateY }] }}>
					{/* Top: close, title, counter. */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
							paddingTop: insets.top + spacing[2],
							paddingHorizontal: spacing[2],
							paddingBottom: spacing[2],
						}}
					>
						<Pressable
							onPress={onClose}
							accessibilityRole="button"
							accessibilityLabel="Close media viewer"
							hitSlop={8}
							style={{
								width: 44,
								height: 44,
								borderRadius: 22,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<X size={24} color={mediaColors.ink} strokeWidth={2} />
						</Pressable>
						<Label
							weight="semibold"
							numberOfLines={1}
							style={{ flex: 1, color: mediaColors.ink }}
						>
							{actions.headline}
						</Label>
						{media.length > 1 && (
							<Caption
								weight="medium"
								style={{
									color: mediaColors.inkMuted,
									minWidth: 40,
									textAlign: "right",
								}}
							>
								{index + 1} / {media.length}
							</Caption>
						)}
					</View>

					{/* Middle: the media, swipeable. Mounted only while open so
				    video players are created on demand and released on close. */}
					{visible && (
						<ScrollView
							ref={scrollRef}
							horizontal
							pagingEnabled
							showsHorizontalScrollIndicator={false}
							onMomentumScrollEnd={(e) => {
								setIndex(
									Math.max(
										0,
										Math.min(
											media.length - 1,
											Math.round(e.nativeEvent.contentOffset.x / windowWidth),
										),
									),
								);
							}}
							style={{ flex: 1 }}
						>
							{media.map((m, i) => (
								<View key={m.id} style={{ width: windowWidth, flex: 1 }}>
									{m.type === "IMAGE" ? (
										<Image
											source={{ uri: m.url }}
											recyclingKey={m.id}
											contentFit="contain"
											transition={200}
											accessibilityLabel={`Image ${i + 1} of ${media.length}`}
											accessibilityIgnoresInvertColors
											style={{ flex: 1 }}
										/>
									) : (
										<ViewerVideoPage uri={m.url} active={i === index} />
									)}
								</View>
							))}
						</ScrollView>
					)}

					{/* Bottom: the same four actions as the card. */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-around",
							paddingHorizontal: spacing[4],
							paddingTop: spacing[2],
							paddingBottom: insets.bottom + spacing[3],
						}}
					>
						<ViewerAction
							label={actions.liked ? "Unlike" : "Like"}
							count={actions.likeCount}
							active={actions.liked}
							onPress={actions.onToggleLike}
						>
							<Heart
								size={24}
								color={actions.liked ? mediaColors.liked : mediaColors.ink}
								strokeWidth={1.8}
								fill={actions.liked ? mediaColors.liked : "transparent"}
							/>
						</ViewerAction>
						<ViewerAction
							label={`Comments on ${actions.headline}`}
							count={actions.commentCount}
							onPress={actions.onComment}
						>
							<MessageCircle
								size={24}
								color={mediaColors.ink}
								strokeWidth={1.8}
							/>
						</ViewerAction>
						<ViewerAction
							label={actions.saved ? "Unsave" : "Save"}
							active={actions.saved}
							onPress={actions.onToggleSave}
						>
							<Bookmark
								size={24}
								color={mediaColors.ink}
								strokeWidth={1.8}
								fill={actions.saved ? mediaColors.ink : "transparent"}
							/>
						</ViewerAction>
						<ViewerAction
							label={`Share ${actions.headline}`}
							onPress={actions.onShare}
						>
							<Share2 size={24} color={mediaColors.ink} strokeWidth={1.8} />
						</ViewerAction>
					</View>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

function ViewerAction({
	label,
	count,
	active,
	onPress,
	children,
}: {
	label: string;
	count?: number;
	active?: boolean;
	onPress?: () => void;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={
				active === undefined ? undefined : { selected: active }
			}
			hitSlop={8}
			style={{
				minWidth: 56,
				minHeight: 48,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: spacing[1.5],
			}}
		>
			{children}
			{count !== undefined && count > 0 && (
				<Label weight="medium" style={{ color: mediaColors.ink }}>
					{count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
				</Label>
			)}
		</Pressable>
	);
}

function ViewerVideoPage({ uri, active }: { uri: string; active: boolean }) {
	const player = useVideoPlayer(uri, (p) => {
		p.muted = false;
	});

	useEffect(() => {
		if (active) {
			player.play();
		} else {
			player.pause();
		}
	}, [active, player]);

	// No pause-on-unmount here: useVideoPlayer releases the native player in
	// its own cleanup, which runs before ours - touching the player after
	// that throws NotFoundException (native shared object already gone).

	return (
		<VideoView
			player={player}
			nativeControls
			contentFit="contain"
			style={{ flex: 1 }}
			accessibilityLabel="Fullscreen video"
		/>
	);
}
