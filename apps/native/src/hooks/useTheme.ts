import { useMemo } from "react";
import {
	animation,
	borderRadius,
	darkColors,
	elevation,
	getContrastColor,
	getShadow,
	isLightColor,
	layout,
	lightColors,
	opacity,
	shadows,
	spacing,
	typography,
	withOpacity,
} from "@/constants/design-system";
import { useAppTheme } from "@/hooks/useAppTheme";

/**
 * Memoised on `isDark`, and everything inside it is a module constant, so the
 * object identity is stable for the life of a theme.
 *
 * This matters beyond render cost: the returned object gets spread into props
 * and passed to navigators. Returning a fresh object every render made
 * `screenOptions` a new value on every pass, which React Navigation treats as a
 * change, re-renders for, and so produces a new value again — "Maximum update
 * depth exceeded", reported against whichever navigator happened to be nearest.
 */
export function useTheme() {
	const { isDark } = useAppTheme();

	return useMemo(
		() =>
			({
				isDark,
				colors: isDark ? darkColors : lightColors,
				typography,
				spacing,
				borderRadius,
				shadows,
				elevation,
				layout,
				animation,
				opacity,
				getShadow,
				withOpacity,
				getContrastColor,
				isLightColor,
			}) as const,
		[isDark],
	);
}
