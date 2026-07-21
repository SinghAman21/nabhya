import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

/**
 * Signs out properly — which is more than clearing local state.
 *
 * The store's `signOut` only drops the token and the Zustand slice. Used on
 * its own it leaves the Neon Auth session alive and every cached query in
 * place, so the next person to sign in on the same device would briefly see
 * the previous user's data. Always sign out through here.
 *
 * Sign-in and sign-up have no equivalent hook: `(auth)/login.tsx` and
 * `signup.tsx` call `authService` directly and set the store themselves, and a
 * second implementation here would only drift from those.
 */
export function useSignOut() {
	const signOut = useAuthStore((s) => s.signOut);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await authService.logout();
		},
		// onSettled, not onSuccess: a failed remote sign-out must still clear the
		// device, otherwise a network blip leaves someone signed in.
		onSettled: () => {
			queryClient.clear();
			signOut();
		},
	});
}
