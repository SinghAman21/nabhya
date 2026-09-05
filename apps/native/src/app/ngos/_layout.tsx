import { Stack } from "expo-router";
import { HEADERLESS } from "@/lib/navigation";

/** Public NGO directory and profiles — browsable without an account. */
export default function NgosLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
		</Stack>
	);
}
