import { Redirect, Stack } from "expo-router";
import { HEADERLESS } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";

export default function OnboardingLayout() {
	const email = useAuthStore((s) => s.email);

	// The role groups all guard on the store; onboarding did not. When the axios
	// interceptor signed a user out mid-wizard, these screens stayed mounted with
	// no credentials — every submit then left without an Authorization header and
	// came back 401, with no route back to the login screen. On web it also
	// stopped a signed-out visitor opening /volunteer directly.
	if (!email) return <Redirect href="/" />;

	return (
		<Stack screenOptions={HEADERLESS}>
			<Stack.Screen name="index" />
			<Stack.Screen name="volunteer" />
		</Stack>
	);
}
