import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip } from "@/components/ui/tooltip";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

/**
 * The composer's own small chrome: the inline panel, the round icon control and
 * the tool-bar button.
 *
 * Lifted out of `post-composer.tsx` because none of it knows anything about
 * posting - they are three generic controls that happen to have been written
 * there first, and keeping them there made the file's shape ("a trigger, a
 * drawer, some field groups") harder to see than it needed to be.
 */

/* -------------------------------------------------------------------------- */
/* Chrome pieces                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A picker that opens above the writing area rather than as a second modal.
 *
 * A sheet over a sheet is a stack no phone back gesture unwinds predictably,
 * and on the web it is two stacked backdrops. Inline costs one container and
 * keeps the composer a single surface.
 */
export function InlinePanel({ children }: { children: React.ReactNode }) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			style={{
				marginBottom: spacing[4],
				padding: spacing[2],
				borderRadius: borderRadius.lg,
				backgroundColor: colors.background.subtle,
			}}
		>
			{children}
		</View>
	);
}

/** A round icon-only control: close, and discard-a-draft. */
export function IconPill({
	icon: Icon,
	label,
	onPress,
	disabled,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !!disabled }}
			hitSlop={6}
			{...focusable}
			style={({ pressed, hovered }) => ({
				width: 34,
				height: 34,
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor:
					pressed || hovered
						? colors.background.tertiary
						: colors.background.subtle,
				opacity: disabled ? 0.45 : 1,
			})}
		>
			<Icon
				size={16}
				color={colors.text.secondary as string}
				strokeWidth={2.2}
			/>
		</Pressable>
	);
}

/**
 * One tool-bar control.
 *
 * These are the only icon-only controls in the app allowed to stand without a
 * visible word, and they earn it the way a text editor's toolbar does: a fixed
 * row in a fixed place, four of them, each with an accessibility label that
 * also states *why* it is disabled when it is. The `note` line above the row
 * carries the same reason for everyone else.
 */
export function Tool({
	icon: Icon,
	label,
	tip,
	onPress,
	disabled,
	active,
	busy,
	badge,
}: {
	icon: LucideIcon;
	/** The accessibility label. States the reason when disabled. */
	label: string;
	/** The hover bubble. Two or three words; `label` carries the long form. */
	tip: string;
	onPress: () => void;
	disabled?: boolean;
	active?: boolean;
	busy?: boolean;
	/** A count in the corner, e.g. how many drafts are waiting. */
	badge?: number;
}) {
	const { colors } = useTheme();

	return (
		<Tooltip label={tip}>
			<Pressable
				onPress={onPress}
				disabled={disabled || busy}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{
					disabled: !!disabled || !!busy,
					busy: !!busy,
					...(active === undefined ? {} : { selected: active }),
				}}
				hitSlop={4}
				{...focusable}
				style={({ pressed, hovered }) => ({
					width: 36,
					height: 36,
					// A disc, not a rounded square: this is a 36pt icon-only
					// control whose only visible state is a hover/active fill, and
					// that fill reads as a smudge unless it is concentric with the
					// glyph. `IconPill` and the composer bar's wells are the same.
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: active
						? colors.background.tertiary
						: pressed || hovered
							? colors.background.subtle
							: "transparent",
					opacity: disabled ? 0.35 : 1,
				})}
			>
				<Icon
					size={19}
					strokeWidth={1.9}
					color={
						active
							? (colors.text.primary as string)
							: (colors.text.tertiary as string)
					}
				/>
				{badge !== undefined && badge > 0 && (
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							top: 2,
							right: 2,
							minWidth: 14,
							height: 14,
							paddingHorizontal: 3,
							borderRadius: 999,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.primary.main,
						}}
					>
						<Caption
							weight="bold"
							style={{ color: colors.primary.contrast as string, fontSize: 9 }}
						>
							{badge}
						</Caption>
					</View>
				)}
			</Pressable>
		</Tooltip>
	);
}
