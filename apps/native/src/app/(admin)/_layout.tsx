import { Redirect, Slot, Tabs } from "expo-router";
import {
	Building2,
	FileCheck2,
	LayoutDashboard,
	ScrollText,
	Users,
} from "lucide-react-native";
import { View } from "react-native";
import { type NavItem, Sidebar } from "@/components/sidebar";
import { renderTabBar, useTabBarOptions } from "@/components/tab-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

const ADMIN_NAV_ITEMS: NavItem[] = [
	{ label: "Overview", href: "/(admin)", icon: LayoutDashboard },
	{
		label: "Queue",
		href: "/(admin)/queue",
		icon: FileCheck2,
		section: "Review",
	},
	{
		label: "NGOs",
		href: "/(admin)/organizations",
		icon: Building2,
		section: "Directory",
	},
	{
		label: "Volunteers",
		href: "/(admin)/volunteers",
		icon: Users,
		section: "Directory",
	},
	{
		label: "Activity",
		href: "/(admin)/audit",
		icon: ScrollText,
		section: "Records",
	},
];

/**
 * Superadmin console. The client-side role check here is convenience only —
 * every /api/admin route is guarded by @Roles("superadmin") on the server.
 */
export default function AdminLayout() {
	const role = useAuthStore((s) => s.role);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const tabBarOptions = useTabBarOptions();

	if (role !== "superadmin") return <Redirect href="/" />;

	if (isDesktop) {
		return (
			<View
				style={{
					flex: 1,
					flexDirection: "row",
					backgroundColor: colors.background.warm,
				}}
			>
				<Sidebar navItems={ADMIN_NAV_ITEMS} />
				<View style={{ flex: 1 }}>
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
					name="queue"
					options={{
						title: "Queue",
						tabBarIcon: ({ color, size }) => (
							<FileCheck2 size={size} color={color} />
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
			</Tabs>
			<ThemeToggle />
		</View>
	);
}
