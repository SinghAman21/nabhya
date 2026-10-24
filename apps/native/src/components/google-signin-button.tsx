import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { authErrorCopy } from "@/components/auth-error";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/store/auth-store";

/**
 * "Continue with Google", shared by login and signup - Supabase treats both
 * as the same `signInWithOAuth` call, so there is no separate sign-up variant.
 * A new Google account is provisioned server-side on first token exchange the
 * same way email/password signup is.
 *
 * **It comes first, with the divider under it.** It used to be the last thing
 * on the form, an outline button with no mark - so the fastest way in read as
 * an afterthought, and "Continue with Google" without the G is a phrase people
 * have learned not to trust. The G is Google's own four-colour mark at the
 * size their branding guidance asks for (18pt beside the label).
 *
 * Failures are handed to `onError` rather than reported here, so they land in
 * the host screen's own `AuthError` block above the submit button - one place
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
			// Web returns null here - the whole page is already navigating to
			// Google, so there's nothing left to route; the entry gate picks the
			// session back up when Google redirects to this origin.
			if (result?.user) {
				setUser(result.user);
				queryClient.removeQueries();
				router.replace("/");
			}
		} catch (error) {
			// A cancelled OAuth popup is not a failure - the person changed
			// their mind - so it reports nothing.
			if (error instanceof Error && error.message === "CANCELLED") return;
			onError?.(
				authErrorCopy(
					apiErrorMessage(
						error,
						"We couldn't sign you in with Google. Please try again.",
					),
					"sign-in",
				).message,
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={{ marginBottom: spacing[6] }}>
			<Button
				variant="outline"
				loading={loading}
				onPress={onPress}
				leading={<GoogleMark />}
				accessibilityLabel="Continue with Google"
			>
				Continue with Google
			</Button>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					marginTop: spacing[6],
				}}
			>
				<View
					style={{
						flex: 1,
						height: 1,
						backgroundColor: colors.border.hairline,
					}}
				/>
				<Caption color="quaternary">or with email</Caption>
				<View
					style={{
						flex: 1,
						height: 1,
						backgroundColor: colors.border.hairline,
					}}
				/>
			</View>
		</View>
	);
}

/**
 * Google's "G". The four hexes are the mark itself, fixed by Google's brand
 * rules in both schemes - the one place a hardcoded colour is correct, since
 * theming a logo is misusing it.
 *
 * No accessibility props on the `Svg`: on the web react-native-svg forwards
 * them to the DOM `<svg>` as unknown attributes (React warns). It needs none -
 * the button carries the label, and on native it is one accessible element.
 */
function GoogleMark() {
	return (
		<Svg width={18} height={18} viewBox="0 0 48 48">
			<Path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
			/>
			<Path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
			/>
			<Path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
			/>
			<Path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
			/>
		</Svg>
	);
}
