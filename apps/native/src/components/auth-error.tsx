import { AlertCircle } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { BodySmall, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { focusable } from "@/lib/focus";
import { announce } from "@/lib/motion";

/**
 * A failed sign-in or sign-up, said where it happened.
 *
 * Both screens used `Alert.alert`, which is wrong here twice over. It is a
 * blocking OS dialog you have to dismiss before you can even see the field you
 * got wrong, and on the web `Alert` is `window.alert` - a browser chrome box
 * with the app's own copy in it. Worse, dismissing it leaves the screen exactly
 * as it was, so the reason is gone the moment you acknowledge it.
 *
 * This sits immediately above the submit button - the last thing under the
 * fields, the first thing under your thumb - stays on screen while you fix the
 * problem, and is announced by a screen reader when it appears.
 *
 * `action` is the part that matters most: the commonest failure on a sign-in
 * form is not a typo, it is being on the wrong form. Supabase Auth cannot tell
 * a wrong password from an account that does not exist (deliberately - the
 * distinction is an account-enumeration oracle), so the message covers both and
 * the action is the way out.
 */
export function AuthError({
	message,
	action,
}: {
	message: string | null;
	action?: { label: string; onPress: () => void };
}) {
	const { colors, spacing, borderRadius } = useTheme();

	// The live region covers Android and the web; iOS needs telling.
	useEffect(() => {
		announce(message);
	}, [message]);

	if (!message) return null;

	return (
		<View
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				gap: spacing[3],
				marginTop: spacing[5],
				padding: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.error.bg,
			}}
		>
			<AlertCircle
				size={17}
				strokeWidth={2}
				color={colors.error.ink as string}
				style={{ marginTop: 2 }}
			/>
			<View style={{ flex: 1, gap: spacing[1] }}>
				<BodySmall color={colors.error.ink as string}>{message}</BodySmall>
				{action ? (
					<Pressable
						onPress={action.onPress}
						hitSlop={8}
						accessibilityRole="link"
						accessibilityLabel={action.label}
						{...focusable}
						style={({ pressed }) => ({
							alignSelf: "flex-start",
							minHeight: 28,
							justifyContent: "center",
							opacity: pressed ? 0.6 : 1,
						})}
					>
						<Caption weight="semibold" color={colors.error.ink as string}>
							{action.label}
						</Caption>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

/**
 * Turns an auth failure into something a person can act on.
 *
 * Supabase's own strings are accurate and useless ("Invalid login credentials"
 * tells you nothing about what to do next), so the two cases that account for
 * nearly every real failure get their own copy and their own way forward.
 * Everything else falls through to the underlying message, which is the right
 * default - "email not confirmed", a 401 from our API and a dead network each
 * need a different response from the user, and a single fixed string gave them
 * none of it.
 */
export function authErrorCopy(
	raw: string,
	mode: "sign-in" | "sign-up",
): { message: string; hint?: "sign-up" | "sign-in" } {
	const text = raw.toLowerCase();

	if (mode === "sign-in") {
		if (
			text.includes("invalid login credentials") ||
			text.includes("invalid credentials")
		) {
			return {
				message:
					"That email and password don't match an account. Check your password - or sign up, if you haven't yet.",
				hint: "sign-up",
			};
		}
		if (text.includes("email not confirmed")) {
			return {
				message:
					"Confirm your email first - we sent you a link when you signed up. Check spam too.",
			};
		}
	}

	if (mode === "sign-up") {
		if (
			text.includes("already registered") ||
			text.includes("already exists") ||
			text.includes("user already")
		) {
			return {
				message: "There's already an account with that email.",
				hint: "sign-in",
			};
		}
		if (text.includes("weak password") || text.includes("password should be")) {
			return {
				message: "Pick a longer password - at least 8 characters.",
			};
		}
	}

	if (text.includes("network") || text.includes("fetch")) {
		return {
			message: "We couldn't reach Nabhya. Check your connection and try again.",
		};
	}

	return { message: raw };
}
