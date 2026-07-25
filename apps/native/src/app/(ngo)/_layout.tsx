import { Redirect, Slot, Tabs } from "expo-router";
import {
	CalendarDays,
	FileText,
	HandCoins,
	HeartHandshake,
	House,
	Megaphone,
	Star,
	User,
	Users,
} from "lucide-react-native";
import { View } from "react-native";
import { type NavItem, Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMyOrganization } from "@/hooks/use-organization";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

const NGO_NAV_ITEMS: NavItem[] = [
	{ label: "Dashboard", href: "/(ngo)", icon: House },
	{ label: "Needs", href: "/(ngo)/needs", icon: HeartHandshake },
	{ label: "Events", href: "/(ngo)/events", icon: CalendarDays },
	{ label: "Updates", href: "/(ngo)/announcements", icon: Megaphone },
	{ label: "Reviews", href: "/(ngo)/reviews", icon: Star },
	{ label: "Team", href: "/(ngo)/team", icon: Users },
	{ label: "Donations", href: "/(ngo)/donations", icon: HandCoins },
	{ label: "Reports", href: "/(ngo)/reports", icon: FileText },
	{ label: "Profile", href: "/(ngo)/profile", icon: User },
];

export default function NgoLayout() {
	const role = useAuthStore((s) => s.role);
	const { colors } = useTheme();
	const { isDesktop } = useMedia();
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
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarActiveTintColor: colors.primary.main as string,
					tabBarInactiveTintColor: colors.text.tertiary as string,
					tabBarStyle: {
						backgroundColor: colors.background.primary as string,
						borderTopColor: colors.border.light as string,
					},
				}}
			>
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
			<ThemeToggle />
		</View>
	);
}
