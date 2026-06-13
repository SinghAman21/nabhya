import { Pressable, View } from "react-native";
import { Body, Caption, H1 } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function Home() {
	const { colors, spacing, borderRadius } = useTheme();
	const user = useAuthStore((s) => s.user);
	const { isDark, toggleTheme } = useAppTheme();
	const signOut = useSignOut();

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H1 style={{ marginBottom: spacing[2] }}>Dashboard</H1>
			<Body color="secondary" style={{ marginBottom: spacing[8] }}>
				Welcome, {user?.email}
			</Body>

			<Pressable
				onPress={toggleTheme}
				style={{
					backgroundColor: colors.primary.main,
					padding: spacing[4],
					borderRadius: borderRadius.lg,
					alignItems: "center",
					marginBottom: spacing[3],
				}}
			>
				<Body color={colors.primary.contrast as string} weight="bold">
					Switch to {isDark ? "Light" : "Dark"} mode
				</Body>
			</Pressable>

			<Pressable
				onPress={() => signOut.mutate()}
				disabled={signOut.isPending}
				style={{
					backgroundColor: colors.background.primary,
					padding: spacing[4],
					borderRadius: borderRadius.lg,
					alignItems: "center",
					borderColor: colors.border.medium,
					borderWidth: 1,
				}}
			>
				<Body weight="bold">
					{signOut.isPending ? "Signing out..." : "Sign out"}
				</Body>
			</Pressable>

			<Caption
				color="tertiary"
				style={{ textAlign: "center", marginTop: spacing[8] }}
			>
				Nabhya v1.0
			</Caption>
		</View>
	);
}
