import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpSchema } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { Pressable } from "react-native";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function SignUp() {
	const { colors, spacing } = useTheme();
	const signUp = useAuthStore((s) => s.signUp);
	const router = useRouter();
	const form = useForm<SignUpInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(signUpSchema as any),
		defaultValues: { email: "" },
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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
				Enter your organization email to get started
			</Body>

			<FormField
				control={form.control}
				name="email"
				label="Organization email"
				placeholder="org@example.org"
				keyboardType="email-address"
				autoCapitalize="none"
				style={inputStyle}
			/>

			<Button
				onPress={form.handleSubmit((data) => {
					signUp(data.email);
					router.replace("/(onboarding)");
				})}
				style={{ marginTop: spacing[6] }}
			>
				Create account
			</Button>
		</AuthSplitLayout>
	);
}
