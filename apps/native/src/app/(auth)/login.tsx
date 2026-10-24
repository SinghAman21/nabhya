import { zodResolver } from "@hookform/resolvers/zod";
import { type SignInInput, signInSchema } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthError, authErrorCopy } from "@/components/auth-error";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
import { focusable } from "@/lib/focus";
import { useAuthStore } from "@/store/auth-store";

export default function Login() {
	const { colors, spacing } = useTheme();
	const setUser = useAuthStore((s) => s.setUser);
	const queryClient = useQueryClient();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<{
		message: string;
		hint?: "sign-up" | "sign-in";
	} | null>(null);
	const form = useForm<SignInInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(signInSchema as any),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = form.handleSubmit(async (data) => {
		setLoading(true);
		setFailure(null);
		try {
			const result = await authService.login({
				email: data.email,
				password: data.password,
			});
			if (result?.user) {
				setUser(result.user);
				queryClient.removeQueries();
			}
			router.replace("/");
		} catch (error) {
			// Inline, above the button, rather than in an OS dialog you have to
			// dismiss before you can see the field you got wrong. The real reason
			// matters here - a wrong password, an unconfirmed email and a dead
			// network each need a different response from the user.
			setFailure(
				authErrorCopy(
					apiErrorMessage(
						error,
						"Check your email and password, then try again.",
					),
					"sign-in",
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
					onPress={() => router.push("/(auth)/signup")}
					accessibilityRole="link"
					accessibilityLabel="New here? Create an account"
					hitSlop={8}
					{...focusable}
				>
					<Caption color="secondary">
						New here?{" "}
						<Caption color={colors.primary.ink} weight="semibold">
							Create an account
						</Caption>
					</Caption>
				</Pressable>
			}
		>
			<Title accessibilityRole="header">Welcome back</Title>
			<Body
				color="tertiary"
				style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
			>
				Sign in to your volunteer or NGO account.
			</Body>

			<GoogleSignInButton onError={(message) => setFailure({ message })} />

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
				placeholder="Your password"
				revealable
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={onSubmit}
				accessibilityLabel="Password"
				labelAction={
					<TextAction
						label="Forgot password?"
						tone="brand"
						onPress={() =>
							router.push({
								pathname: "/(auth)/forgot-password",
								params: { email: form.getValues("email") },
							})
						}
					/>
				}
			/>

			<AuthError
				message={failure?.message ?? null}
				{...(failure?.hint === "sign-up"
					? {
							action: {
								label: "Create an account →",
								onPress: () => router.push("/(auth)/signup"),
							},
						}
					: {})}
			/>

			<Button
				onPress={onSubmit}
				loading={loading}
				style={{ marginTop: failure ? spacing[4] : spacing[2] }}
			>
				Sign in
			</Button>
		</AuthSplitLayout>
	);
}
