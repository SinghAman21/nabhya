import { Platform } from "react-native";
import { darkColors, lightColors } from "@/constants/design-system";

/**
 * The handful of web rules that cannot be expressed in React Native styles,
 * injected at runtime.
 *
 * **Why not `global.css`.** Two attempts at the scrollbar lived there - one
 * inside `@layer base`, one outside it - and neither reached the browser: raw
 * `::-webkit-scrollbar` and attribute selectors do not survive NativeWind's
 * compilation of that stylesheet on the way to the web bundle. A `<style>`
 * appended to `<head>` cannot be dropped by a build step, is last in document
 * order, and lets colours come from `design-system.ts` - the actual source of
 * truth - rather than from a CSS variable that may not have been emitted.
 *
 * Called by `ThemeProvider`, which is the only place that knows the resolved
 * colour scheme.
 */

const STYLE_ID = "nabhya-web-styles";

/**
 * Above react-native-web's `Modal`, which it hosts at `zIndex: 9999`.
 *
 * Everything that portals - `DropdownMenu`, `Select` - is Radix underneath on
 * web and lands in `document.body`, so a menu opened from a `Sheet` competes
 * with that modal directly. See `popperRule` for why this has to be CSS.
 */
const POPPER_Z_INDEX = 10_000;

/** `#RRGGBB` → `rgba(r, g, b, alpha)`. The tokens are all six-digit hex. */
function withAlpha(hex: string, alpha: number) {
	const value = hex.replace("#", "");
	const r = Number.parseInt(value.slice(0, 2), 16);
	const g = Number.parseInt(value.slice(2, 4), 16);
	const b = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lift every Radix popper above the sheet it was opened from.
 *
 * This has to be a stylesheet rule with `!important`, and every more obvious
 * route fails:
 *
 * - Setting `style={{ zIndex }}` on `DropdownMenuContent` lands on an inner
 *   `Pressable` (see `dropdown-menu.web.js`: the props spread goes to a child
 *   of `DropdownMenu.Content`, not to the positioned element), and
 *   react-native-web compiles that style to a *class*, which then loses to the
 *   `z-50` Tailwind class already on the same node.
 * - The positioned element is Radix's own wrapper div, marked
 *   `data-radix-popper-content-wrapper`. `@radix-ui/react-popper` reads the
 *   *computed* z-index off the content and copies it onto that wrapper as an
 *   **inline** style - so with `z-50` winning above, the wrapper is pinned at
 *   50 against the modal's 9999 and the menu renders behind the sheet.
 *
 * A stylesheet declaration marked `!important` outranks that inline style,
 * which is the one thing that does.
 */
const popperRule = `
[data-radix-popper-content-wrapper] {
  z-index: ${POPPER_Z_INDEX} !important;
}
`;

/**
 * The app's scrollbar: thin, trackless, theme-aware.
 *
 * Two things to know before editing:
 *
 * 1. **Styling `::-webkit-scrollbar` at all opts Chrome out of its overlay
 *    scrollbar and into the legacy one, stepper arrows included.** The arrows
 *    are not drawn by anything here; they are what is left when a custom
 *    scrollbar does not suppress them. `-button` must be zeroed on every axis.
 * 2. `scrollbar-width: none` - what React Native's
 *    `showsVerticalScrollIndicator={false}` compiles to - still wins over all
 *    of this, by design. That is how the sidebar and the desktop rail stay
 *    bare while content panes get a thumb. See `lib/scroll.ts`.
 */
function scrollbarRules(isDark: boolean) {
	const ink = (isDark ? darkColors : lightColors).text.primary;
	const thumb = withAlpha(ink, isDark ? 0.24 : 0.2);
	const hover = withAlpha(ink, isDark ? 0.4 : 0.34);
	const active = withAlpha(ink, isDark ? 0.55 : 0.48);

	return `
/* Firefox, and the standard property everywhere else. */
* {
  scrollbar-width: thin;
  scrollbar-color: ${thumb} transparent;
}

/* Reserve the gutter on the document only, so a pane becoming scrollable does
   not shift the layout under it. Panes and cards keep their full width. */
html {
  scrollbar-gutter: stable;
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background: transparent;
}

/* Note 1 above. Zeroed on every axis, corner and increment, because
   \`display: none\` alone still leaves Chrome reserving the track ends on some
   platforms. */
*::-webkit-scrollbar-button,
*::-webkit-scrollbar-button:start,
*::-webkit-scrollbar-button:end,
*::-webkit-scrollbar-button:vertical:start,
*::-webkit-scrollbar-button:vertical:end,
*::-webkit-scrollbar-button:vertical:start:decrement,
*::-webkit-scrollbar-button:vertical:end:increment,
*::-webkit-scrollbar-button:horizontal:start,
*::-webkit-scrollbar-button:horizontal:end,
*::-webkit-scrollbar-button:horizontal:start:decrement,
*::-webkit-scrollbar-button:horizontal:end:increment {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}

*::-webkit-scrollbar-track,
*::-webkit-scrollbar-track-piece,
*::-webkit-scrollbar-corner {
  background: transparent;
  border: none;
  box-shadow: none;
}

*::-webkit-scrollbar-thumb {
  background-color: ${thumb};
  border-radius: 9999px;
  /* A transparent border plus padding-box insets the thumb to ~4px inside an
     8px gutter without painting a track-coloured ring around it. */
  border: 2px solid transparent;
  background-clip: padding-box;
  min-height: 32px;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: ${hover};
}

*::-webkit-scrollbar-thumb:active {
  background-color: ${active};
}
`;
}

/**
 * Install or re-colour the stylesheet. Safe to call on every theme change: it
 * reuses one element rather than stacking a new one each time.
 */
export function applyWebStyles(isDark: boolean) {
	if (Platform.OS !== "web" || typeof document === "undefined") return;

	let node = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!node) {
		node = document.createElement("style");
		node.id = STYLE_ID;
		document.head.appendChild(node);
	}
	const next = `${popperRule}${scrollbarRules(isDark)}`;
	// Assigning identical text would still trigger a style recalculation.
	if (node.textContent !== next) node.textContent = next;
}
