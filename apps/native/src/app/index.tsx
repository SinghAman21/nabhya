import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function Index() {
	const email = useAuthStore((s) => s.email);
	const role = useAuthStore((s) => s.role);
	const isOnboarded = useAuthStore((s) => s.isOnboarded);
	const { colors } = useTheme();
	const router = useRouter();

	useEffect(() => {
		if (!email) {
			router.replace("/(auth)/login");
		} else if (!role) {
			router.replace("/role-select" as any);
		} else if (role === "ngo" && !isOnboarded) {
			router.replace("/(onboarding)");
		} else if (role === "ngo") {
			router.replace("/(ngo)" as any);
		} else {
			router.replace("/(volunteer)" as any);
		}
	}, [email, role, isOnboarded, router]);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				alignItems: "center",
				justifyContent: "center",
			}}
		/>
	);
}
