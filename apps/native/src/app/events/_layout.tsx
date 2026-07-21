import { Stack } from "expo-router";

/**
 * Public event routes — reachable without an account. The API backing these
 * screens is @Public/@OptionalAuth, so no guard belongs here.
 */
export default function PublicEventsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}
