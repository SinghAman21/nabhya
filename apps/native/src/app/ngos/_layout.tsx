import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { HEADERLESS } from "@/lib/navigation";

/** Public NGO directory and profiles — browsable without an account. */
function NgosLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}

export default withAppShell(NgosLayout);
