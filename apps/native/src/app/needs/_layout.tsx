import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { HEADERLESS } from "@/lib/navigation";

/**
 * Public need routes - reachable without an account, like `events/`. The API
 * behind them is @Public/@OptionalAuth, so no guard belongs here.
 */
function PublicNeedsLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(PublicNeedsLayout);
