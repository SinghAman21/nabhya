import { Stack } from "expo-router";
import { withAppShell } from "@/components/app-shell";
import { HEADERLESS } from "@/lib/navigation";

/**
 * `index` needs a signed-in volunteer; `[code]` is public verification, which
 * is why no guard lives here - the API decides per route.
 */
function CertificatesLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[code]" />
		</Stack>
	);
}

export default withAppShell(CertificatesLayout);
