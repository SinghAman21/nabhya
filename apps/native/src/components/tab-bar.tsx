import type { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";

/** Bar height above the home-indicator inset. */
export const TAB_BAR_HEIGHT = 60;

/**
 * The options object is typed off `Tabs` itself rather than
 * `@react-navigation/bottom-tabs`, which is a transitive dependency of
 * expo-router and not resolvable from this workspace.
 */
type TabScreenOptions = Exclude<
	React.ComponentProps<typeof Tabs>["screenOptions"],
	undefined | ((...args: never[]) => unknown)
>;

/**
 * One definition of the bottom bar, shared by `(volunteer)`, `(ngo)` and
 * `(admin)` instead of being re-typed in each layout.
 *
 * Two things are pinned deliberately:
 *
 * - `tabBarLabelPosition: "below-icon"`. React Navigation silently switches to
 *   `beside-icon` on anything it considers wide — landscape phones, tablets, and
 *   every browser window — so the same app showed icon-above-label on a phone
 *   and icon-beside-label on web. A tab is a stack, never a row.
 * - The safe-area inset is added to the bar rather than left to the navigator,
 *   so labels sit clear of the home indicator instead of on it.
 */
export function useTabBarOptions(): TabScreenOptions {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	return {
		headerShown: false,
		// Monochrome, like the desktop rail: orange is reserved for actions, and
		// the tab you are already on is not one.
		tabBarActiveTintColor: colors.text.primary as string,
		tabBarInactiveTintColor: colors.text.quaternary as string,
		tabBarLabelPosition: "below-icon",
		tabBarLabelStyle: {
			fontFamily: fonts.sansMedium,
			fontSize: 11,
			lineHeight: 14,
			marginTop: 4,
		},
		tabBarIconStyle: {
			height: 22,
			marginTop: 2,
		},
		tabBarItemStyle: {
			paddingTop: 8,
			paddingBottom: 6,
		},
		tabBarStyle: {
			height: TAB_BAR_HEIGHT + insets.bottom,
			paddingBottom: insets.bottom,
			backgroundColor: colors.background.card as string,
			borderTopColor: colors.border.hairline as string,
			borderTopWidth: 1,
			elevation: 0,
		},
	};
}
