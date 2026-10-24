import { View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/hooks/use-theme";

/**
 * The nabhya logotype, drawn rather than typeset.
 *
 * One monoline geometric construction: every stem, shoulder and bowl is a
 * 3.2-unit stroke on a 20-unit baseline with a 14-unit x-height, butt-capped so
 * the terminals stay square. Shoulders (n, h) and the y's cup share one radius,
 * bowls (a, b) share another and overshoot the x-height and baseline by 0.15 so
 * they look as tall as the stems. The one piece of colour is a half-disc in the
 * first n's counter: a sun coming up under the arch (nabh, the sky). It is the
 * brand fill, never type, and the mark is that same n on its own.
 *
 * The path strings below are the single source for the PNG assets too:
 * `assets/images/brand-src/render-brand.mjs` reads them out of this file.
 * Regenerate the icons after changing them.
 */
// --- brand-paths:start (read by assets/images/brand-src/render-brand.mjs) ---
export const LOGO_STROKE = 3.2;
export const WORDMARK = {
	width: 95,
	height: 27,
	ink: "M1.6 6V20M1.6 12.25A4.8 4.8 0 0 1 11.2 12.25V20M16.9 13A5.55 5.55 0 1 1 28 13A5.55 5.55 0 1 1 16.9 13ZM28 6V20M34.3 0V20M34.3 13A5.55 5.55 0 1 1 45.4 13A5.55 5.55 0 1 1 34.3 13ZM51.1 0V20M51.1 12.25A4.8 4.8 0 0 1 60.7 12.25V20M67 6V13.75A4.8 4.8 0 0 0 76.6 13.75M76.6 6V21.6A3.4 3.4 0 0 1 73.2 25H71.6M82.3 13A5.55 5.55 0 1 1 93.4 13A5.55 5.55 0 1 1 82.3 13ZM93.4 6V20",
	sun: "M4.2 20A2.2 2.2 0 0 1 8.6 20Z",
} as const;
export const MARK = {
	width: 16,
	height: 16,
	ink: "M3.2 1V15M3.2 7.25A4.8 4.8 0 0 1 12.8 7.25V15",
	sun: "M5.8 15A2.2 2.2 0 0 1 10.2 15Z",
} as const;
// --- brand-paths:end ---

type LogoProps = {
	/** `wordmark` is the full name; `mark` is the n alone, for tight spaces. */
	variant?: "wordmark" | "mark";
	/** Rendered height in px. The wordmark reads best at 20-28, the mark at 16+. */
	size?: number;
	/** Letter ink. Defaults to the theme's primary text colour. */
	color?: string;
	/** The sun's fill; `false` drops it (single-colour contexts). */
	accent?: string | false;
	/**
	 * Spoken name. Pass `null` when a parent already names the control
	 * (a "home" link, a header that labels itself) so it isn't read twice.
	 */
	label?: string | null;
	style?: ViewStyle;
};

export function Logo({
	variant = "wordmark",
	size,
	color,
	accent,
	label = "nabhya",
	style,
}: LogoProps) {
	const { colors } = useTheme();
	const art = variant === "mark" ? MARK : WORDMARK;
	const height = size ?? (variant === "mark" ? 20 : 22);
	const width = (height * art.width) / art.height;
	const ink = color ?? (colors.text.primary as string);
	const sun = accent === undefined ? colors.primary.main : accent;

	// Accessibility lives on the View: react-native-svg forwards props on `Svg`
	// to the DOM on the web, where React rejects the RN accessibility names.
	return (
		<View
			style={[{ width, height }, style]}
			{...(label
				? {
						accessible: true,
						accessibilityRole: "image",
						accessibilityLabel: label,
					}
				: { importantForAccessibility: "no-hide-descendants" as const })}
		>
			<Svg
				width={width}
				height={height}
				viewBox={`0 0 ${art.width} ${art.height}`}
			>
				<Path
					d={art.ink}
					fill="none"
					stroke={ink}
					strokeWidth={LOGO_STROKE}
					strokeLinecap="butt"
					strokeLinejoin="miter"
				/>
				{sun ? <Path d={art.sun} fill={sun} /> : null}
			</Svg>
		</View>
	);
}
