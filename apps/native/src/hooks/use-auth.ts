import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";
import { useFeedStore } from "@/store/feed-store";
import { useOnboardingStore } from "@/store/onboarding-store";

/**
 * Signs out properly - which is more than clearing local state.
 *
 * The store's `signOut` only drops the token and the Zustand slice. Used on
 * its own it leaves the Supabase Auth session alive and every cached query in
 * place, so the next person to sign in on the same device would briefly see
 * the previous user's data. Always sign out through here.
 *
 * It also drops the onboarding drafts. Those are the one piece of persisted
 * state that is neither auth nor cache, and an abandoned wizard would
 * otherwise hand the next person on a shared device a form pre-filled with
 * someone else's registration number and phone.
 *
 * Sign-in and sign-up have no equivalent hook: `(auth)/login.tsx` and
 * `signup.tsx` call `authService` directly and set the store themselves, and a
 * second implementation here would only drift from those.
 */
export function useSignOut() {
	const signOut = useAuthStore((s) => s.signOut);
	const queryClient = useQueryClient();

	return useMutation({
		// One sign-out at a time: a second tap on a slow network used to start a
		// second teardown racing the first.
		mutationKey: ["sign-out"],
		mutationFn: async () => {
			await authService.logout();
		},
		// onSettled, not onSuccess: a failed remote sign-out must still clear the
		// device, otherwise a network blip leaves someone signed in.
		onSettled: () => {
			/*
			 * The order is the fix for "Maximum update depth exceeded" on sign-out.
			 *
			 * It used to clear the query cache and the store first and let the
			 * guards route. Every role layout then rendered <Redirect href="/" />,
			 * the gate at "/" replaced itself with the login screen, and on the web
			 * the old layout - still mounted for that frame - redirected back to
			 * "/": a ping-pong at the root `Stack` until React gave up. Clearing
			 * the cache while those screens were mounted also refetched every
			 * query they held with no token, and each 401 signed out again.
			 *
			 * So: leave first (drop pushed screens, then replace the root route
			 * with the login screen - the guards now send a signed-out session
			 * straight there too, never through "/"), then forget the account,
			 * and drop the cache only once the screens that read it are gone.
			 */
			if (router.canDismiss()) router.dismissAll();
			router.replace("/(auth)/login");
			signOut();
			useOnboardingStore.getState().clearOrg();
			useOnboardingStore.getState().clearVolunteer();
			// The feed's city is persisted now; the next person on a shared
			// device starts from All India, not from this person's choice.
			useFeedStore.getState().setCity("");
			void queryClient.cancelQueries();
			setTimeout(() => queryClient.clear(), 0);
		},
	});
}
