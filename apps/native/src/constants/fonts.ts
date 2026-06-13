import { typography } from "./design-system";

export const fonts = typography.fontFamily;

export const fontByWeight = {
	light: fonts.sansLight,
	normal: fonts.sans,
	medium: fonts.sansMedium,
	semibold: fonts.sansBold,
	bold: fonts.sansBold,
} as const;

export const displayByWeight = {
	light: fonts.display,
	normal: fonts.display,
	medium: fonts.display,
	semibold: fonts.display,
	bold: fonts.display,
} as const;
