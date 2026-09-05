import { Platform, Alert as RNAlert } from "react-native";

/**
 * Drop-in replacement for react-native's `Alert`.
 *
 * react-native-web ships Alert as `static alert() {}` — an empty function. On
 * web every dialog was therefore a no-op: error messages never appeared, and
 * confirm dialogs never ran their `onPress`, so "Suspend organization",
 * "Remove from team" and every other confirmed action silently did nothing.
 * That matters most on the NGO and admin dashboards, which are web-first.
 *
 * The signature matches `Alert.alert` so call sites need no changes — only the
 * import moves from "react-native" to here.
 *
 * On web:
 *   - no buttons, or one button  → window.alert
 *   - a cancel + an action       → window.confirm, running the matching handler
 *
 * `window` is guarded because Expo Router static-renders these routes in Node
 * (app.json sets web.output: "static"), where there is no window — the same
 * trap that localStorage hit in lib/storage.ts.
 */
export interface AlertButton {
	text?: string;
	style?: "default" | "cancel" | "destructive";
	onPress?: () => void;
}

function alert(title: string, message?: string, buttons?: AlertButton[]): void {
	if (Platform.OS !== "web") {
		RNAlert.alert(title, message, buttons);
		return;
	}

	if (typeof window === "undefined") return;

	const body = message ? `${title}\n\n${message}` : title;
	const cancel = buttons?.find((button) => button.style === "cancel");
	const action = buttons?.find((button) => button.style !== "cancel");

	// Without a cancel button there is nothing to decline — it is a notice, and
	// its single button (an "OK" that only dismisses) runs either way.
	if (!cancel) {
		window.alert(body);
		action?.onPress?.();
		return;
	}

	if (window.confirm(body)) {
		action?.onPress?.();
	} else {
		cancel.onPress?.();
	}
}

export const Alert = { alert };
