import { storage } from "@/lib/storage";

/**
 * A team invite opened while signed out.
 *
 * The invite page cannot be accepted anonymously, and sign-in and sign-up
 * both finish by replacing to `/`, so the token is parked here and the entry
 * gate hands the person back to the invite once it knows who they are - before
 * role-select, which is exactly where an invitee must not choose for
 * themselves (picking "organisation" there leads to registering a second NGO).
 *
 * The gate *takes* the token rather than peeking: the invite page is then an
 * ordinary page, and backing out of it cannot loop through the gate into it
 * again. The email link still works if they want it later.
 */
const KEY = "pending-team-invite";

export function savePendingInvite(token: string) {
	return storage.set(KEY, token);
}

export async function takePendingInvite(): Promise<string | null> {
	try {
		const token = await storage.get(KEY);
		if (token) await storage.remove(KEY);
		return token;
	} catch {
		return null;
	}
}
