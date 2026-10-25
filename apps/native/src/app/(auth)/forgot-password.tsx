import { zodResolver } from "@hookform/resolvers/zod";
import {
	type PasswordResetRequestInput,
	passwordResetRequestSchema,
} from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { AuthError, authErrorCopy } from "@/components/auth-error";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Body, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";

/**
 * "Forgot password?" - asks for the email and sends Supabase's reset link,
 * which lands on `reset-password`.
 *
 * The sent state never says an account exists. Supabase answers the same way
 * for an unknown address (anything else is an account-enumeration oracle), so
 * the copy is "if there's an account", not "we found you".
 */
export default function ForgotPassword() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const { email: prefill } = useLocalSearchParams<{ email?: string }>();
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const form = useForm<PasswordResetRequestInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(passwordResetRequestSchema as any),
		defaultValues: { email: prefill ?? "" },
	});

	const onSubmit = form.handleSubmit(async ({ email }) => {
		setLoading(true);
		setFailure(null);
		try {
			await authService.requestPasswordReset(email);
			setSentTo(email);
		} catch (error) {
			setFailure(
				authErrorCopy(
					apiErrorMessage(error, "Couldn't send the link. Try again shortly."),
					"sign-in",
				).message,
			);
		} finally {
			setLoading(false);
		}
	});

	if (sentTo) {
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
					If there's an account for {sentTo}, a reset link is on its way. Open
					it on this device to choose a new password. Check spam if it isn't
					there in a minute.
				</Body>
				<Button onPress={() => router.replace("/(auth)/login")}>
					Back to sign in
				</Button>
				<Button
					variant="link"
					onPress={() => setSentTo(null)}
					style={{ marginTop: spacing[2], alignSelf: "center" }}
				>
					Use a different email
				</Button>
			</AuthSplitLayout>
		);
	}

	return (
		<AuthSplitLayout alternateLink={null}>
			<Title accessibilityRole="header">Reset your password</Title>
			<Body
				color="tertiary"
				style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
			>
				Enter the email you signed up with and we'll send you a link to choose a
				new password.
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
				returnKeyType="go"
				onSubmitEditing={() => onSubmit()}
				accessibilityLabel="Email"
			/>

			<AuthError message={failure} />

			<Button
				onPress={() => onSubmit()}
				loading={loading}
				style={{ marginTop: failure ? spacing[4] : spacing[2] }}
			>
				Send reset link
			</Button>
			<Button
				variant="link"
				onPress={() => router.replace("/(auth)/login")}
				style={{ marginTop: spacing[2], alignSelf: "center" }}
			>
				Back to sign in
			</Button>
		</AuthSplitLayout>
	);
}
