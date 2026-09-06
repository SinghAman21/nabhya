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
	X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
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
import { Caption, Label } from "@/components/ui/typography";
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
 *   peek narrower than the tile so the next item always shows a sliver —
 *   that sliver plus the dots is the affordance that the row scrolls.
 * - Aspect is measured, not guessed. The server sends no dimensions, so each
 *   image reports its natural size on load and each video reads one thumbnail
 *   frame (native only; web falls back to 16:9). Ratios are clamped to
 *   4:5–16:9 so one panorama or skyscraper can't stretch a card to infinity —
 *   extremes get a gentle center-crop, never distortion.
 * - One height per row. Every page in a multi-item carousel shares the first
 *   measured ratio, so swiping doesn't bounce the card taller/shorter per
 *   photo. A single item keeps its own ratio.
 * - Video in the feed has no chrome: tap toggles play, a small replay button
 *   appears bottom-right at the end, an expand button top-right opens the
 *   viewer. Sound stays muted in the feed; the viewer plays with sound and
 *   native controls. `autoplay` is plumbed but off — later the feed's
 *   viewability callback can drive it per card without touching this file.
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
	onOpenViewer,
}: {
	media: FeedMedia[];
	pageWidth: number;
	/** Opens the card-level fullscreen viewer at the tapped page. The viewer
	    lives in the card (not here) so opening comments from it can first
	    dismiss the modal — a sheet opened under a modal would be invisible. */
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
								ratio={pageRatio ?? ratios[m.id]}
								onRatio={onRatio}
								onOpen={() => onOpenViewer(i)}
							/>
						) : (
							<CarouselVideo
								uri={m.url}
								id={m.id}
								width={itemWidth}
								ratio={pageRatio ?? ratios[m.id]}
								onRatio={onRatio}
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
						const active = media[page]?.id === m.id;
						return (
							<View
								key={m.id}
								style={{
									width: active ? 16 : 6,
									height: 6,
									borderRadius: 3,
									backgroundColor: active
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
	ratio: number | undefined;
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
				style={{
					width,
					aspectRatio: ratio ?? FALLBACK_RATIO,
				}}
			/>
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
	autoplay = false,
}: {
	uri: string;
	id: string;
	width: number;
	ratio: number | undefined;
	onRatio: (id: string, ratio: number) => void;
	onOpen: () => void;
	/** Driven later by feed viewability. Off by default: tap-to-play. */
	autoplay?: boolean;
}) {
	const { borderRadius, spacing } = useTheme();
	const player = useVideoPlayer(uri, (p) => {
		p.muted = true;
	});
	const [ended, setEnded] = useState(false);
	const { isPlaying } = useEvent(player, "playingChange", {
		isPlaying: player.playing,
	});
	const { status } = useEvent(player, "statusChange", {
		status: player.status,
	});
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
		if (autoplay) {
			setEnded(false);
			player.play();
		} else {
			player.pause();
		}
	}, [autoplay, player]);

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

	return (
		<View
			style={{
				width,
				aspectRatio: ratio ?? VIDEO_FALLBACK_RATIO,
				borderRadius: borderRadius.lg,
				overflow: "hidden",
				backgroundColor: "#111111",
			}}
		>
			<VideoView
				player={player}
				nativeControls={false}
				contentFit="cover"
				style={{ flex: 1 }}
				accessibilityLabel="Feed video. Double-tap to play or pause."
			/>
			{/* Tap anywhere toggles play. The expand button sits above this. */}
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
				{!isPlaying && !ended && (
					<View
						style={{
							width: 56,
							height: 56,
							borderRadius: 28,
							backgroundColor: "rgba(0,0,0,0.55)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Play size={24} color="#FFFFFF" fill="#FFFFFF" />
					</View>
				)}
			</Pressable>
			{/* Expand: the way into the fullscreen viewer with real controls. */}
			<Pressable
				onPress={onOpen}
				accessibilityRole="button"
				accessibilityLabel="Open video fullscreen"
				hitSlop={8}
				style={{
					position: "absolute",
					top: spacing[2],
					right: spacing[2],
					width: 44,
					height: 44,
					borderRadius: 22,
					backgroundColor: "rgba(0,0,0,0.55)",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Maximize2 size={18} color="#FFFFFF" strokeWidth={2} />
			</Pressable>
			{/* Replay, once the video has run to the end. */}
			{ended && (
				<Pressable
					onPress={toggle}
					accessibilityRole="button"
					accessibilityLabel="Replay video"
					hitSlop={8}
					style={{
						position: "absolute",
						right: spacing[2],
						bottom: spacing[2],
						width: 44,
						height: 44,
						borderRadius: 22,
						backgroundColor: "rgba(0,0,0,0.55)",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<RotateCcw size={18} color="#FFFFFF" strokeWidth={2} />
				</Pressable>
			)}
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
					backgroundColor: "#000000",
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
							<X size={24} color="#FFFFFF" strokeWidth={2} />
						</Pressable>
						<Label
							weight="semibold"
							numberOfLines={1}
							style={{ flex: 1, color: "#FFFFFF" }}
						>
							{actions.headline}
						</Label>
						{media.length > 1 && (
							<Caption
								weight="medium"
								style={{ color: "#A3A3A3", minWidth: 40, textAlign: "right" }}
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
								color={actions.liked ? "#F87171" : "#FFFFFF"}
								strokeWidth={1.8}
								fill={actions.liked ? "#F87171" : "transparent"}
							/>
						</ViewerAction>
						<ViewerAction
							label={`Comments on ${actions.headline}`}
							count={actions.commentCount}
							onPress={actions.onComment}
						>
							<MessageCircle size={24} color="#FFFFFF" strokeWidth={1.8} />
						</ViewerAction>
						<ViewerAction
							label={actions.saved ? "Unsave" : "Save"}
							active={actions.saved}
							onPress={actions.onToggleSave}
						>
							<Bookmark
								size={24}
								color="#FFFFFF"
								strokeWidth={1.8}
								fill={actions.saved ? "#FFFFFF" : "transparent"}
							/>
						</ViewerAction>
						<ViewerAction
							label={`Share ${actions.headline}`}
							onPress={actions.onShare}
						>
							<Share2 size={24} color="#FFFFFF" strokeWidth={1.8} />
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
				<Label weight="medium" style={{ color: "#FFFFFF" }}>
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
	// its own cleanup, which runs before ours — touching the player after
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
