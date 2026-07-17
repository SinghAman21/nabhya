import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Body, Caption, H2, Mono } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { apiClient } from "@/lib/api";
import { USERS } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth-store";

export default function Success() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const [response, setResponse] = useState<object | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		apiClient
			.get(USERS.ME)
			.then((res) => setResponse(res.data))
			.catch((err) => setError(err.message));
	}, []);

	return (
		<ScrollView
			contentContainerStyle={{
				flexGrow: 1,
				justifyContent: "center",
				padding: spacing[8],
				backgroundColor: colors.background.warm,
			}}
		>
			<View style={{ alignItems: "center", marginBottom: spacing[8] }}>
				<View
					style={{
						width: 72,
						height: 72,
						borderRadius: 36,
						backgroundColor: colors.success?.main ?? "#22c55e",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: spacing[4],
					}}
				>
					<Body
						color="#fff"
						weight="bold"
						style={{ fontSize: 32, lineHeight: 36 }}
					>
						✓
					</Body>
				</View>

				<H2 style={{ marginBottom: spacing[2], textAlign: "center" }}>
					Logged in successfully
				</H2>
				<Body color="secondary" style={{ textAlign: "center" }}>
					{email}
				</Body>
			</View>

			{error && (
				<View
					style={{
						backgroundColor: colors.error?.light ?? "#fee2e2",
						borderRadius: 12,
						padding: spacing[4],
						marginBottom: spacing[6],
					}}
				>
					<Body color={colors.error?.main ?? "#ef4444"}>
						API Error: {error}
					</Body>
				</View>
			)}

			{response && (
				<View
					style={{
						backgroundColor: colors.background.primary,
						borderRadius: 12,
						padding: spacing[4],
						borderWidth: 1,
						borderColor: colors.border.light,
						marginBottom: spacing[6],
					}}
				>
					<Caption color="tertiary" style={{ marginBottom: spacing[2] }}>
						Backend response — GET /api/users/me
					</Caption>
					<Mono style={{ fontSize: 12, lineHeight: 18 }}>
						{JSON.stringify(response, null, 2)}
					</Mono>
				</View>
			)}

			<Button onPress={() => router.replace("/(app)")} variant="outline">
				Go to dashboard
			</Button>
		</ScrollView>
	);
}
