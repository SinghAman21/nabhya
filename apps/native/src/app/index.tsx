import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useOnboardingStatus } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

/**
 * Entry gate. Persisted store state gets the user to a screen instantly, then
 * the server's onboarding status reconciles it — the store can be stale (role
 * revoked, org approved, account suspended) but the server never is.
 */
export default function Index() {
	const email = useAuthStore((s) => s.email);
	const syncFromStatus = useAuthStore((s) => s.syncFromStatus);
	const { colors } = useTheme();
	const router = useRouter();

	const { data: status, isLoading, isError } = useOnboardingStatus(!!email);

	// Access tokens expire after ~15 min but the Better Auth session cookie is
	// long-lived — mint a fresh token on boot so a reload never starts stale.
	useEffect(() => {
		if (email) void authService.refreshAccessToken();
	}, [email]);

	useEffect(() => {
		if (status) syncFromStatus(status);
	}, [status, syncFromStatus]);

	useEffect(() => {
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
	}, [email, status, isError, router]);

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
