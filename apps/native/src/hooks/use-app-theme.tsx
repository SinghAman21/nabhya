import { colorScheme as nativewindColorScheme } from "nativewind";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Platform, useColorScheme } from "react-native";
import { storage } from "@/lib/storage";
import { applyWebStyles } from "@/lib/web-styles";

const THEME_KEY = "nabhya-theme";

type ColorSchemePreference = "light" | "dark" | "system";

interface ThemeContextType {
	isDark: boolean;
	/** What the user chose, so a settings row can show it. */
	preference: ColorSchemePreference;
	toggleTheme: () => void;
	setColorScheme: (scheme: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType>({
	isDark: false,
	preference: "system",
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

	/*
	 * Tell NativeWind which scheme is active. The Tailwind config is
	 * `darkMode: "class"`, which means the `dark:` variant is driven manually —
	 * without this call it never activates on native, so every `components/ui/*`
	 * primitive would render its light palette inside a dark screen.
	 */
	useEffect(() => {
		if (!restored) return;
		nativewindColorScheme.set(effectiveIsDark ? "dark" : "light");
	}, [effectiveIsDark, restored]);

	// Web also needs the class on <html> so the CSS variables in global.css swap.
	useEffect(() => {
		if (Platform.OS === "web" && restored) {
			if (effectiveIsDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}
	}, [effectiveIsDark, restored]);

	/*
	 * The web-only rules that cannot be expressed as React Native styles: the
	 * scrollbar, and lifting Radix poppers above the sheet's modal. Injected
	 * rather than written in `global.css`, because raw `::-webkit-scrollbar`
	 * and attribute selectors do not survive NativeWind's compilation of that
	 * stylesheet. This is also the only place that knows the resolved scheme,
	 * which is what makes the scrollbar thumb theme-aware.
	 * See `lib/web-styles.ts`.
	 */
	useEffect(() => {
		if (restored) applyWebStyles(effectiveIsDark);
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

	// Memoised: this value feeds every `useTheme()` in the app, so a fresh object
	// here re-renders the whole tree on any provider render.
	const value = useMemo(
		() => ({
			isDark: effectiveIsDark,
			preference: (preference ?? "system") as ColorSchemePreference,
			toggleTheme,
			setColorScheme,
		}),
		[effectiveIsDark, preference, toggleTheme, setColorScheme],
	);

	if (!restored) return null;

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}
