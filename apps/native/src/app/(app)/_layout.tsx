import { Stack } from "expo-router";
import { View } from "react-native";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout() {
	return (
		<View style={{ flex: 1 }}>
			<Stack>
				<Stack.Screen name="index" options={{ title: "Home" }} />
				<Stack.Screen name="profile" options={{ title: "Profile" }} />
				<Stack.Screen name="success" options={{ title: "Success" }} />
			</Stack>
			<ThemeToggle />
		</View>
	);
}
