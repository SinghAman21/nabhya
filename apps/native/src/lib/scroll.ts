import { Platform } from "react-native";

/**
 * Scroll-indicator props for a **vertical** scroller.
 *
 * Every screen used to hard-code the indicator off, which on a phone is a
 * reasonable aesthetic call - the platform indicator is a transient overlay and
 * the content is obviously swipeable. On the web it is not an aesthetic call,
 * it is a bug: react-native-web turns `showsVerticalScrollIndicator={false}`
 * into `scrollbar-width: none` (see `ScrollViewBase`), Chrome has honoured that
 * property since 121, and the result is a pane with no scrollbar, no thumb
 * position, and no clue there is anything below the fold. Someone on a desktop
 * with a mouse and no trackpad has nothing to grab.
 *
 * So: hidden on native, shown on web. `src/global.css` styles web scrollbars
 * thin, trackless and theme-aware - including suppressing the stepper arrows
 * Chrome brings back the moment `::-webkit-scrollbar` is styled at all - so the
 * one that appears is the designed one.
 *
 * Spread it instead of writing the prop by hand:
 *
 *   <ScrollView {...verticalScrollbar} … />
 *
 * Horizontal rows - chip strips, the media carousel - keep
 * `showsHorizontalScrollIndicator={false}` explicitly: a scrollbar under a row
 * of five chips is furniture, and those rows have their own overflow cues.
 */
export const verticalScrollbar = {
	showsVerticalScrollIndicator: Platform.OS === "web",
} as const;
