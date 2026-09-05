import { zodResolver } from "@hookform/resolvers/zod";
import { type SignInInput, signInSchema } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
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
	const form = useForm<SignInInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(signInSchema as any),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = form.handleSubmit(async (data) => {
		setLoading(true);
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
			// The real reason matters here — "email not confirmed", a 401 from the
			// API, or a network failure each need a different response from the
			// user, and a fixed string told them none of it.
			Alert.alert(
				"Couldn't sign you in",
				apiErrorMessage(
					error,
					"Check your email and password, then try again.",
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
			<H2 accessibilityRole="header" style={{ marginBottom: spacing[1] }}>
				Welcome back
			</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Sign in to pick up where you left off.
			</Body>

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
				secureTextEntry
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={onSubmit}
				accessibilityLabel="Password"
			/>

			<Button
				onPress={onSubmit}
				loading={loading}
				size="lg"
				style={{ marginTop: spacing[6] }}
			>
				Sign in
			</Button>
		</AuthSplitLayout>
	);
}
