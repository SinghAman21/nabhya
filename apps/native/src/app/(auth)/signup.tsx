import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpSchema } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { AuthError, authErrorCopy } from "@/components/auth-error";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
import { focusable } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";

export default function SignUp() {
	const { colors, spacing } = useTheme();
	const setUser = useAuthStore((s) => s.setUser);
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<{
		message: string;
		hint?: "sign-up" | "sign-in";
	} | null>(null);
	// Set when the project requires email confirmation: the account exists but
	// has no session yet, so the form gives way to "check your inbox".
	const [pendingEmail, setPendingEmail] = useState<string | null>(null);
	const [resending, setResending] = useState(false);
	const form = useForm<SignUpInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(signUpSchema as any),
		defaultValues: { email: "", password: "", name: "" },
	});

	const onSubmit = form.handleSubmit(async (data) => {
		setLoading(true);
		setFailure(null);
		try {
			const result = await authService.signup({
				email: data.email,
				password: data.password,
				name: data.name,
			});
			if (result.status === "confirm-email") {
				setPendingEmail(result.email);
				return;
			}
			setUser(result.user);
			router.replace("/");
		} catch (error) {
			// Inline, above the button - see the same note in `login.tsx`.
			setFailure(
				authErrorCopy(
					apiErrorMessage(error, "Check your details and try again."),
					"sign-up",
				),
			);
		} finally {
			setLoading(false);
		}
	});

	const resend = async () => {
		if (!pendingEmail) return;
		setResending(true);
		try {
			await authService.resendConfirmation(pendingEmail);
			toast.success(`Sent again to ${pendingEmail}.`);
		} catch (error) {
			toast.error(
				apiErrorMessage(error, "Couldn't resend the email. Try again shortly."),
			);
		} finally {
			setResending(false);
		}
	};

	if (pendingEmail) {
		return (
			<AuthSplitLayout alternateLink={null}>
				<View style={{ marginBottom: spacing[4] }}>
					<MailCheck
						size={28}
						strokeWidth={1.8}
						color={colors.primary.ink as string}
					/>
				</View>
				<Title accessibilityRole="header">Check your inbox</Title>
				<Body
					color="tertiary"
					style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
				>
					We sent a link to {pendingEmail}. Open it to confirm your email, then
					sign in. Check spam if it isn't there in a minute.
				</Body>
				<Button onPress={() => router.replace("/(auth)/login")}>
					Go to sign in
				</Button>
				<Button
					variant="outline"
					loading={resending}
					onPress={resend}
					style={{ marginTop: spacing[3] }}
				>
					Send the email again
				</Button>
				<Button
					variant="link"
					onPress={() => setPendingEmail(null)}
					style={{ marginTop: spacing[2], alignSelf: "center" }}
				>
					Use a different email
				</Button>
			</AuthSplitLayout>
		);
	}

	return (
		<AuthSplitLayout
			alternateLink={
				<Pressable
					onPress={() => router.push("/(auth)/login")}
					accessibilityRole="link"
					accessibilityLabel="Already have an account? Sign in"
					hitSlop={8}
					{...focusable}
				>
					<Caption color="secondary">
						Already have an account?{" "}
						<Caption color={colors.primary.ink} weight="semibold">
							Sign in
						</Caption>
					</Caption>
				</Pressable>
			}
		>
			<Title accessibilityRole="header">Create your account</Title>
			<Body
				color="tertiary"
				style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
			>
				Volunteer, or register your NGO - you'll choose on the next step.
			</Body>

			<GoogleSignInButton onError={(message) => setFailure({ message })} />

			<FormField
				control={form.control}
				name="name"
				label="Full name"
				placeholder="Your name"
				autoCapitalize="words"
				autoComplete="name"
				textContentType="name"
				returnKeyType="next"
				accessibilityLabel="Full name"
			/>

			<FormField
				control={form.control}
				name="email"
				label="Email"
				placeholder="you@example.com"
				keyboardType="email-address"
				autoCapitalize="none"
				autoComplete="email"
				textContentType="emailAddress"
				autoCorrect={false}
				returnKeyType="next"
				accessibilityLabel="Email"
			/>

			<FormField
				control={form.control}
				name="password"
				label="Password"
				placeholder="Choose a password"
				hint="At least 8 characters"
				revealable
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={() => onSubmit()}
				accessibilityLabel="Password"
			/>

			<AuthError
				message={failure?.message ?? null}
				{...(failure?.hint === "sign-in"
					? {
							action: {
								label: "Sign in instead →",
								onPress: () => router.push("/(auth)/login"),
							},
						}
					: {})}
			/>

			<Button
				onPress={() => onSubmit()}
				loading={loading}
				style={{ marginTop: failure ? spacing[4] : spacing[2] }}
			>
				Create account
			</Button>
			<Caption
				color="quaternary"
				style={{ textAlign: "center", marginTop: spacing[3] }}
			>
				By continuing you agree to use Nabhya honestly and respectfully.
			</Caption>
		</AuthSplitLayout>
	);
}
