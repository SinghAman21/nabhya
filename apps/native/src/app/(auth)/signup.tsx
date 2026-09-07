import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpSchema } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthError, authErrorCopy } from "@/components/auth-error";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2 } from "@/components/ui/typography";
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
			if (result?.user) {
				setUser(result.user);
			}
			router.replace("/");
		} catch (error) {
			// Inline, above the button — see the same note in `login.tsx`.
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
			<H2 accessibilityRole="header" style={{ marginBottom: spacing[1] }}>
				Create your account
			</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Volunteer, or register your NGO — you'll choose on the next step.
			</Body>

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
				placeholder="At least 8 characters"
				revealable
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={onSubmit}
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
				onPress={onSubmit}
				loading={loading}
				size="lg"
				style={{ marginTop: failure ? spacing[4] : spacing[6] }}
			>
				Create account
			</Button>
			<Caption
				color="quaternary"
				style={{ textAlign: "center", marginTop: spacing[3] }}
			>
				By continuing you agree to use Nabhya honestly and respectfully.
			</Caption>

			<GoogleSignInButton onError={(message) => setFailure({ message })} />
		</AuthSplitLayout>
	);
}
