import { Stack } from "expo-router";
import { HEADERLESS } from "@/lib/navigation";

export default function AuthLayout() {
	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="login" />
			<Stack.Screen name="signup" />
		</Stack>
	);
}
