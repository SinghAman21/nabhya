import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * The person's "reduce motion" setting, live.
 *
 * Every `Animated.timing` in the shell - the drawer sliding in, the rail
 * collapsing, the skeleton's pulse - reads this and either skips straight to
 * the end state or holds still. A slide is decoration; for someone with a
 * vestibular disorder it is the thing that makes the app hard to use, and the
 * OS setting is the only way they can tell us.
 *
 * `AccessibilityInfo` covers all three platforms: iOS and Android read the
 * system switch, and react-native-web answers from the
 * `prefers-reduced-motion` media query and fires `reduceMotionChanged` when it
 * flips. The module-level value means a component mounting after the first
 * read starts with the right answer instead of animating once and then
 * stopping.
 */

let reduced = false;
let primed = false;
const listeners = new Set<(value: boolean) => void>();

function prime() {
	if (primed) return;
	primed = true;
	AccessibilityInfo.isReduceMotionEnabled()
		.then((value) => {
			reduced = value;
			for (const listener of listeners) listener(value);
		})
		.catch(() => {});
	AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
		reduced = value;
		for (const listener of listeners) listener(value);
	});
}

/** The last known setting, for imperative callers outside React. */
export function prefersReducedMotion() {
	prime();
	return reduced;
}

export function useReducedMotion() {
	prime();
	const [value, setValue] = useState(reduced);

	useEffect(() => {
		listeners.add(setValue);
		setValue(reduced);
		return () => {
			listeners.delete(setValue);
		};
	}, []);

	return value;
}

/** A duration, or 0 when motion is reduced. `Animated.timing` treats 0 as a jump. */
export function motionDuration(ms: number, reduce: boolean) {
	return reduce ? 0 : ms;
}

/**
 * Announce a sentence to a screen reader.
 *
 * Android and the web already speak a live region when it appears
 * (`accessibilityLiveRegion` → `aria-live`), but iOS ignores that prop
 * entirely, so a VoiceOver user heard nothing when a toast, a form error or a
 * sign-in failure arrived. iOS gets the explicit announcement; the others are
 * left to their live regions so nothing is read twice.
 */
export function announce(message: string | null | undefined) {
	if (!message || Platform.OS !== "ios") return;
	AccessibilityInfo.announceForAccessibility(message);
}
