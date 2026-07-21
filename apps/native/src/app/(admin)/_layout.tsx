import { Redirect, Tabs } from "expo-router";
import {
	Building2,
	FileCheck,
	LayoutDashboard,
	ScrollText,
	Users,
} from "lucide-react-native";
import { View } from "react-native";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/store/auth-store";

/**
 * Superadmin console. The client-side role check here is convenience only —
 * every /api/admin route is guarded by @Roles("superadmin") on the server.
 */
export default function AdminLayout() {
	const role = useAuthStore((s) => s.role);
	const { colors } = useTheme();

	if (role !== "superadmin") return <Redirect href="/" />;

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
					name="documents"
					options={{
						title: "Documents",
						tabBarIcon: ({ color, size }) => (
							<FileCheck size={size} color={color} />
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
