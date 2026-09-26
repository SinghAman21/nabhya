import type { OrgPermissionAction, TeamRole } from "@nabhya/shared";
import { canTeamRole } from "@nabhya/shared";
import { useOrgTeam } from "@/hooks/use-directory";
import { useMe } from "@/hooks/use-profile";

/**
 * The current user's team role in their organisation, and what it allows.
 *
 * Matches `useMe`'s user id against `useOrgTeam`'s membership rows
 * (`userId`, falling back to the nested `user.id`). The server stays the real
 * gate - `requireOrgPermission` in `organizations.service.ts` 403s on every
 * guarded route - so an unknown role (still loading, query error, or no
 * membership row) denies: `can()` returns false and the UI hides or disables
 * the control instead of letting the tap fail.
 */
export function useMyTeamRole() {
	const me = useMe();
	const team = useOrgTeam();

	const myId = me.data?.id;
	const member = myId
		? (team.data ?? []).find((row) => (row.userId ?? row.user.id) === myId)
		: undefined;

	// No row in a team that loaded fine means an owner from before team
	// memberships existed: the server resolves that account through
	// `organizations.owner_user_id` and grants it everything
	// (`requireOrgPermission`'s fallback). Reading it as "no role" locked the
	// one person who can do everything out of every control.
	const legacyOwner = !!myId && team.isSuccess && !member;
	const role: TeamRole | null = member
		? ((member.role ?? (member.isOwner ? "OWNER" : null)) as TeamRole | null)
		: legacyOwner
			? "OWNER"
			: null;

	return {
		/** Null while loading or on error. */
		role,
		isOwner: role === "OWNER",
		can: (action: OrgPermissionAction) =>
			role ? canTeamRole(role, action) : false,
		isLoading: me.isLoading || team.isLoading,
		isError: me.isError || team.isError,
	};
}
