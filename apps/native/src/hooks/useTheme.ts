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

export function useTheme() {
	const { isDark } = useAppTheme();

	return {
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
	} as const;
}
