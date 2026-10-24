import { ShieldOff } from "lucide-react-native";
import { View } from "react-native";
import { EmptyState, Screen } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

/**
 * What the NGO app shows while the organisation is suspended or deleted.
 *
 * Either way the org can do nothing - every `org/*` route 403s and the
 * superadmin's action pulls its live events and needs off the feed - so
 * rendering the normal tabs just produced an error screen on each of them.
 * `(ngo)/_layout` renders this instead, once, for the whole group.
 *
 * It reads from `GET /onboarding/status` rather than `/organizations/me`,
 * because the latter is one of the routes that 403s. The reviewer's reason is
 * shown when there is one: "contact the team" without saying why sends the
 * NGO into that conversation blind.
 */
export function OrgSuspended({
	name,
	deleted = false,
	reason,
}: {
	name?: string | null;
	deleted?: boolean;
	reason?: string | null;
}) {
	const { spacing } = useTheme();
	const signOut = useSignOut();
	const org = name ?? "Your organisation";
	const why = reason ? ` Reason given: "${reason}".` : "";

	return (
		<Screen>
			<View style={{ flex: 1, justifyContent: "center", gap: spacing[4] }}>
				<EmptyState
					icon={ShieldOff}
					title={deleted ? `${org} was removed` : `${org} is suspended`}
					description={
						deleted
							? `A Nabhya reviewer removed this organisation from the platform, so it no longer appears anywhere and nothing can be published or changed.${why} Donation records and issued certificates are kept, and the Nabhya team can restore the organisation if this was a mistake.`
							: `A Nabhya reviewer has suspended this organisation, so its events and needs are off the public feed and nothing can be published or changed.${why} Contact the Nabhya team to resolve it. Your data is kept.`
					}
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
