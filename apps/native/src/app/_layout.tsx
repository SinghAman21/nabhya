import "@/lib/crypto-polyfill";
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { OverlayHost } from "@/components/ui/overlay";
import { ThemeProvider } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/api";
import { HEADERLESS } from "@/lib/navigation";
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
				{/* Gesture root for the sheets and any swipe gesture below it. */}
				<GestureHandlerRootView style={{ flex: 1 }}>
					<View style={{ flex: 1 }}>
						<Stack screenOptions={HEADERLESS}>
							<Stack.Screen name="index" />
							<Stack.Screen name="(auth)" />
							<Stack.Screen name="role-select" />
							<Stack.Screen name="(onboarding)" />
							<Stack.Screen name="(ngo)" />
							<Stack.Screen name="(volunteer)" />
							<Stack.Screen name="(admin)" />
							{/* Public - browsable without an account */}
							<Stack.Screen name="events" />
							<Stack.Screen name="certificates" />
							<Stack.Screen name="notifications" />
							<Stack.Screen name="bookmarks" />
							<Stack.Screen name="ngos" />
							<Stack.Screen name="impact" />
							<Stack.Screen name="edit-profile" />
							<Stack.Screen name="verify-identity" />
							<Stack.Screen name="success" />
							<Stack.Screen name="search" />
							<Stack.Screen name="feed" />
							<Stack.Screen name="team/invites/[token]" />
						</Stack>
						<PortalHost />
						{/* Toasts and confirmations. Every open sheet mounts its own
						    host, which takes over while it is up - see the host-stack
						    note in `ui/overlay.tsx`. */}
						<OverlayHost />
					</View>
				</GestureHandlerRootView>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
