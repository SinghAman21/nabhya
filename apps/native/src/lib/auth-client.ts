import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
	baseURL: process.env.EXPO_PUBLIC_BETTER_AUTH_URL!,
	plugins: [
		expoClient({
			storage: SecureStore as {
				getItem: (key: string) => string | null;
				setItem: (key: string, value: string) => unknown;
			},
		}),
	],
});
