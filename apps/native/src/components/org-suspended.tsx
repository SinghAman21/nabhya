import { ShieldOff } from "lucide-react-native";
import { View } from "react-native";
import { EmptyState, Screen } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

/**
 * What the NGO app shows while the organisation is suspended.
 *
 * A suspended org can do nothing - every `org/*` route 403s and a superadmin's
 * suspension pulls its live events and needs off the feed - so rendering the
 * normal tabs just produced an error screen on each of them. `(ngo)/_layout`
 * renders this instead, once, for the whole group.
 *
 * It reads from `GET /onboarding/status` rather than `/organizations/me`,
 * because the latter is one of the routes that 403s.
 */
export function OrgSuspended({ name }: { name?: string | null }) {
	const { spacing } = useTheme();
	const signOut = useSignOut();

	return (
		<Screen>
			<View style={{ flex: 1, justifyContent: "center", gap: spacing[4] }}>
				<EmptyState
					icon={ShieldOff}
					title={`${name ?? "Your organisation"} is suspended`}
					description="A Nabhya reviewer has suspended this organisation, so its events and needs are off the public feed and nothing can be published or changed. Contact the Nabhya team to resolve it. Your data is kept."
					action={
						<Button
							variant="outline"
							loading={signOut.isPending}
							onPress={() => signOut.mutate()}
						>
							Sign out
						</Button>
					}
				/>
			</View>
		</Screen>
	);
}
