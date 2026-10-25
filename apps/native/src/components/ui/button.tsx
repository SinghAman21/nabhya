import { ActivityIndicator, View, type ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Label } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";

const variantStyles = {
	default: {
		bg: "primary.main" as string,
		text: "primary.contrast" as string,
		bgActive: "primary.dark" as string | undefined,
		border: undefined as string | undefined,
	},
	destructive: {
		bg: "error.main" as string,
		text: "inverse" as string,
		bgActive: "error.dark" as string | undefined,
		border: undefined as string | undefined,
	},
	outline: {
		bg: "transparent" as string,
		text: "text.primary" as string,
		bgActive: "background.tertiary" as string | undefined,
		border: "border.medium" as string | undefined,
	},
	ghost: {
		bg: "transparent" as string,
		text: "text.primary" as string,
		bgActive: "background.tertiary" as string | undefined,
		border: undefined as string | undefined,
	},
	link: {
		bg: "transparent" as string,
		text: "primary.ink" as string,
		bgActive: undefined as string | undefined,
		border: undefined as string | undefined,
	},
} as const;

const sizeStyles = {
	default: { py: 3, px: 5, iconSize: 44, minHeight: 48 },
	sm: { py: 2, px: 3.5, iconSize: 36, minHeight: 38 },
	lg: { py: 4, px: 6, iconSize: 52, minHeight: 56 },
	icon: { py: 0, px: 0, iconSize: 44, minHeight: 44 },
} as const;

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

/** `pressed` is RN; `focused`/`hovered` are react-native-web additions. */
type PressableState = {
	pressed: boolean;
	focused?: boolean;
	hovered?: boolean;
};

interface ButtonProps
	extends Omit<React.ComponentProps<typeof Pressable>, "style"> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	/** A mark before the label - a provider logo, never a decorative icon. */
	leading?: React.ReactNode;
	children: React.ReactNode;
	style?: ViewStyle;
}

function resolveColor(
	colors: ReturnType<typeof useTheme>["colors"],
	path: string,
): string {
	if (path === "transparent") return "transparent";
	const parts = path.split(".");
	let obj: unknown = colors;
	for (const part of parts) {
		if (
			obj &&
			typeof obj === "object" &&
			part in (obj as Record<string, unknown>)
		) {
			obj = (obj as Record<string, unknown>)[part];
		} else {
			return path;
		}
	}
	return obj as string;
}

export function Button({
	variant = "default",
	size = "default",
	loading,
	leading,
	disabled,
	children,
	style,
	...props
}: ButtonProps) {
	const { colors, borderRadius, spacing } = useTheme();
	const v = variantStyles[variant];
	const s = sizeStyles[size];

	return (
		<Pressable
			// `sm` draws at 38pt, under the 44pt touch minimum. Four points of
			// slop on every side make the *target* 46 without changing the drawn
			// size - it sits in table rows and footers where 44 would look
			// bloated. A caller's own `hitSlop` still wins (spread below).
			hitSlop={size === "sm" ? 4 : undefined}
			disabled={disabled || loading}
			accessibilityRole="button"
			accessibilityState={{
				disabled: !!disabled || !!loading,
				busy: !!loading,
			}}
			{...focusable}
			style={(state) => {
				// react-native-web also reports `focused` and `hovered` here; native
				// only ever sets `pressed`.
				const { pressed, hovered } = state as PressableState;
				const isIcon = size === "icon";
				// RN 0.88's `ViewStyle` is readonly; this one is built up below.
				const base: { -readonly [K in keyof ViewStyle]: ViewStyle[K] } = {
					backgroundColor:
						pressed && v.bgActive
							? resolveColor(colors, v.bgActive)
							: resolveColor(colors, v.bg),
					paddingVertical: spacing[s.py as keyof typeof spacing],
					paddingHorizontal: spacing[s.px as keyof typeof spacing],
					borderRadius: borderRadius.lg,
					minHeight: s.minHeight,
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "row",
					gap: spacing[2],
					opacity: disabled || loading ? 0.5 : 1,
					// Respond on press-down, not on release. A scale this small reads as
					// the surface taking the touch rather than as an animation.
					transform: [{ scale: pressed ? 0.98 : 1 }],
				};
				if (hovered && !pressed && v.bgActive) {
					base.backgroundColor = resolveColor(colors, v.bgActive);
				}
				if (isIcon) {
					base.width = s.iconSize;
					base.height = s.iconSize;
				}
				if (v.border) {
					base.borderWidth = 1;
					base.borderColor = resolveColor(colors, v.border);
				}
				return Object.assign(base, style);
			}}
			{...props}
		>
			{/* The label stays laid out while loading, just invisible, and the
			    spinner sits over it. Swapping one for the other collapsed every
			    button sized to its label to a 20pt spinner mid-press, which
			    shifted the whole row it sat in. */}
			{leading ? (
				<View style={loading ? { opacity: 0 } : undefined}>{leading}</View>
			) : null}
			<Label
				color={resolveColor(colors, v.text)}
				weight={variant === "link" ? "medium" : "bold"}
				numberOfLines={1}
				style={loading ? { opacity: 0 } : undefined}
			>
				{children}
			</Label>
			{loading ? (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						left: 0,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<ActivityIndicator
						size="small"
						color={resolveColor(colors, v.text)}
					/>
				</View>
			) : null}
		</Pressable>
	);
}
