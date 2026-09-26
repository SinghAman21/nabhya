import { typography } from "./design-system";

export const fonts = typography.fontFamily;

export const fontByWeight = {
	light: fonts.sansLight,
	normal: fonts.sans,
	medium: fonts.sansMedium,
	semibold: fonts.sansBold,
	bold: fonts.sansBold,
} as const;

/**
 * NeutralFace ships in two weights and both are loaded in `app/_layout.tsx`.
 *
 * Display type defaults to the **bold** face: it is used for screen titles and
 * numerals, which need the weight. The regular face is reachable at `light` for
 * the rare large-and-quiet heading - mapping `normal` to it made every title in
 * the app render thin.
 */
export const displayByWeight = {
	light: fonts.displayRegular,
	normal: fonts.display,
	medium: fonts.display,
	semibold: fonts.display,
	bold: fonts.display,
} as const;
