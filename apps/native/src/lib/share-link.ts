import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";
import { toast } from "@/components/ui/overlay";
import { copyText } from "@/lib/clipboard";

/**
 * A link to one of the app's public pages, as someone else will open it: the
 * site's own origin on the web, the app's scheme on a phone.
 */
export function publicUrl(path: string): string {
	return Platform.OS === "web" && typeof window !== "undefined"
		? `${window.location.origin}${path}`
		: Linking.createURL(path);
}

/**
 * The OS share sheet where there is one, else the clipboard - and a toast
 * either way the clipboard is used, since a copy is otherwise invisible.
 *
 * `Share.share` on the web is `navigator.share`, which desktop Chrome and
 * Firefox do not implement, so a bare call there did nothing at all.
 */
export async function shareLink({
	message,
	url,
}: {
	message: string;
	url: string;
}): Promise<void> {
	const canShare =
		Platform.OS !== "web" ||
		(typeof navigator !== "undefined" && typeof navigator.share === "function");

	if (canShare) {
		try {
			await Share.share(
				Platform.OS === "ios"
					? { message, url }
					: { message: `${message}\n${url}` },
			);
			return;
		} catch (error) {
			// Dismissing the browser's sheet rejects with AbortError: the person
			// changed their mind, so do nothing. Anything else falls through to
			// copying.
			if ((error as { name?: string } | null)?.name === "AbortError") return;
		}
	}

	const copied = await copyText(url);
	if (copied) toast.success("Link copied.");
	else toast.error(`Couldn't copy the link. It is ${url}`);
}
