import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { useStackOptions } from "@/lib/stack-options";

/**
 * Public need routes - reachable without an account, like `events/`. The API
 * behind them is @Public/@OptionalAuth, so no guard belongs here.
 */
function PublicNeedsLayout() {
	const screenOptions = useStackOptions();
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(PublicNeedsLayout);
