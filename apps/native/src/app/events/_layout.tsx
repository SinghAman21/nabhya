import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { HEADERLESS } from "@/lib/navigation";

/**
 * Public event routes — reachable without an account. The API backing these
 * screens is @Public/@OptionalAuth, so no guard belongs here.
 */
function PublicEventsLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(PublicEventsLayout);
