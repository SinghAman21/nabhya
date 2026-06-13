import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Body, Caption, H1 } from "@/components/ui/typography";
import { useSignIn } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";

export default function Login() {
	const { colors, borderRadius, spacing } = useTheme();
	const signIn = useSignIn();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const handleLogin = () => {
		signIn.mutate({ email, password });
	};

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H1 style={{ marginBottom: spacing[8] }}>Welcome back</H1>

			<TextInput
				placeholder="Email"
				placeholderTextColor={colors.text.quaternary}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				style={{
					fontFamily: "MonaSans",
					fontSize: 16,
					color: colors.text.primary,
					backgroundColor: colors.background.primary,
					borderColor: colors.border.medium,
					borderWidth: 1,
					borderRadius: borderRadius.md,
					padding: spacing[4],
					marginBottom: spacing[4],
				}}
			/>

			<TextInput
				placeholder="Password"
				placeholderTextColor={colors.text.quaternary}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				style={{
					fontFamily: "MonaSans",
					fontSize: 16,
					color: colors.text.primary,
					backgroundColor: colors.background.primary,
					borderColor: colors.border.medium,
					borderWidth: 1,
					borderRadius: borderRadius.md,
					padding: spacing[4],
					marginBottom: spacing[6],
				}}
			/>

			{signIn.error && (
				<Caption
					color={colors.error.main as string}
					style={{ marginBottom: spacing[3] }}
				>
					{signIn.error.message}
				</Caption>
			)}

			<Pressable
				onPress={handleLogin}
				disabled={signIn.isPending}
				style={{
					backgroundColor: colors.primary.main,
					padding: spacing[4],
					borderRadius: borderRadius.lg,
					alignItems: "center",
					opacity: signIn.isPending ? 0.6 : 1,
				}}
			>
				{signIn.isPending ? (
					<ActivityIndicator color={colors.primary.contrast} />
				) : (
					<Body color={colors.primary.contrast as string} weight="bold">
						Sign in
					</Body>
				)}
			</Pressable>

			<Pressable
				onPress={() => router.push("/(auth)/signup")}
				style={{ marginTop: spacing[4] }}
			>
				<Caption color="secondary" style={{ textAlign: "center" }}>
					Don't have an account? Sign up
				</Caption>
			</Pressable>
		</View>
	);
}
