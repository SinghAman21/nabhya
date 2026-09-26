import type { PressableProps, ViewProps } from "react-native";
import { Platform } from "react-native";

/**
 * Opts a pressable into the keyboard focus ring defined in `src/global.css`.
 *
 * Focus rings have to be drawn in CSS rather than from the `focused` flag in a
 * Pressable's style callback: react-native-web sets that flag from DOM focus
 * events, which fire on **mouse clicks** as well as keyboard focus, so a
 * JS-drawn ring stays painted around the last thing you clicked. `:focus-visible`
 * is the browser's own answer to that distinction, and it is the only one that
 * gets it right.
 *
 * No-op on native, where a focus ring has nothing to describe.
 */
export const focusable = (
	Platform.OS === "web" ? { dataSet: { focus: "ring" } } : {}
) as PressableProps;

/**
 * Same idea, for a composed field: put this on the shell that wraps an icon,
 * a `TextInput` and any trailing button, so the ring is drawn once around the
 * whole control instead of around the bare input inside it.
 */
export const focusWithin = (
	Platform.OS === "web" ? { dataSet: { focus: "within" } } : {}
) as ViewProps;

/**
 * The shape react-native-web actually passes to a `Pressable` style callback.
 *
 * RN's own `PressableStateCallbackType` declares only `pressed`, but RNW also
 * supplies `hovered` and `focused`. Reading `hovered` from here is how the app
 * does pointer states - `notification-bell.tsx` and `org-branding.tsx` are the
 * existing examples - and it is strictly better than a `useState` hover hook:
 * the style callback re-runs without re-rendering the component, so hovering
 * one card in a feed does not re-render that card and its video player.
 *
 * `focused` is present but must not be used to draw a ring - see `focusable`.
 */
export type PressState = {
	pressed: boolean;
	hovered?: boolean;
	focused?: boolean;
};
