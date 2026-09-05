import { Platform } from "react-native";

const isWeb =
	Platform.OS === "web" && typeof globalThis.localStorage !== "undefined";
const isServer = Platform.OS === "web" && typeof window === "undefined";

export const storage = {
	async get(key: string): Promise<string | null> {
		if (isServer) return null;
		if (isWeb) return globalThis.localStorage.getItem(key);
		const { getItemAsync } = await import("expo-secure-store");
		return getItemAsync(key);
	},
	async set(key: string, value: string): Promise<void> {
		if (isServer) return;
		if (isWeb) {
			globalThis.localStorage.setItem(key, value);
			return;
		}
		const { setItemAsync } = await import("expo-secure-store");
		return setItemAsync(key, value);
	},
	async remove(key: string): Promise<void> {
		if (isServer) return;
		if (isWeb) {
			globalThis.localStorage.removeItem(key);
			return;
		}
		const { deleteItemAsync } = await import("expo-secure-store");
		return deleteItemAsync(key);
	},
};
