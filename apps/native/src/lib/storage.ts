import { Platform } from "react-native";

// Platform.OS is "web" during Expo Router's static render too (app.json sets
// web.output: "static"), but that pass runs in Node, where there is no
// localStorage — reaching for it threw and took the dev server down. There is
// no session to read while prerendering, so treat it as empty storage.
const isWeb = Platform.OS === "web";
const hasLocalStorage = isWeb && typeof localStorage !== "undefined";

export const storage = {
	async get(key: string): Promise<string | null> {
		if (isWeb) return hasLocalStorage ? localStorage.getItem(key) : null;
		const { getItemAsync } = await import("expo-secure-store");
		return getItemAsync(key);
	},
	async set(key: string, value: string): Promise<void> {
		if (isWeb) {
			if (hasLocalStorage) localStorage.setItem(key, value);
			return;
		}
		const { setItemAsync } = await import("expo-secure-store");
		return setItemAsync(key, value);
	},
	async remove(key: string): Promise<void> {
		if (isWeb) {
			if (hasLocalStorage) localStorage.removeItem(key);
			return;
		}
		const { deleteItemAsync } = await import("expo-secure-store");
		return deleteItemAsync(key);
	},
};
