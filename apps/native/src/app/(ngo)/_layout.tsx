import { Redirect, Slot, Tabs } from "expo-router";
import {
	CalendarDays,
	FileText,
	HandCoins,
	HeartHandshake,
	House,
	Megaphone,
	Newspaper,
	Star,
	User,
	Users,
} from "lucide-react-native";
import { View } from "react-native";
import { type NavItem, Sidebar } from "@/components/sidebar";
import { renderTabBar, useTabBarOptions } from "@/components/tab-bar";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { useAuthStore } from "@/store/auth-store";

const NGO_NAV_ITEMS: NavItem[] = [
	// Feed is the landing page, so it leads — unsectioned, like Dashboard.
	{ label: "Feed", href: "/(ngo)/feed", icon: Newspaper },
	{ label: "Dashboard", href: "/(ngo)", icon: House },
	{
		label: "Needs",
		href: "/(ngo)/needs",
		icon: HeartHandshake,
		section: "Programmes",
	},
	{
		label: "Events",
		href: "/(ngo)/events",
		icon: CalendarDays,
		section: "Programmes",
	},
	{
		label: "Updates",
		href: "/(ngo)/announcements",
		icon: Megaphone,
		section: "Audience",
	},
	{ label: "Reviews", href: "/(ngo)/reviews", icon: Star, section: "Audience" },
	{
		label: "Donations",
		href: "/(ngo)/donations",
		icon: HandCoins,
		section: "Money",
	},
	{
		label: "Reports",
		href: "/(ngo)/reports",
		icon: FileText,
		section: "Money",
	},
	{ label: "Team", href: "/(ngo)/team", icon: Users, section: "Organisation" },
	{
		label: "Profile",
		href: "/(ngo)/profile",
		icon: User,
		section: "Organisation",
	},
];

export default function NgoLayout() {
	const role = useAuthStore((s) => s.role);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
	const tabBarOptions = useTabBarOptions();
	const { data: org } = useMyOrganization(isDesktop);

	if (role !== "organisation") return <Redirect href="/" />;

	if (isDesktop) {
		return (
			<View
				style={{
					flex: 1,
					flexDirection: "row",
					backgroundColor: colors.background.warm,
				}}
			>
				<Sidebar navItems={NGO_NAV_ITEMS} brandTitle={org?.organizationName} />
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
					name="feed"
					options={{
						title: "Feed",
						tabBarIcon: ({ color, size }) => (
							<Newspaper size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="index"
					options={{
						title: "Dashboard",
						tabBarIcon: ({ color, size }) => (
							<House size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="needs"
					options={{
						title: "Needs",
						tabBarIcon: ({ color, size }) => (
							<HeartHandshake size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="events"
					options={{
						title: "Events",
						tabBarIcon: ({ color, size }) => (
							<CalendarDays size={size} color={color} />
						),
					}}
				/>
				<Tabs.Screen name="edit" options={{ href: null }} />
				<Tabs.Screen name="verification" options={{ href: null }} />
				<Tabs.Screen name="announcements" options={{ href: null }} />
				<Tabs.Screen name="reviews" options={{ href: null }} />
				<Tabs.Screen name="team" options={{ href: null }} />
				<Tabs.Screen name="reports" options={{ href: null }} />
				<Tabs.Screen name="donations" options={{ href: null }} />
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
					}}
				/>
			</Tabs>
		</View>
	);
}
