import { Stack } from "expo-router";

/**
 * Public NGO directory — reachable without an account. Backed by @Public
 * endpoints that only ever list verified, active organizations.
 */
export default function PublicOrganizationsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}
