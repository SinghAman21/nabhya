import { usePathname, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { focusable, type PressState } from "@/lib/focus";

/**
 * Pages that are *places you go*, not pages you drill into.
 *
 * On desktop web each of these is reached from persistent chrome - the rail,
 * the top bar, the account menu - and that chrome stays on screen while the
 * page is open. A back chevron there is a second, worse answer to "how do I
 * leave": the rail is the way out, and a chevron beside a sidebar read as a
 * page that had lost its place in the app. So on desktop they draw no back
 * button and a top-level title.
 *
 * Exact pathnames, not prefixes: `/certificates` is the list (a destination)
 * but `/certificates/ABC123` is one certificate (a detail page, keeps back).
 * Expo Router pathnames drop route groups, so `(volunteer)/activity` is
 * `/activity`.
 *
 * Phones ignore this list entirely: every pushed page keeps its back button,
 * because on a phone there is no rail - the chevron *is* the way out.
 */
export const NAV_DESTINATIONS: readonly string[] = [
	"/notifications",
	"/impact",
	"/certificates",
	"/bookmarks",
	"/following",
	"/saved",
	"/verify-identity",
	"/edit-profile",
];

function normalise(pathname: string) {
	const trimmed = pathname.replace(/\/+$/, "");
	return trimmed === "" ? "/" : trimmed;
}

/** Whether `pathname` is one of `NAV_DESTINATIONS`. */
export function isNavDestination(pathname: string) {
	return NAV_DESTINATIONS.includes(normalise(pathname));
}

/**
 * The back-button rule, in one place. `false` on desktop web for a
 * `NAV_DESTINATIONS` page; `true` everywhere else - every page on a phone, and
 * every detail page (`events/[id]`, `ngos/[id]`, `needs/[id]`,
 * `certificates/[code]`) on desktop.
 */
export function useShowBack() {
	const { isDesktop } = useMedia();
	const pathname = usePathname();
	return !(isDesktop && isNavDestination(pathname));
}

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
 * A chevron rather than an arrow - it is the platform's own "back" glyph and
 * reads as navigation, where an arrow reads as an action. `ScreenHeader back`
 * lays it out inline with the title; the two hero screens (event, NGO) place
 * it themselves.
 *
 * It renders on desktop for detail pages: those are not rail destinations, and
 * the browser's own back button is the *browser's* history - outside the
 * viewport, never reached by tabbing the page. It renders nothing on a desktop
 * `NAV_DESTINATIONS` page; see `useShowBack`.
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
	const show = useShowBack();

	if (!show) return null;

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
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					width: 40,
					height: 40,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					alignSelf: "flex-start",
					backgroundColor: pressed
						? colors.background.overlay
						: hovered
							? colors.background.tertiary
							: colors.background.subtle,
					...style,
				};
			}}
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
