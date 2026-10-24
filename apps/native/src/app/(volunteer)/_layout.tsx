import { Redirect, Slot, Tabs } from "expo-router";
import { History, Home, User } from "lucide-react-native";
import { View } from "react-native";
import { renderTabBar, useTabBarOptions } from "@/components/tab-bar";
import { TopBar, TopBarContent } from "@/components/top-bar";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

/*
 * Route names here must not repeat one in `(ngo)`: groups drop out of the URL,
 * so a reload of a shared `/profile` resolved to the NGO screen, whose guard
 * bounced the volunteer and looped the root Stack. Hence `me` and `giving`.
 */
export default function VolunteerLayout() {
	const role = useAuthStore((s) => s.role);
	const email = useAuthStore((s) => s.email);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const tabBarOptions = useTabBarOptions();

	// Signed out: straight to sign-in, never via "/" - the gate there replaces
	// itself with login, and a layout still mounted for that frame redirecting
	// back to "/" looped the root Stack ("Maximum update depth exceeded").
	if (!email) return <Redirect href="/(auth)/login" />;
	if (role !== "volunteer") return <Redirect href="/" />;

	/*
	 * Desktop uses a top bar, not the sidebar the other two roles get: three
	 * destinations do not need a rail, and the feed grid wants the width. See
	 * `components/top-bar.tsx`.
	 */
	if (isDesktop) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<TopBar
					home="/(volunteer)"
					activityHref="/(volunteer)/activity"
					profileHref="/(volunteer)/me"
					searchable
				/>
				<TopBarContent>
					<Slot />
				</TopBarContent>
			</View>
		);
	}

	return (
		<View style={{ flex: 1 }}>
			<Tabs screenOptions={tabBarOptions} tabBar={renderTabBar}>
				<Tabs.Screen
					name="index"
					options={{
						title: "Home",
						tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
					}}
				/>
				<Tabs.Screen
					name="activity"
					options={{
						title: "Activity",
						tabBarIcon: ({ color, size }) => (
							<History size={size} color={color} />
						),
					}}
				/>
				{/* Still routable - Activity links into them for the fuller list -
				    but no longer destinations of their own. */}
				<Tabs.Screen name="giving" options={{ href: null }} />
				<Tabs.Screen name="applications" options={{ href: null }} />
				<Tabs.Screen
					name="me"
					options={{
						title: "Profile",
						tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
					}}
				/>
			</Tabs>
		</View>
	);
}
