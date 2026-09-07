import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useTheme } from "@/hooks/use-theme";
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
 *
 * It renders on desktop too. It used to return `null` there on the theory that
 * the browser's own back button and the sidebar cover it — but half the app's
 * pushed pages (notifications, bookmarks, a certificate, an NGO's public page)
 * are not sidebar destinations, so on the web they opened with no visible way
 * back and a header whose title sat where the control should be. Chrome's back
 * button is also the *browser's* history, not the app's: it is one row of
 * pixels outside the viewport, and a keyboard user tabbing the page never
 * reaches it.
 */
export function BackButton({
	hitSlop = 8,
	size = 24,
	color,
	style,
	fallbackHref = "/",
}: BackButtonProps) {
	const { colors } = useTheme();
	const router = useRouter();

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
