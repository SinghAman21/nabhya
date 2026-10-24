import { zodResolver } from "@hookform/resolvers/zod";
import { type NewPasswordInput, newPasswordSchema } from "@nabhya/shared";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View } from "react-native";
import { AuthError, authErrorCopy } from "@/components/auth-error";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { Body, Title } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/store/auth-store";

/**
 * Where a password-reset email lands. The link carries a short-lived recovery
 * session (web: parsed from the address bar by Supabase; native: in the deep
 * link's fragment), which is the only thing allowed to set a new password.
 * A link that has expired or was already used has no session, and says so
 * with a way to ask for another rather than showing a form that cannot work.
 */
export default function ResetPassword() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const queryClient = useQueryClient();
	const setUser = useAuthStore((s) => s.setUser);
	const url = Linking.useURL();
	const [state, setState] = useState<"checking" | "ready" | "invalid">(
		"checking",
	);
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const form = useForm<NewPasswordInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(newPasswordSchema as any),
		defaultValues: { password: "" },
	});

	useEffect(() => {
		let live = true;
		authService
			.startPasswordRecovery(url)
			.then((ok) => {
				if (live) setState(ok ? "ready" : "invalid");
			})
			.catch(() => {
				if (live) setState("invalid");
			});
		return () => {
			live = false;
		};
	}, [url]);

	const onSubmit = form.handleSubmit(async ({ password }) => {
		setLoading(true);
		setFailure(null);
		try {
			const result = await authService.updatePassword(password);
			queryClient.removeQueries();
			setUser(result.user);
			toast.success("Password changed - you're signed in.");
			router.replace("/");
		} catch (error) {
			setFailure(
				authErrorCopy(
					apiErrorMessage(error, "Couldn't change your password. Try again."),
					"sign-up",
				).message,
			);
		} finally {
			setLoading(false);
		}
	});

	if (state === "checking") {
		return (
			<AuthSplitLayout alternateLink={null}>
				<View style={{ paddingVertical: spacing[12], alignItems: "center" }}>
					<ActivityIndicator color={colors.primary.ink as string} />
				</View>
			</AuthSplitLayout>
		);
	}

	if (state === "invalid") {
		return (
			<AuthSplitLayout alternateLink={null}>
				<Title accessibilityRole="header">This link no longer works</Title>
				<Body
					color="tertiary"
					style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
				>
					Reset links work once and only for a short while. Ask for a new one
					and open it on this device.
				</Body>
				<Button onPress={() => router.replace("/(auth)/forgot-password")}>
					Send a new link
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

	return (
		<AuthSplitLayout alternateLink={null}>
			<Title accessibilityRole="header">Choose a new password</Title>
			<Body
				color="tertiary"
				style={{ marginTop: spacing[1], marginBottom: spacing[7] }}
			>
				You'll be signed in once it's saved.
			</Body>

			<FormField
				control={form.control}
				name="password"
				label="New password"
				placeholder="Choose a password"
				hint="At least 8 characters"
				revealable
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={onSubmit}
				accessibilityLabel="New password"
			/>

			<AuthError message={failure} />

			<Button
				onPress={onSubmit}
				loading={loading}
				style={{ marginTop: failure ? spacing[4] : spacing[2] }}
			>
				Save password
			</Button>
		</AuthSplitLayout>
	);
}
