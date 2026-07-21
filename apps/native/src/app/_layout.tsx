import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ThemeProvider } from "@/hooks/useAppTheme";
import { queryClient } from "@/lib/api";
import { storage } from "@/lib/storage";
import { useAuthStore } from "@/store/auth-store";

const THEME_KEY = "nabhya-theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [fontsLoaded, fontsError] = useFonts({
		MonaSans: require("@/assets/fonts/MonaSans-Regular.otf"),
		"MonaSans-Bold": require("@/assets/fonts/MonaSans-Bold.otf"),
		"MonaSans-Medium": require("@/assets/fonts/MonaSans-Medium.otf"),
		"MonaSans-Light": require("@/assets/fonts/MonaSans-Light.otf"),
		NeutralFace: require("@/assets/fonts/NeutralFace.otf"),
		"NeutralFace-Bold": require("@/assets/fonts/NeutralFace-Bold.otf"),
	});

	const [themeRestored, setThemeRestored] = useState(false);
	const isAuthHydrated = useAuthStore((s) => s.isHydrated);

	useEffect(() => {
		storage.get(THEME_KEY).then(() => setThemeRestored(true));
	}, []);

	const ready = (fontsLoaded || fontsError) && themeRestored && isAuthHydrated;

	useEffect(() => {
		if (ready) {
			SplashScreen.hideAsync();
		}
	}, [ready]);

	if (!ready) return null;

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<View style={{ flex: 1 }}>
					<Stack screenOptions={{ headerShown: false }}>
						<Stack.Screen name="index" />
						<Stack.Screen name="(auth)" />
						<Stack.Screen name="role-select" />
						<Stack.Screen name="(onboarding)" />
						<Stack.Screen name="(ngo)" />
						<Stack.Screen name="(volunteer)" />
						<Stack.Screen name="(admin)" />
						{/* Public — browsable without an account */}
						<Stack.Screen name="events" />
						<Stack.Screen name="needs" />
						<Stack.Screen name="organizations" />
						<Stack.Screen name="success" />
					</Stack>
					<PortalHost />
				</View>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
