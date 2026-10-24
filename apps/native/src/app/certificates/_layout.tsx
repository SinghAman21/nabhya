import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { useStackOptions } from "@/lib/stack-options";

/**
 * `index` needs a signed-in volunteer; `[code]` is public verification, which
 * is why no guard lives here - the API decides per route.
 */
function CertificatesLayout() {
	const screenOptions = useStackOptions();
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[code]" />
		</Stack>
	);
}

export default withAppShell(CertificatesLayout);
