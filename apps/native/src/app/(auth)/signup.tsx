import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpSchema } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable } from "react-native";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export default function SignUp() {
	const { colors, spacing } = useTheme();
	const setUser = useAuthStore((s) => s.setUser);
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const form = useForm<SignUpInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(signUpSchema as any),
		defaultValues: { email: "", password: "", name: "" },
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
			const result = await authService.signup({
				email: data.email,
				password: data.password,
				name: data.name,
			});
			if (result?.user) {
				setUser(result.user);
			}
			router.replace("/");
		} catch {
			Alert.alert("Error", "Sign up failed. Please try again.");
		} finally {
			setLoading(false);
		}
	});

	return (
		<AuthSplitLayout
			alternateLink={
				<Pressable onPress={() => router.push("/(auth)/login")}>
					<Caption color="secondary">
						Already have an account?{" "}
						<Caption color={colors.primary.main as string} weight="medium">
							Sign in
						</Caption>
					</Caption>
				</Pressable>
			}
		>
			<H2 style={{ marginBottom: spacing[1] }}>Register your NGO</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Create your account to get started
			</Body>

			<FormField
				control={form.control}
				name="name"
				label="Full name"
				placeholder="Your full name"
				autoCapitalize="words"
				style={inputStyle}
			/>

			<FormField
				control={form.control}
				name="email"
				label="Organization email"
				placeholder="org@example.org"
				keyboardType="email-address"
				autoCapitalize="none"
				style={inputStyle}
			/>

			<FormField
				control={form.control}
				name="password"
				label="Password"
				placeholder="Create a strong password"
				secureTextEntry
				style={inputStyle}
			/>

			<Button
				onPress={onSubmit}
				loading={loading}
				style={{ marginTop: spacing[6] }}
			>
				Create account
			</Button>
		</AuthSplitLayout>
	);
}
