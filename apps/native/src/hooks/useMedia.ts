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
