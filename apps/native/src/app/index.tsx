import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useOnboardingStatus } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

/**
 * Entry gate. Persisted store state gets the user to a screen instantly, then
 * the server's onboarding status reconciles it — the store can be stale (role
 * revoked, org approved, account suspended) but the server never is.
 */
export default function Index() {
	const email = useAuthStore((s) => s.email);
	const setUser = useAuthStore((s) => s.setUser);
	const syncFromStatus = useAuthStore((s) => s.syncFromStatus);
	const { colors } = useTheme();
	const router = useRouter();
	const [webSessionChecked, setWebSessionChecked] = useState(
		Platform.OS !== "web",
	);

	// Web has no persisted Zustand session to fall back on after a Google
	// redirect lands back on this origin — Supabase parsed the session out of
	// the URL itself, so pick it up here before deciding there's no one signed in.
	useEffect(() => {
		if (Platform.OS !== "web" || email) {
			setWebSessionChecked(true);
			return;
		}
		authService
			.getCurrentSession()
			.then((result) => {
				if (result?.user) setUser(result.user);
			})
			.finally(() => setWebSessionChecked(true));
	}, [email, setUser]);

	const {
		data: status,
		isLoading,
		isError,
	} = useOnboardingStatus(!!email && webSessionChecked);

	// Supabase access tokens are short-lived (an hour) while the refresh token
	// in storage is long-lived — mint a fresh one on boot so a reload never
	// starts with a token the API will reject.
	useEffect(() => {
		if (email) void authService.refreshAccessToken();
	}, [email]);

	useEffect(() => {
		if (status) syncFromStatus(status);
	}, [status, syncFromStatus]);

	useEffect(() => {
		if (!webSessionChecked) return;

		if (!email) {
			router.replace("/(auth)/login");
			return;
		}

		// A failed status call means the token is gone or the account is
		// suspended; the axios interceptor has already signed the user out.
		if (isError) {
			router.replace("/(auth)/login");
			return;
		}

		if (!status) return;

		// Reconcile the store BEFORE routing — the role-group layouts guard on
		// the store role, so navigating first would bounce us back here and
		// ping-pong forever.
		syncFromStatus(status);

		if (status.needsRoleSelection) {
			router.replace("/role-select");
		} else if (status.role === "superadmin") {
			router.replace("/(admin)");
		} else if (status.role === "organisation") {
			router.replace(status.isOnboarded ? "/(ngo)" : "/(onboarding)");
		} else {
			router.replace(
				status.isOnboarded ? "/(volunteer)" : "/(onboarding)/volunteer",
			);
		}
	}, [email, status, isError, router, webSessionChecked]);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{isLoading && (
				<ActivityIndicator size="small" color={colors.primary.main as string} />
			)}
		</View>
	);
}
