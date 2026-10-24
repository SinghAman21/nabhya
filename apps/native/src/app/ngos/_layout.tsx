import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { useStackOptions } from "@/lib/stack-options";

/** Public NGO directory and profiles - browsable without an account. */
function NgosLayout() {
	const screenOptions = useStackOptions();
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(NgosLayout);
