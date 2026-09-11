import * as Clipboard from "expo-clipboard";

/**
 * Copies text to the clipboard, preferring the web Clipboard API where it
 * exists and falling back to expo-clipboard elsewhere. Never throws —
 * returns whether the copy succeeded so callers can toast either way.
 */
export async function copyText(value: string): Promise<boolean> {
	try {
		if (
			typeof navigator !== "undefined" &&
			typeof navigator.clipboard?.writeText === "function"
		) {
			await navigator.clipboard.writeText(value);
			return true;
		}
		await Clipboard.setStringAsync(value);
		return true;
	} catch {
		return false;
	}
}
