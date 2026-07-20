import { Stack } from "expo-router";

/** Public NGO directory and profiles — browsable without an account. */
export default function NgosLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}
