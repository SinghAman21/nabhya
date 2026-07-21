import { Stack } from "expo-router";

/**
 * Public need/offer routes — reachable without an account. The API backing
 * these screens is @Public/@OptionalAuth, so no guard belongs here.
 */
export default function PublicNeedsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="[id]" />
		</Stack>
	);
}
