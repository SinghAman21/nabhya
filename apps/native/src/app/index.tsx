import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { ErrorState } from "@/components/screen-shell";
import { useOnboardingStatus } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorStatus } from "@/lib/api";
import { authService } from "@/lib/api/auth";
import { takePendingInvite } from "@/lib/pending-invite";
import { useAuthStore } from "@/store/auth-store";

/**
 * Entry gate. Persisted store state gets the user to a screen instantly, then
 * the server's onboarding status reconciles it - the store can be stale (role
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
	// redirect lands back on this origin - Supabase parsed the session out of
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

	// A team invite opened while signed out outranks every other destination:
	// the invitee must not reach role-select or the NGO wizard first. Read once
	// per sign-in; `undefined` means "not looked yet", so routing waits for it.
	const [pendingInvite, setPendingInvite] = useState<string | null | undefined>(
		undefined,
	);
	useEffect(() => {
		if (!email) {
			setPendingInvite(undefined);
			return;
		}
		let live = true;
		void takePendingInvite().then((token) => {
			if (live) setPendingInvite(token);
		});
		return () => {
			live = false;
		};
	}, [email]);

	const {
		data: status,
		isError,
		error,
		refetch,
		isRefetching,
	} = useOnboardingStatus(!!email && webSessionChecked);
	// Only a rejected session means "sign in again". Offline, a timeout or a
	// 500 used to land a signed-in person on the login form with no word of
	// why - they would sign in again and hit the same wall.
	const errorStatus = isError ? apiErrorStatus(error) : null;
	const signedOutByServer = errorStatus === 401 || errorStatus === 403;
	const unreachable = isError && !signedOutByServer;

	// Supabase access tokens are short-lived (an hour) while the refresh token
	// in storage is long-lived - mint a fresh one on boot so a reload never
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

		if (pendingInvite === undefined) return;
		if (pendingInvite) {
			router.replace({
				pathname: "/team/invites/[token]",
				params: { token: pendingInvite },
			});
			return;
		}

		// A 401/403 means the token is gone or the account is suspended; the
		// axios interceptor has already signed the user out. Anything else is
		// shown below with a retry, not mistaken for a sign-out.
		if (signedOutByServer) {
			router.replace("/(auth)/login");
			return;
		}
		if (isError) return;

		if (!status) return;

		// Reconcile the store BEFORE routing - the role-group layouts guard on
		// the store role, so navigating first would bounce us back here and
		// ping-pong forever.
		syncFromStatus(status);

		if (status.needsRoleSelection) {
			router.replace("/role-select");
		} else if (status.role === "superadmin") {
			router.replace("/(admin)");
		} else if (status.role === "organisation") {
			// Feed first - the dashboard and everything else hang off the
			// sidebar/tab bar, which stay mounted on every (ngo) route.
			router.replace(status.isOnboarded ? "/(ngo)/feed" : "/(onboarding)");
		} else {
			router.replace(
				status.isOnboarded ? "/(volunteer)" : "/(onboarding)/volunteer",
			);
		}
	}, [
		email,
		status,
		isError,
		signedOutByServer,
		router,
		webSessionChecked,
		pendingInvite,
		syncFromStatus,
	]);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{unreachable ? (
				<ErrorState
					message="Couldn't reach Nabhya. Check your connection, then try again."
					onRetry={() => refetch()}
				/>
			) : (
				// Until a route is chosen - including the session and invite checks
				// before the status call starts - so the screen is never blank.
				<ActivityIndicator
					size="small"
					color={colors.primary.ink as string}
					accessibilityLabel={isRefetching ? "Retrying" : "Loading"}
				/>
			)}
		</View>
	);
}
