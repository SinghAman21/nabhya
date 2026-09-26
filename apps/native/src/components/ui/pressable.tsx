import { forwardRef } from "react";
import {
	Pressable as NativePressable,
	type PressableProps,
	type View,
} from "react-native";

/**
 * `Pressable` with NativeWind's interop switched off.
 *
 * NativeWind v4 wraps every `Pressable` so `className` works. On native that
 * wrapper flattens the `style` prop with an object spread - and a style
 * **function** (`style={({ pressed }) => …}`) spreads to `{}`. Every pressed
 * state, focus ring, `flex: 1` and `flexDirection: "row"` written that way was
 * silently dropped on iOS and Android, while web (which never touches inline
 * styles) rendered correctly. Tab items shrank to their labels, list rows
 * stacked vertically, buttons lost their fill.
 *
 * `cssInterop={false}` is the escape hatch the interop's JSX wrapper honours:
 * it renders the real React Native `Pressable`. The trade is that `className`
 * is not processed on this component - the app styles pressables with tokens,
 * not Tailwind classes, so nothing here needs it. Import this everywhere
 * instead of the one from "react-native".
 */
export const Pressable = forwardRef<View, PressableProps>(
	function Pressable(props, ref) {
		return (
			<NativePressable
				ref={ref}
				{...({ cssInterop: false } as Record<string, unknown>)}
				{...props}
			/>
		);
	},
);

export type { PressableProps };
