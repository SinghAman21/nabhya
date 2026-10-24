import { Redirect, Slot, Tabs } from "expo-router";
import {
	Building2,
	FileCheck2,
	LayoutDashboard,
	ScrollText,
	Users,
} from "lucide-react-native";
import { Platform, View, type ViewStyle } from "react-native";
import { ADMIN_NAV_ITEMS } from "@/components/nav-items";
import { Sidebar } from "@/components/sidebar";
import { renderTabBar, useTabBarOptions } from "@/components/tab-bar";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/**
 * A hard height for the desktop shell - the same pin `(ngo)/_layout.tsx`
 * carries, and for the same reason.
 *
 * Every scroll region in the app is a `ScrollView` or `FlatList` whose height
 * comes from a chain of `flex: 1` ancestors. On the web that chain is only as
 * good as its weakest link: if any ancestor resolves to content height instead
 * of viewport height, the list grows to fit its content, the `View` above it
 * clips at `overflow: hidden`, and the page silently becomes unscrollable - no
 * scrollbar, no wheel response, rows simply gone below the fold. This shell had
 * a bare `flex: 1` content column, which is the failure the NGO layout wrote
 * three paragraphs about; the admin lists are the longest in the app, so it is
 * the console that could least afford it.
 *
 * `dvh` rather than `vh` so a mobile browser's collapsing toolbar does not leave
 * the bottom of the pane under the address bar. Native keeps plain `flex: 1`,
 * where Yoga bounds it correctly already. Cast because React Native's `height`
 * takes only numbers and percentages; `dvh` is a CSS unit react-native-web
 * passes straight through.
 */
const SHELL_HEIGHT: ViewStyle =
	Platform.OS === "web" ? ({ height: "100dvh" } as unknown as ViewStyle) : {};

/**
 * Superadmin console. The client-side role check here is convenience only -
 * every /api/admin route is guarded by @Roles("superadmin") on the server.
 *
 * There is no content-width cap here, unlike `(ngo)`, and none in the screens
 * either: `AdminScreen` is full width by design, because a table's flexing
 * column is what should take a wide monitor's slack (see `list-chrome.tsx`).
 *
 * The phone tabs are in the rail's order (`ADMIN_NAV_ITEMS`): Overview, Queue,
 * then the two directories, then Activity. They used to put Queue fourth, so
 * the same screen moved two places when a window crossed the breakpoint.
 */
export default function AdminLayout() {
	const role = useAuthStore((s) => s.role);
	const email = useAuthStore((s) => s.email);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const tabBarOptions = useTabBarOptions();

	// Signed out: straight to sign-in, never via "/" - the gate there replaces
	// itself with login, and a layout still mounted for that frame redirecting
	// back to "/" looped the root Stack ("Maximum update depth exceeded").
	if (!email) return <Redirect href="/(auth)/login" />;
	if (role !== "superadmin") return <Redirect href="/" />;

	if (isDesktop) {
		return (
			<View
				style={{
					flex: 1,
					...SHELL_HEIGHT,
					flexDirection: "row",
					backgroundColor: colors.background.warm,
				}}
			>
				<Sidebar navItems={ADMIN_NAV_ITEMS} brandTitle="Superadmin" />
				<View
					style={{
						flex: 1,
						// Without these a flex item is floored at its content size,
						// which is the other half of the unscrollable-page problem
						// described above.
						minWidth: 0,
						minHeight: 0,
					}}
				>
					<Slot />
				</View>
			</View>
		);
	}

	return (
		<View style={{ flex: 1 }}>
			<Tabs screenOptions={tabBarOptions} tabBar={renderTabBar}>
				<Tabs.Screen
					name="index"
					options={{
						title: "Overview",
						tabBarIcon: ({ color, size }) => (
							<LayoutDashboard size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="queue"
					options={{
						title: "Queue",
						tabBarIcon: ({ color, size }) => (
							<FileCheck2 size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="organizations"
					options={{
						title: "NGOs",
						tabBarIcon: ({ color, size }) => (
							<Building2 size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="volunteers"
					options={{
						title: "Volunteers",
						tabBarIcon: ({ color, size }) => (
							<Users size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="audit"
					options={{
						title: "Activity",
						tabBarIcon: ({ color, size }) => (
							<ScrollText size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen name="categories" options={{ href: null }} />
				{/* Off the phone tab bar like Causes: reached from Overview. */}
				<Tabs.Screen name="finance" options={{ href: null }} />
			</Tabs>
		</View>
	);
}
