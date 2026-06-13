import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { Platform, useColorScheme } from "react-native";
import { storage } from "@/lib/storage";

const THEME_KEY = "nabhya-theme";

interface ThemeContextType {
	isDark: boolean;
	toggleTheme: () => void;
	setColorScheme: (scheme: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType>({
	isDark: false,
	toggleTheme: () => {},
	setColorScheme: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const systemScheme = useColorScheme();
	const [preference, setPreference] = useState<"light" | "dark" | null>(null);
	const [restored, setRestored] = useState(false);

	useEffect(() => {
		storage.get(THEME_KEY).then((saved: string | null) => {
			if (saved === "light" || saved === "dark" || saved === null) {
				setPreference(saved);
			}
			setRestored(true);
		});
	}, []);

	const effectiveIsDark =
		preference === "light"
			? false
			: preference === "dark"
				? true
				: systemScheme === "dark";

	useEffect(() => {
		if (Platform.OS === "web" && restored) {
			if (effectiveIsDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}
	}, [effectiveIsDark, restored]);

	const toggleTheme = useCallback(() => {
		const next = effectiveIsDark ? "light" : "dark";
		setPreference(next);
		storage.set(THEME_KEY, next);
	}, [effectiveIsDark]);

	const setColorScheme = useCallback((scheme: "light" | "dark" | "system") => {
		if (scheme === "system") {
			setPreference(null);
			storage.remove(THEME_KEY);
		} else {
			setPreference(scheme);
			storage.set(THEME_KEY, scheme);
		}
	}, []);

	if (!restored) return null;

	return (
		<ThemeContext.Provider
			value={{
				isDark: effectiveIsDark,
				toggleTheme,
				setColorScheme,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}
