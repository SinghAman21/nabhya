import { useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import { HEADERLESS } from "@/lib/navigation";

/**
 * `HEADERLESS` plus the page colour as the stack's card background, for a
 * nested `Stack` that sits *inside* `withAppShell`.
 *
 * The app has no React Navigation theme, so every stack card defaults to the
 * library's light grey (#F2F2F2). On the root stack nobody sees it - the
 * shell's own `background.warm` covers the card. A nested stack wrapped by the
 * shell puts that grey card *inside* the top bar's content column, and a
 * screen capped at the reading width (`Screen style={READING_COLUMN}`) paints
 * only its own 720: in dark mode the certificates list sat between two light
 * grey strips.
 *
 * Memoised because React Navigation identity-compares `screenOptions` - see
 * the note on `HEADERLESS`.
 */
export function useStackOptions() {
	const { colors } = useTheme();
	const background = colors.background.warm;
	return useMemo(
		() => ({ ...HEADERLESS, contentStyle: { backgroundColor: background } }),
		[background],
	);
}
