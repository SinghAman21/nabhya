import { createContext, forwardRef, type ReactNode, useContext } from "react";
import {
	Pressable as NativePressable,
	Platform,
	type PressableProps,
	type View,
} from "react-native";

/**
 * True below a pressable that renders as a `<button>` on the web.
 *
 * react-native-web draws `accessibilityRole="button"` as a real `<button>`,
 * and a `<button>` inside a `<button>` is invalid HTML: React logs "<button>
 * cannot contain a nested <button>", the browser hoists the inner one out of
 * the outer in the DOM, and pressing it can fire both. It kept arriving
 * through props - a row's trailing `value`, a card's children - where no file
 * shows the nesting on its own, so it is caught here, once, for every caller.
 */
const InsideButton = createContext(false);

/**
 * Resets the nesting flag for content that portals out of the tree it is
 * declared in - a `Modal`'s body is not inside the button that opened it.
 */
export function PressableBoundary({ children }: { children: ReactNode }) {
	return (
		<InsideButton.Provider value={false}>{children}</InsideButton.Provider>
	);
}

const warned = new Set<string>();

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
 *
 * **A button inside a button is demoted on the web.** It keeps its press, its
 * focus and its label, but drops the `button` role so it renders as a
 * focusable element rather than a nested `<button>`. Dev builds warn once per
 * label: the safety net keeps the page valid, but the layout that caused it
 * should still be fixed - put the inner control beside the outer one, as
 * `ListRow`'s `action` and `Surface`'s `footer` do.
 */
export const Pressable = forwardRef<View, PressableProps>(
	function Pressable(props, ref) {
		const nested = useContext(InsideButton);
		const role = props.accessibilityRole ?? props.role;
		const isButton = role === "button";

		let resolved = props;
		if (Platform.OS === "web" && nested && isButton) {
			if (__DEV__) {
				const name = props.accessibilityLabel ?? "unlabelled";
				if (!warned.has(name)) {
					warned.add(name);
					console.warn(
						`Pressable "${name}" is a button inside a button; rendered without the button role. Move it beside its parent control.`,
					);
				}
			}
			resolved = { ...props, accessibilityRole: undefined, role: undefined };
		}

		const element = (
			<NativePressable
				ref={ref}
				{...({ cssInterop: false } as Record<string, unknown>)}
				{...resolved}
			/>
		);

		return isButton && !nested ? (
			<InsideButton.Provider value={true}>{element}</InsideButton.Provider>
		) : (
			element
		);
	},
);

export type { PressableProps };
