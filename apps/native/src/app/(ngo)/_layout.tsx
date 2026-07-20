import { Redirect, Tabs } from "expo-router";
import { CalendarDays, HeartHandshake, House, User } from "lucide-react-native";
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
					name="events"
					options={{
						title: "Events",
						tabBarIcon: ({ color, size }) => (
							<CalendarDays size={size} color={color} />
						),
					}}
				/>
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
