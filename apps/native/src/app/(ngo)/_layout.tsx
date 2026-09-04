import { Redirect, Tabs } from "expo-router";
import {
	CalendarDays,
	HeartHandshake,
	House,
	MessageCircle,
	User,
} from "lucide-react-native";
import { View } from "react-native";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

export default function NgoLayout() {
	const role = useAuthStore((s) => s.role);
	const { colors } = useTheme();

	if (role !== "organisation") return <Redirect href="/" />;

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
					name="feed"
					options={{
						title: "Feed",
						tabBarIcon: ({ color, size }) => (
							<MessageCircle size={size} color={color} />
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
				{/* Reached from Profile, not the tab bar — href:null keeps them
				    routable without crowding four tabs into seven. */}
				<Tabs.Screen name="edit" options={{ href: null }} />
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
