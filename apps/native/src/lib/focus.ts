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
