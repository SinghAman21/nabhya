import type { PostTag } from "@nabhya/shared";
import {
	CalendarDays,
	FileClock,
	HeartHandshake,
	ImagePlus,
} from "lucide-react-native";
import { View } from "react-native";
import { InitialAvatar } from "@/components/initial-avatar";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable } from "@/lib/focus";

/* -------------------------------------------------------------------------- */
/* Trigger                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The composer prompt at the top of the feed.
 *
 * Two rows on one card: the invitation, then the shortcuts, divided by a
 * full-bleed hairline. It sits in the feed rather than behind a "+" because a
 * feed an NGO cannot post to reads as somebody else's product, and the second
 * row exists because "share an update" is a blank page - the shortcuts under
 * it name what you might actually be about to do, and each opens the composer
 * already in that state rather than dropping you on the same blank page.
 * Three on a phone, four where there is room for Event; see the note beside
 * it.
 *
 * What the crude first version got wrong, and what fixed it:
 *
 * - **The prompt was 12px type in a 40pt pill.** A `Caption` floating in that
 *   much space reads as a disabled field rather than an invitation. It is
 *   `Body` in a 46pt pill now, which is the size a real input would be.
 * - **The shortcuts were three `flex: 1` buttons.** Stretched to thirds of the
 *   card they read as a segmented control - three tabs, not three shortcuts.
 *   They are compact and left-aligned now, and the space to their right is
 *   deliberate.
 * - **The icons were bare tertiary glyphs.** Each sits in a tinted well, which
 *   is the same treatment as the dashboard's Create tiles, so the two surfaces
 *   that offer creation look related instead of merely adjacent.
 * - **The divider stopped short of the card edges.** Full-bleed reads as two
 *   bands of one card; inset reads as a rule someone dropped in the middle.
 *
 * Labels shorten on a phone rather than truncating. An earlier version kept
 * the long ones at every width and, in the ~330pt a feed column had at the
 * time, rendered "Photo o…" and "Need u…" - three controls nobody could read.
 */
export function PostComposerBar({
	onCompose,
	name,
	disabledReason,
}: {
	/**
	 * `withMedia` opens the composer and the picker together; `drafts` lands on
	 * the drafts list; `tag` pre-selects the type.
	 */
	onCompose: (options?: {
		tag?: PostTag;
		withMedia?: boolean;
		drafts?: boolean;
	}) => void;
	name: string | null | undefined;
	/** When set, the bar explains why it cannot post instead of inviting one. */
	disabledReason?: string;
}) {
	const { colors, spacing, borderRadius, elevation, isDark } = useTheme();
	const { isDesktop } = useMedia();

	return (
		<View
			style={{
				backgroundColor: colors.background.card,
				borderRadius: borderRadius["2xl"],
				padding: spacing[4],
				...(isDark ? {} : elevation.card),
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				<InitialAvatar name={name} size={40} square />
				<Pressable
					onPress={() => onCompose()}
					disabled={!!disabledReason}
					accessibilityRole="button"
					accessibilityLabel={disabledReason ?? "Write a post"}
					accessibilityState={{ disabled: !!disabledReason }}
					{...focusable}
					style={({ pressed, hovered }) => ({
						flex: 1,
						minWidth: 0,
						minHeight: 46,
						justifyContent: "center",
						paddingHorizontal: spacing[4],
						borderRadius: 999,
						backgroundColor:
							pressed || hovered
								? colors.background.tertiary
								: colors.background.subtle,
						opacity: disabledReason ? 0.7 : 1,
					})}
				>
					<Body
						color={disabledReason ? "quaternary" : "tertiary"}
						numberOfLines={1}
					>
						{disabledReason ?? "Share an update…"}
					</Body>
				</Pressable>
			</View>

			{!disabledReason && (
				<>
					{/* Full-bleed: pulled out to the card's edges so the card reads
					    as two bands rather than as a rule dropped in the middle. */}
					<View
						style={{
							height: 1,
							marginTop: spacing[4],
							marginBottom: spacing[3],
							marginHorizontal: -spacing[4],
							backgroundColor: colors.border.hairline,
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[2],
						}}
					>
						<Shortcut
							icon={ImagePlus}
							label={isDesktop ? "Photo or video" : "Photo"}
							onPress={() => onCompose({ withMedia: true })}
						/>
						{/*
						 * "Need", not "About a need", and a `HeartHandshake` rather
						 * than a `Link2`: this opens the form that *creates* one
						 * now, so the old label and the chain-link icon both
						 * described the reference tool, which has moved to the
						 * Update. Naming it after the thing it makes is also what
						 * lets it match the Needs tab and the dashboard's Create
						 * row, which are the two other doors onto the same act.
						 */}
						<Shortcut
							icon={HeartHandshake}
							label="Need"
							onPress={() => onCompose({ tag: "NEED" })}
						/>
						{/*
						 * Event only where there is room. Four pills need ~390pt and
						 * a feed column on a phone has ~330 - and the labels here
						 * cannot shorten any further without becoming initials. The
						 * type is one tap away inside the composer either way, so
						 * the phone loses a shortcut, not a capability.
						 */}
						{isDesktop && (
							<Shortcut
								icon={CalendarDays}
								label="Event"
								onPress={() => onCompose({ tag: "EVENT" })}
							/>
						)}
						<Shortcut
							icon={FileClock}
							label="Drafts"
							onPress={() => onCompose({ drafts: true })}
						/>
					</View>
				</>
			)}
		</View>
	);
}

/**
 * One shortcut: a tinted icon well and a word, in a pill sized to its content.
 *
 * The well is `primary.tint` with a `primary.ink` glyph - brand as *ink*, never
 * `primary.main`, which is a fill and fails AA for a 15px icon. Same recipe as
 * the dashboard's Create tiles on purpose.
 *
 * The well is a **circle**, not the `borderRadius.sm` square it started as.
 * The control around it is a 999 pill, so the two radii sat inside one another
 * and disagreed - a rounded rectangle floating in a capsule, the corner gap
 * widest exactly where the hover fill makes it visible. Concentric radii or
 * none: a pill wants a disc inside it.
 */
export function Shortcut({
	icon: Icon,
	label,
	onPress,
}: {
	icon: typeof ImagePlus;
	label: string;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={4}
			{...focusable}
			style={({ pressed, hovered }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2],
				paddingLeft: spacing[1],
				paddingRight: spacing[3],
				paddingVertical: spacing[1],
				borderRadius: 999,
				backgroundColor:
					pressed || hovered ? colors.background.subtle : "transparent",
			})}
		>
			<View
				style={{
					width: 28,
					height: 28,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.primary.tint,
				}}
			>
				<Icon size={15} color={colors.primary.ink as string} strokeWidth={2} />
			</View>
			<Caption color="secondary" weight="medium" numberOfLines={1}>
				{label}
			</Caption>
		</Pressable>
	);
}
