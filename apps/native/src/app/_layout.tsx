import "./../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { useFonts } from "expo-font";
import { ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { NAV_THEME } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

	const [loaded, error] = useFonts({
		"LineSeedSans-Bold": require("@/assets/fonts/LINESeedSans-Bold.otf"),
		"LineSeedSans-Regular": require("@/assets/fonts/LINESeedSans-Regular.otf"),
		"MonaSans-Regular": require("@/assets/fonts/MonaSans-Regular.otf"),
		"NeutralFace-Bold": require("@/assets/fonts/NeutralFace-Bold.otf"),
		NeutralFace: require("@/assets/fonts/NeutralFace.otf"),
	});

	useEffect(() => {
		if (loaded || error) {
			SplashScreen.hideAsync();
		}
	}, [loaded, error]);

	if (!loaded && !error) {
		return null;
	}

	return (
		<ThemeProvider value={theme}>
			<AnimatedSplashOverlay />
			<AppTabs />
			<PortalHost />
		</ThemeProvider>
	);
}
