import { Platform } from "react-native";

/**
 * Dev fallback per platform: the Android emulator maps the host machine's
 * loopback to 10.0.2.2; localhost only works on iOS simulator / web.
 * Physical devices must set EXPO_PUBLIC_API_URL to the machine's LAN IP.
 */
const devFallback = Platform.select({
	android: "http://10.0.2.2:3000",
	default: "http://localhost:3000",
});

function resolveApiUrl(): string {
	const url = process.env.EXPO_PUBLIC_API_URL;
	if (url) return url;
	if (__DEV__) return devFallback;
	throw new Error("EXPO_PUBLIC_API_URL must be set in production builds");
}

export const API_URL = resolveApiUrl();
