import type { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { fonts } from "@/constants/fonts";
import { useTheme } from "@/hooks/use-theme";
import { HEADERLESS } from "@/lib/navigation";

/** Bar height above the home-indicator inset. */
export const TAB_BAR_HEIGHT = 60;

type TabsProps = React.ComponentProps<typeof Tabs>;
type TabScreenOptions = Exclude<
	TabsProps["screenOptions"],
	undefined | ((...args: never[]) => unknown)
>;
type TabBarProps = Parameters<NonNullable<TabsProps["tabBar"]>>[0];

/**
 * Navigator-level options shared by `(volunteer)`, `(ngo)` and `(admin)`. The
 * bar itself is drawn by `AppTabBar` below, so nothing about its appearance is
 * configured here - a module constant keeps the identity stable, which React
 * Navigation compares on every render.
 */
export function useTabBarOptions(): TabScreenOptions {
	return HEADERLESS;
}

/**
 * The bottom bar, drawn by hand.
 *
 * React Navigation's default bar was clipping labels: its item is a flex row
 * that switches to icon-beside-label on anything it considers wide, its label
 * gets an inherited `lineHeight` too tight for the loaded font, and its height
 * math ignores the padding we set. Owning the ~60 lines means the layout is
 * exactly icon above label, both centred, every tab the same width, and the
 * safe-area inset added underneath rather than eaten from the label.
 *
 * Monochrome, like the desktop rail: orange is reserved for actions, and the
 * tab you are already on is not one.
 */
export function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();

	// Expo Router hides `href: null` screens by setting `display: "none"` on
	// the item style; mirror that rather than inventing a second convention.
	const visible = state.routes.filter((route) => {
		const style = StyleSheet.flatten(
			descriptors[route.key]?.options.tabBarItemStyle,
		);
		return style?.display !== "none";
	});

	return (
		<View
			accessibilityRole="tablist"
			style={{
				flexDirection: "row",
				height: TAB_BAR_HEIGHT + insets.bottom,
				paddingBottom: insets.bottom,
				backgroundColor: colors.background.card,
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
			}}
		>
			{visible.map((route) => {
				const descriptor = descriptors[route.key];
				const options = descriptor?.options ?? {};
				const focused = state.routes[state.index]?.key === route.key;
				const label =
					typeof options.title === "string" ? options.title : route.name;
				const color = (
					focused ? colors.text.primary : colors.text.quaternary
				) as string;

				const onPress = () => {
					const event = navigation.emit({
						type: "tabPress",
						target: route.key,
						canPreventDefault: true,
					});
					if (!focused && !event.defaultPrevented) {
						navigation.navigate(route.name);
					}
				};

				return (
					<Pressable
						key={route.key}
						onPress={onPress}
						onLongPress={() =>
							navigation.emit({ type: "tabLongPress", target: route.key })
						}
						accessibilityRole="tab"
						accessibilityState={{ selected: focused }}
						accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
						style={({ pressed }) => ({
							flex: 1,
							alignItems: "center",
							justifyContent: "center",
							gap: spacing[1],
							paddingTop: spacing[1.5],
							opacity: pressed ? 0.6 : 1,
						})}
					>
						<View
							style={{
								height: 24,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{options.tabBarIcon?.({ focused, color, size: 23 })}
						</View>
						<Text
							numberOfLines={1}
							maxFontSizeMultiplier={1.2}
							style={{
								fontFamily: focused ? fonts.sansBold : fonts.sansMedium,
								fontSize: 11,
								lineHeight: 14,
								letterSpacing: 0.1,
								color,
							}}
						>
							{label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

/** Pass as `<Tabs tabBar={renderTabBar}>`. */
export const renderTabBar = (props: TabBarProps) => <AppTabBar {...props} />;
