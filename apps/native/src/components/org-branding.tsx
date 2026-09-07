import { Image } from "expo-image";
import { Camera, ImagePlus } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { InitialAvatar } from "@/components/initial-avatar";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * An organisation's two images: the cover band and the logo.
 *
 * Both are stored as **object keys in a private bucket**, never URLs, so
 * nothing here can render a record field directly — `useStoredImageUrl` swaps
 * the key for a short-lived signed URL first, and every piece below falls back
 * to something designed rather than to a broken-image glyph. That fallback is
 * the normal case in two situations, not an edge one: an NGO that has not
 * uploaded anything, and any developer running without `R2_*` credentials,
 * where the storage stub has no URL to sign.
 *
 * The recommended sizes are stated in the UI rather than only here, because the
 * person choosing a file is the one who needs them.
 */

/** 4:1. Wide enough to survive the crop on a phone without becoming a stripe. */
export const COVER_ASPECT = 4;
export const COVER_HINT = "Wide image, 1600×400 or larger";
export const LOGO_HINT = "Square image, at least 400×400";

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

/* -------------------------------------------------------------------------- */
/* Cover                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The cover band. Fixed height rather than an aspect ratio, because it sits at
 * the top of a page whose layout below it should not move as the window widens.
 */
export function OrgCover({
	imageKey,
	height,
	action,
	empty = "No cover photo yet",
}: {
	imageKey: string | null | undefined;
	height: number;
	/** Drawn in the top-right corner — the change control, on an owner's view. */
	action?: React.ReactNode;
	empty?: string;
}) {
	const { colors, spacing } = useTheme();
	const url = useStoredImageUrl(imageKey);

	return (
		<View
			style={{
				height,
				backgroundColor: colors.primary.tint,
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			{url ? (
				<Image
					source={{ uri: url }}
					contentFit="cover"
					style={{ width: "100%", height: "100%" }}
					accessibilityIgnoresInvertColors
				/>
			) : (
				<Caption color={colors.primary.ink as string} weight="medium">
					{empty}
				</Caption>
			)}
			{action ? (
				<View
					style={{
						position: "absolute",
						top: spacing[3],
						right: spacing[3],
					}}
				>
					{action}
				</View>
			) : null}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Logo                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The logo as a rounded square — `InitialAvatar`'s `square` shape is this
 * codebase's mark for an organisation rather than a person, and the initials
 * are the fallback when there is no uploaded file.
 *
 * `ring` draws a card-coloured band around it, which is what lets the logo
 * overlap the cover without the two images touching. There is deliberately no
 * verified tick on the corner: the hero states verification in words on the
 * line under the name, and a badge repeating it is one more thing a screen
 * reader stops on to say what the sentence beside it already said.
 */
export function OrgLogo({
	name,
	imageKey,
	size,
	ring,
	badge,
}: {
	name: string | null | undefined;
	imageKey: string | null | undefined;
	size: number;
	ring?: boolean;
	/** An owner's change control, drawn over the bottom-right corner. */
	badge?: React.ReactNode;
}) {
	const { colors, borderRadius } = useTheme();
	const url = useStoredImageUrl(imageKey);
	const ringWidth = ring ? 4 : 0;
	const radius = size / 3.2;

	return (
		<View style={{ position: "relative" }}>
			<View
				style={{
					borderRadius: radius + ringWidth / 2,
					backgroundColor: ring ? colors.background.card : "transparent",
					padding: ringWidth,
				}}
			>
				{url ? (
					<Image
						source={{ uri: url }}
						contentFit="cover"
						style={{
							width: size,
							height: size,
							borderRadius: radius,
							backgroundColor: colors.background.subtle,
						}}
						accessibilityIgnoresInvertColors
					/>
				) : (
					<InitialAvatar name={name} size={size} square />
				)}
			</View>

			{badge ? (
				<View
					style={{
						position: "absolute",
						bottom: -2,
						right: -2,
						borderRadius: borderRadius.full,
						backgroundColor: colors.background.card,
					}}
				>
					{badge}
				</View>
			) : null}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Owner controls                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The small circular camera control that sits on a cover or a logo.
 *
 * Icon-only, so it carries a real `accessibilityLabel` — and per the tooltip
 * rule in `apps/native/AGENTS.md` it is never the only explanation of the
 * action: on the profile hero it points at the edit screen, where the same two
 * images appear as labelled slots.
 */
export function ImageEditButton({
	label,
	onPress,
	busy,
	size = 34,
}: {
	label: string;
	onPress: () => void;
	busy?: boolean;
	size?: number;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: Boolean(busy) }}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					width: size,
					height: size,
					borderRadius: size / 2,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 1,
					borderColor: colors.border.medium,
					backgroundColor:
						pressed || hovered
							? colors.background.subtle
							: colors.background.card,
				};
			}}
		>
			{busy ? (
				<ActivityIndicator
					size="small"
					color={colors.text.tertiary as string}
				/>
			) : (
				<Camera
					size={size * 0.5}
					strokeWidth={2}
					color={colors.text.secondary as string}
				/>
			)}
		</Pressable>
	);
}

/**
 * A labelled image slot, for the edit screen.
 *
 * The whole slot is the control — a preview you press to replace, rather than a
 * preview with a button beside it — so there is one target and it is the thing
 * you are looking at. Empty state says what to provide and at what size; a
 * filled one says how to change it, because a preview alone does not tell you
 * it is pressable.
 */
export function ImagePickerSlot({
	label,
	hint,
	imageKey,
	localUri,
	aspectRatio,
	width,
	rounded,
	busy,
	onPress,
	onClear,
}: {
	label: string;
	hint: string;
	imageKey: string | null | undefined;
	/** A just-picked file, shown before the record round-trips. */
	localUri?: string | null;
	aspectRatio?: number;
	/** Fixed width, for the square logo slot. */
	width?: number;
	rounded?: boolean;
	busy?: boolean;
	onPress: () => void;
	/** Offered only once there is something to remove. */
	onClear?: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	const storedUrl = useStoredImageUrl(imageKey);
	const uri = localUri ?? storedUrl;

	return (
		<View style={{ marginBottom: spacing[5] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: spacing[1.5],
				}}
			>
				<Label>{label}</Label>
				{uri && onClear ? (
					<Pressable
						onPress={onClear}
						accessibilityRole="button"
						accessibilityLabel={`Remove ${label.toLowerCase()}`}
						{...focusable}
						style={{ paddingHorizontal: spacing[1] }}
					>
						<Caption color="tertiary" weight="medium">
							Remove
						</Caption>
					</Pressable>
				) : null}
			</View>

			<Pressable
				onPress={onPress}
				disabled={busy}
				accessibilityRole="button"
				accessibilityLabel={
					uri ? `Change ${label.toLowerCase()}. ${hint}` : `${label}. ${hint}`
				}
				accessibilityState={{ disabled: Boolean(busy) }}
				{...focusable}
				style={(state) => {
					const { pressed, hovered } = state as PressState;
					return {
						width: width ?? "100%",
						...(aspectRatio ? { aspectRatio } : {}),
						...(width ? { height: width } : {}),
						borderRadius: rounded ? borderRadius.lg : borderRadius.md,
						borderWidth: uri ? 0 : 1,
						// Dashed only while empty: a border around a photo is a frame,
						// but a border around nothing is the drop zone.
						borderStyle: uri ? "solid" : "dashed",
						borderColor: colors.border.dark,
						backgroundColor:
							pressed || hovered
								? colors.background.subtle
								: colors.background.tertiary,
						alignItems: "center",
						justifyContent: "center",
						overflow: "hidden",
					};
				}}
			>
				{uri ? (
					<Image
						source={{ uri }}
						contentFit="cover"
						style={{ width: "100%", height: "100%" }}
						accessibilityIgnoresInvertColors
					/>
				) : (
					<View style={{ alignItems: "center", gap: spacing[1] }}>
						<ImagePlus
							size={20}
							strokeWidth={1.75}
							color={colors.text.quaternary as string}
						/>
						<Caption color="quaternary">Add</Caption>
					</View>
				)}

				{busy ? (
					<View
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							bottom: 0,
							left: 0,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.background.overlay,
							opacity: 0.85,
						}}
					>
						<ActivityIndicator color={colors.text.tertiary as string} />
					</View>
				) : null}
			</Pressable>

			<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
				{uri ? `${hint}. Tap to replace.` : hint}
			</Caption>
		</View>
	);
}
