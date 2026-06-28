import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Body, Caption, H1, H3 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function Home() {
	const { colors, spacing } = useTheme();
	const email = useAuthStore((s) => s.email);
	const orgProfile = useAuthStore((s) => s.orgProfile);
	const isVerified = useAuthStore((s) => s.isVerified);
	const signOut = useAuthStore((s) => s.signOut);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				padding: spacing[6],
				justifyContent: "center",
			}}
		>
			{!isVerified && (
				<View
					style={{
						backgroundColor: colors.warning?.light ?? colors.background.primary,
						borderRadius: 16,
						padding: spacing[4],
						borderWidth: 1,
						borderColor: colors.warning?.main ?? colors.border.medium,
						marginBottom: spacing[4],
					}}
				>
					<Body
						weight="bold"
						color={(colors.warning?.dark ?? colors.text.primary) as string}
					>
						Account not verified
					</Body>
					<Caption color="secondary">
						Complete verification in settings to post and accept donations.
					</Caption>
				</View>
			)}

			<View
				style={{
					backgroundColor: colors.background.primary,
					borderRadius: 24,
					padding: spacing[8],
					borderWidth: 1,
					borderColor: colors.border.light,
					alignItems: "center",
				}}
			>
				<View
					style={{
						width: 64,
						height: 64,
						borderRadius: 32,
						backgroundColor: colors.primary.main,
						alignItems: "center",
						justifyContent: "center",
						marginBottom: spacing[4],
					}}
				>
					<H1
						color={colors.primary.contrast as string}
						style={{ fontSize: 28, lineHeight: 32 }}
					>
						{(orgProfile.orgName || email || "O")[0].toUpperCase()}
					</H1>
				</View>

				<H3 style={{ marginBottom: spacing[1] }}>
					{orgProfile.orgName || "Your Organization"}
				</H3>
				<Body color="tertiary" style={{ marginBottom: spacing[6] }}>
					{email}
				</Body>

				<Body color="secondary" style={{ textAlign: "center" }}>
					Welcome to Nabhya. Your dashboard is ready.
				</Body>
			</View>

			<View
				style={{
					flexDirection: "row",
					gap: spacing[3],
					marginTop: spacing[4],
				}}
			>
				<View style={{ flex: 1 }}>
					<Button variant="outline" onPress={signOut}>
						Sign out
					</Button>
				</View>
			</View>

			<Caption
				color="tertiary"
				style={{ textAlign: "center", marginTop: spacing[8] }}
			>
				Nabhya v1.0 — {isVerified ? "Verified" : "Unverified"}
			</Caption>
		</View>
	);
}
