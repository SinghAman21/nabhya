import type { OrgPermissionAction } from "@nabhya/shared";
import { useMyTeamRole } from "@/hooks/use-my-team-role";
import { useMyOrganization } from "@/hooks/use-organization";
import { useOnboardingStatus } from "@/hooks/use-profile";
import { TEAM_ROLE_LABELS } from "@/lib/team-roles";

/**
 * What the signed-in team member may do for their NGO right now, and - when
 * they may not - the sentence that says why.
 *
 * Three things gate an NGO action on the server, and every `(ngo)` control has
 * to agree with all three or it becomes a button that 403s:
 *
 * 1. **Suspension.** A suspended org can do nothing.
 * 2. **Team role.** `ROLE_PERMISSIONS` in `@nabhya/shared`, checked by
 *    `requireOrgPermission`.
 * 3. **Verification**, for anything that reaches the public -
 *    `requireVerifiedOrganization`. Pass `{ public: true }` for those.
 *
 * Screens used to each check some subset (the dashboard checked role, the
 * needs screen checked nothing), so the same action was offered on one screen
 * and hidden on the next. `blocked()` returns `null` when the action is
 * allowed; otherwise disable the control and show the reason, rather than
 * hiding it - a coordinator who cannot see "New need" does not learn that
 * verification is what unlocks it.
 *
 * While the role is loading everything reads as allowed, so controls do not
 * flash disabled on every screen open. The server is the gate; this is UX.
 */
export function useOrgAccess() {
	const team = useMyTeamRole();
	const org = useMyOrganization();
	// Suspension comes from the status call: `/organizations/me` itself 403s
	// for a suspended org, so reading it there would never see the flag.
	const onboarding = useOnboardingStatus();

	const status = org.data?.verificationStatus;
	const isVerified = status === "VERIFIED";
	const isSuspended =
		onboarding.data?.organization?.status === "SUSPENDED" ||
		org.data?.status === "SUSPENDED";

	const can = (action: OrgPermissionAction) =>
		team.isLoading || team.role === null ? !team.isError : team.can(action);

	const blocked = (
		action: OrgPermissionAction,
		options: { public?: boolean } = {},
	): string | null => {
		if (isSuspended) return "Your organisation is suspended.";
		if (!can(action)) {
			return team.role
				? `${TEAM_ROLE_LABELS[team.role]}s can't do this - ask an admin.`
				: "Your team role doesn't allow this.";
		}
		if (options.public && org.data && !isVerified) {
			return "Available once your NGO is verified.";
		}
		return null;
	};

	return {
		role: team.role,
		isOwner: team.isOwner,
		isVerified,
		isSuspended,
		can,
		blocked,
		isLoading: team.isLoading || org.isLoading,
	};
}
