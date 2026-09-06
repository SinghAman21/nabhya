import { Platform, useWindowDimensions } from "react-native";

const MOBILE_BREAKPOINT = 768;

export function useMedia() {
	const { width } = useWindowDimensions();
	const isWeb = Platform.OS === "web";

	return {
		isWeb,
		isMobile: !isWeb || width < MOBILE_BREAKPOINT,
		isDesktop: isWeb && width >= MOBILE_BREAKPOINT,
		width,
	} as const;
}

/**
 * How many card columns a list screen gets. Phones stay single-column;
 * desktop graduates with the window so cards sit ~350–550px wide instead of
 * stretching full-bleed: one column under 1100px, two to 1440px, three above.
 * Every grid list reads this, so the breakpoint never drifts per screen.
 */
export function useGridColumns() {
	const { width, isDesktop } = useMedia();
	if (!isDesktop) return 1;
	if (width >= 1440) return 3;
	if (width >= 1100) return 2;
	return 1;
}
