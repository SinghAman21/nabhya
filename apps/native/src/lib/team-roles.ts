import type { TeamRole } from "@nabhya/shared";

/**
 * What each team role is called and what it can do, in the words a
 * coordinator uses. The enum values (`OWNER`, `ADMIN`...) are storage, not
 * copy - they used to be printed as-is on the team screen.
 *
 * The descriptions paraphrase `ROLE_PERMISSIONS` in `@nabhya/shared`, which is
 * what the server enforces; change them together.
 */
export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MANAGER: "Manager",
	MEMBER: "Member",
	VIEWER: "Viewer",
};

export const TEAM_ROLE_COPY: Record<TeamRole, string> = {
	OWNER: "Everything, including transferring ownership.",
	ADMIN: "Everything except transferring ownership.",
	MANAGER: "Posts, needs, events, applicants, attendance and certificates.",
	MEMBER: "Marks attendance at events.",
	VIEWER: "Read-only, plus donations.",
};
