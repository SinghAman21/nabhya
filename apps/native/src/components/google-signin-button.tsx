import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/store/auth-store";

/**
 * "Continue with Google", shared by login and signup — Supabase treats both
 * as the same `signInWithOAuth` call, so there is no separate sign-up variant.
 * A new Google account is provisioned server-side on first token exchange the
 * same way email/password signup is.
 *
 * Failures are handed to `onError` rather than reported here, so they land in
 * the host screen's own `AuthError` block above the submit button — one place
 * on the form where anything that went wrong appears, whichever control caused
 * it. A dismissed dialog left the form looking untouched.
 */
export function GoogleSignInButton({
	onError,
}: {
	onError?: (message: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const setUser = useAuthStore((s) => s.setUser);
	const queryClient = useQueryClient();
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const onPress = async () => {
		setLoading(true);
		try {
			const result = await authService.signInWithGoogle();
			// Web returns null here — the whole page is already navigating to
			// Google, so there's nothing left to route; the entry gate picks the
			// session back up when Google redirects to this origin.
			if (result?.user) {
				setUser(result.user);
				queryClient.removeQueries();
				router.replace("/");
			}
		} catch (error) {
			// A cancelled OAuth popup is not a failure — the person changed
			// their mind — so it reports nothing.
			if (error instanceof Error && error.message === "CANCELLED") return;
			onError?.(
				apiErrorMessage(
					error,
					"We couldn't sign you in with Google. Please try again.",
				),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={{ marginTop: spacing[6] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					marginBottom: spacing[5],
				}}
			>
				<View
					style={{
						flex: 1,
						height: 1,
						backgroundColor: colors.border.hairline,
					}}
				/>
				<Caption color="quaternary">or</Caption>
				<View
					style={{
						flex: 1,
						height: 1,
						backgroundColor: colors.border.hairline,
					}}
				/>
			</View>

			<Button
				variant="outline"
				size="lg"
				loading={loading}
				onPress={onPress}
				accessibilityLabel="Continue with Google"
			>
				Continue with Google
			</Button>
		</View>
	);
}
