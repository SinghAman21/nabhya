import { router } from "expo-router";
import { storage } from "@/lib/storage";

/**
 * Where a signed-out visitor was when they were asked to sign in.
 *
 * "Sign in to apply" on an event used to open `/login`, and sign-in, sign-up
 * and Google all finish by replacing to `/` - so the volunteer landed on Home
 * and had to find the event again. A `?next=` param would not survive the
 * Google round trip on the web (the whole page navigates away), so the path is
 * parked in storage like `lib/pending-invite.ts`, and the entry gate takes it
 * once the account is fully set up (role chosen, onboarded). A brand-new
 * account goes through role select and the wizard first; the page waits.
 *
 * Only app-relative paths are accepted, so a crafted value cannot send the
 * gate to another origin.
 */
const KEY = "return-to";

/** Remembers `path`, then opens sign-in. Use instead of pushing `/login`. */
export async function signInAndReturn(path: string) {
	try {
		if (isSafePath(path)) await storage.set(KEY, path);
	} catch {
		// Storage failing only costs the return trip; sign-in still opens.
	}
	router.push("/(auth)/login");
}

/** Reads and clears the parked path. */
export async function takeReturnTo(): Promise<string | null> {
	try {
		const path = await storage.get(KEY);
		if (path) await storage.remove(KEY);
		return path && isSafePath(path) ? path : null;
	} catch {
		return null;
	}
}

function isSafePath(path: string) {
	return (
		path.startsWith("/") &&
		!path.startsWith("//") &&
		!path.includes("://") &&
		!/^\/(\(auth\)|login|signup)/.test(path)
	);
}
