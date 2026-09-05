import {
	animation,
	borderRadius,
	darkColors,
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
import { useAppTheme } from "@/hooks/use-app-theme";

export function useTheme() {
	const { isDark } = useAppTheme();

	return {
		isDark,
		colors: isDark ? darkColors : lightColors,
		typography,
		spacing,
		borderRadius,
		shadows,
		layout,
		animation,
		opacity,
		getShadow,
		withOpacity,
		getContrastColor,
		isLightColor,
	} as const;
}
