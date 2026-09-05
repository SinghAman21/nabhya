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
import { useTheme } from "@/hooks/useTheme";
import { Alert } from "@/lib/alert";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
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

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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
				"Sign in failed",
				apiErrorMessage(error, "Please try again."),
			);
		} finally {
			setLoading(false);
		}
	});

	return (
		<AuthSplitLayout
			alternateLink={
				<Pressable onPress={() => router.push("/(auth)/signup")}>
					<Caption color="secondary">
						Don't have an account?{" "}
						<Caption color={colors.primary.main as string} weight="medium">
							Sign up
						</Caption>
					</Caption>
				</Pressable>
			}
		>
			<H2 style={{ marginBottom: spacing[1] }}>Welcome back</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Sign back in to your organization
			</Body>

			<FormField
				control={form.control}
				name="email"
				label="Organization email"
				placeholder="org@example.org"
				keyboardType="email-address"
				autoCapitalize="none"
				autoComplete="email"
				textContentType="emailAddress"
				autoCorrect={false}
				style={inputStyle}
			/>

			<FormField
				control={form.control}
				name="password"
				label="Password"
				placeholder="Enter your password"
				secureTextEntry
				autoComplete="current-password"
				textContentType="password"
				style={inputStyle}
			/>

			<Button
				onPress={onSubmit}
				loading={loading}
				style={{ marginTop: spacing[6] }}
			>
				Sign in
			</Button>
		</AuthSplitLayout>
	);
}
