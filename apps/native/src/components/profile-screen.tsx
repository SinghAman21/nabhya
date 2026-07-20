import type { Role } from "@nabhya/shared";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

const ROLE_LABELS: Record<Role, string> = {
	organisation: "an NGO",
	volunteer: "a volunteer",
	superadmin: "a platform admin",
};

export function ProfileScreen() {
	const { colors, spacing } = useTheme();
	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const signOut = useAuthStore((s) => s.signOut);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				padding: spacing[6],
			}}
		>
			<H2 style={{ marginBottom: spacing[1] }}>Profile</H2>
			<Body color="secondary" style={{ marginBottom: spacing[2] }}>
				{email}
			</Body>
			<Caption color="tertiary" style={{ marginBottom: spacing[6] }}>
				Signed in as {ROLE_LABELS[role ?? "volunteer"]}
			</Caption>
			<Button variant="outline" onPress={signOut}>
				Sign out
			</Button>
		</View>
	);
}
