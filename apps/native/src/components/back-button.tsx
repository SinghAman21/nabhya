import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { focusable } from "@/lib/focus";

interface BackButtonProps {
	hitSlop?: number;
	size?: number;
	color?: string;
	style?: ViewStyle;
	/** Falls back to `/` when there is nothing to go back to (deep link, reload). */
	fallbackHref?: string;
}

/**
 * A real control, not a floating glyph: a 40pt round target on a subtle fill
 * so it reads as tappable and lines up with the 40pt icon buttons in headers.
 * A chevron rather than an arrow — it is the platform's own "back" glyph and
 * reads as navigation, where an arrow reads as an action. `ScreenHeader back`
 * lays it out inline with the title; the two hero screens (event, NGO) place
 * it themselves.
 */
export function BackButton({
	hitSlop = 8,
	size = 24,
	color,
	style,
	fallbackHref = "/",
}: BackButtonProps) {
	const { isDesktop } = useMedia();
	const { colors } = useTheme();
	const router = useRouter();

	if (isDesktop) return null;

	const goBack = () => {
		if (router.canGoBack()) router.back();
		else router.replace(fallbackHref as never);
	};

	return (
		<Pressable
			onPress={goBack}
			hitSlop={hitSlop}
			accessibilityRole="button"
			accessibilityLabel="Go back"
			{...focusable}
			style={({ pressed }) => ({
				width: 40,
				height: 40,
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				alignSelf: "flex-start",
				backgroundColor: pressed
					? colors.background.tertiary
					: colors.background.subtle,
				...style,
			})}
		>
			<ChevronLeft
				size={size}
				strokeWidth={2.4}
				style={{ marginLeft: -2 }}
				color={color ?? (colors.text.primary as string)}
			/>
		</Pressable>
	);
}
