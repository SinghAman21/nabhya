import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function Index() {
	const user = useAuthStore((s) => s.user);
	const isOnboarded = useAuthStore((s) => s.isOnboarded);
	const { colors } = useTheme();
	const router = useRouter();

	useEffect(() => {
		if (!user) {
			router.replace("/(auth)/login");
		} else if (!isOnboarded) {
			router.replace("/(onboarding)");
		} else {
			router.replace("/(app)");
		}
	}, [user, isOnboarded, router]);

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
