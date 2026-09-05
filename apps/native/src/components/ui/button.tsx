import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";
import { Body } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

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
		text: "primary.main" as string,
		bgActive: undefined as string | undefined,
		border: undefined as string | undefined,
	},
} as const;

const sizeStyles = {
	default: { py: 3.5, px: 4, iconSize: 44 },
	sm: { py: 2, px: 3, iconSize: 36 },
	lg: { py: 5, px: 6, iconSize: 52 },
	icon: { py: 0, px: 0, iconSize: 44 },
} as const;

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

interface ButtonProps
	extends Omit<React.ComponentProps<typeof Pressable>, "style"> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
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
			disabled={disabled || loading}
			style={({ pressed }) => {
				const isIcon = size === "icon";
				const base: ViewStyle = {
					backgroundColor:
						pressed && v.bgActive
							? resolveColor(colors, v.bgActive)
							: resolveColor(colors, v.bg),
					paddingVertical: spacing[s.py as keyof typeof spacing],
					paddingHorizontal: spacing[s.px as keyof typeof spacing],
					borderRadius: borderRadius.lg,
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "row",
					gap: spacing[2],
					opacity: disabled || loading ? 0.5 : 1,
				};
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
			{loading ? (
				<ActivityIndicator size="small" color={resolveColor(colors, v.text)} />
			) : (
				<Body
					color={resolveColor(colors, v.text)}
					weight={variant === "link" ? "medium" : "bold"}
				>
					{children}
				</Body>
			)}
		</Pressable>
	);
}
