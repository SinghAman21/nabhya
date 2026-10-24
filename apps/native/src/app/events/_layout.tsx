import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { useStackOptions } from "@/lib/stack-options";

/**
 * Public event routes - reachable without an account. The API backing these
 * screens is @Public/@OptionalAuth, so no guard belongs here.
 */
function PublicEventsLayout() {
	const screenOptions = useStackOptions();
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(PublicEventsLayout);
