import { Image } from "expo-image";
import { AlertTriangle, Check, ImagePlus, Play, X } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Micro } from "@/components/ui/typography";
import { mediaColors, withOpacity } from "@/constants/design-system";
import { useTheme } from "@/hooks/use-theme";
import { type ComposerMedia, formatDuration } from "@/lib/feed-media";
import { focusable } from "@/lib/focus";

/**
 * The attachment strip: one tile per picked file, plus the tile that adds
 * another.
 *
 * Its own file because it is the largest single thing in the composer and the
 * least coupled to it - it takes a `ComposerMedia` and reports a removal, and
 * knows nothing about types, urgency or which endpoint the post is bound for.
 */

/** The tile's edge, and the width the strip lays out on. */
export const TILE = 88;

/*
 * Everything drawn over the thumbnail comes from `mediaColors`, not the theme:
 * the ground here is the picture, so a chip that flipped to white in light
 * mode would vanish on a bright photo. The chips use the shared scrim; the
 * upload veil is lighter on purpose - it dims the picture without hiding it
 * while the bar below reports progress - and there is no token at that weight.
 */
const UPLOAD_VEIL = withOpacity(mediaColors.stage, 0.42);

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One attachment. Carries its position (order is what the carousel shows), its
 * kind, and its own upload state - a fill bar with a real percentage rather
 * than one spinner for the whole batch, because "it is working" and "it is
 * three quarters through the second video" are different pieces of news.
 *
 * Video has no thumbnail: `expo-image` cannot decode a frame and there is no
 * thumbnailer in this app's dependency set. Rather than show a broken image, a
 * video tile is a dark well with a play glyph and its duration, which is
 * honest and reads instantly.
 */
export function MediaTile({
	file,
	ordinal,
	locked,
	onRemove,
}: {
	file: ComposerMedia;
	ordinal: number;
	locked: boolean;
	onRemove: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const failed = file.status === "failed";
	const done = file.status === "uploaded";

	return (
		<View
			accessible
			accessibilityLabel={`${file.kind === "VIDEO" ? "Video" : "Photo"} ${ordinal}, ${
				failed
					? `failed: ${file.error ?? "upload error"}`
					: done
						? "uploaded"
						: file.status === "uploading"
							? `${Math.round(file.progress * 100)} percent uploaded`
							: "ready"
			}`}
			style={{
				width: TILE,
				height: TILE,
				borderRadius: borderRadius.lg,
				overflow: "hidden",
				backgroundColor: colors.background.tertiary,
				borderWidth: failed ? 1 : 0,
				borderColor: colors.error.main,
			}}
		>
			{file.kind === "IMAGE" ? (
				<Image
					source={{ uri: file.uri }}
					contentFit="cover"
					accessibilityIgnoresInvertColors
					style={{ width: "100%", height: "100%" }}
				/>
			) : (
				<View
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
						gap: spacing[1],
						backgroundColor: colors.background.overlay,
					}}
				>
					<Play
						size={20}
						color={colors.text.secondary as string}
						strokeWidth={2}
						fill={colors.text.secondary as string}
					/>
					{file.durationMs ? (
						<Caption color="tertiary" weight="medium">
							{formatDuration(file.durationMs)}
						</Caption>
					) : null}
				</View>
			)}

			{/* Position. Order is meaningful - it is `sortOrder` on the server. */}
			<View
				style={{
					position: "absolute",
					top: 4,
					left: 4,
					minWidth: 18,
					height: 18,
					paddingHorizontal: 5,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: mediaColors.scrim,
				}}
			>
				{/* Pinned at 1x: the chip is a fixed 18pt circle, and a scaled
				    numeral would burst it long before it became easier to read. */}
				<Micro weight="bold" color={mediaColors.ink} maxFontSizeMultiplier={1}>
					{ordinal}
				</Micro>
			</View>

			{!locked && (
				<Pressable
					onPress={onRemove}
					accessibilityRole="button"
					accessibilityLabel={`Remove ${file.kind === "VIDEO" ? "video" : "photo"} ${ordinal}`}
					// 22pt drawn, 44pt touched: the badge stays small over the
					// photo, the finger target does not.
					hitSlop={11}
					style={{
						position: "absolute",
						top: 4,
						right: 4,
						width: 22,
						height: 22,
						borderRadius: 11,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: mediaColors.scrim,
					}}
				>
					<X size={12} color={mediaColors.ink} strokeWidth={2.6} />
				</Pressable>
			)}

			{file.status === "uploading" && (
				<>
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							bottom: 0,
							left: 0,
							backgroundColor: UPLOAD_VEIL,
						}}
					/>
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							right: 0,
							bottom: 0,
							left: 0,
							height: 4,
							backgroundColor: mediaColors.track,
						}}
					>
						<View
							style={{
								width: `${Math.max(4, file.progress * 100)}%`,
								height: "100%",
								backgroundColor: colors.primary.main,
							}}
						/>
					</View>
				</>
			)}

			{done && (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						bottom: 4,
						right: 4,
						width: 20,
						height: 20,
						borderRadius: 10,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.success.main,
					}}
				>
					<Check
						size={12}
						color={colors.success.contrast as string}
						strokeWidth={3}
					/>
				</View>
			)}

			{failed && (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						bottom: 4,
						right: 4,
						width: 20,
						height: 20,
						borderRadius: 10,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.error.main,
					}}
				>
					{/* `error` has no `contrast` token; this badge sits on the
					    picture, so it takes the media ink like the chips above. */}
					<AlertTriangle size={11} color={mediaColors.ink} strokeWidth={2.6} />
				</View>
			)}
		</View>
	);
}

export function AddTile({
	busy,
	disabled,
	onPress,
}: {
	busy: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={busy || disabled}
			accessibilityRole="button"
			accessibilityLabel="Add photos or video"
			accessibilityState={{ disabled: busy || disabled, busy }}
			{...focusable}
			style={({ pressed, hovered }) => ({
				width: TILE,
				height: TILE,
				borderRadius: borderRadius.lg,
				alignItems: "center",
				justifyContent: "center",
				gap: spacing[1],
				borderWidth: 1,
				borderStyle: "dashed",
				borderColor: colors.border.dark,
				backgroundColor:
					pressed || hovered ? colors.background.subtle : "transparent",
				opacity: disabled ? 0.5 : 1,
			})}
		>
			<ImagePlus
				size={19}
				color={colors.text.tertiary as string}
				strokeWidth={1.9}
			/>
			<Caption color="tertiary" weight="medium">
				{busy ? "Opening…" : "Add"}
			</Caption>
		</Pressable>
	);
}
