import type { NotificationItem } from "@/lib/types";
import type { UserRole as Role } from "@/lib/types/auth";

/**
 * Where tapping a notification takes you.
 *
 * The same `entityName` means different things to different roles - an EVENT
 * row is "an event you can go to" for a volunteer and "an event with someone
 * waiting for a decision" for an NGO - so the role picks the screen. Shared by
 * the notifications page and the desktop bell's popover so they cannot
 * disagree. Used to cover three kinds; every NGO-side notification (new
 * applicant, new pledge, review, donation, verification, team) was a dead row.
 *
 * `null` means there is nothing more to show than the notification itself -
 * an admin broadcast, or being removed from a team you can no longer open.
 */
export function notificationDestination(
	item: NotificationItem,
	role: Role | null,
): string | null {
	const id = item.entityId;
	const ngo = role === "organisation";

	switch (item.entityName) {
		case "EVENT":
			// An NGO is sent to the applicant queue for that event.
			if (ngo) return id ? `/(ngo)/my-events?review=${id}` : "/(ngo)/my-events";
			return id ? `/events/${id}` : null;
		case "ORGANIZATION_NEED":
			if (ngo) return id ? `/(ngo)/needs?review=${id}` : "/(ngo)/needs";
			return id ? `/needs/${id}` : null;
		case "CERTIFICATE":
			return "/certificates";
		case "REVIEW":
			// Only the NGO has a list of reviews to open.
			return ngo ? "/(ngo)/reviews" : null;
		case "DONATION":
			return ngo ? "/(ngo)/donations" : "/(volunteer)/giving";
		case "ORGANIZATION_DOCUMENT":
			return "/(ngo)/verification";
		case "USER_DOCUMENT":
			return "/verify-identity";
		case "ORGANIZATION":
			if (item.type === "TEAM_REMOVED") return null;
			if (item.type === "ORG_VERIFIED" || item.type === "ORG_REJECTED") {
				return "/(ngo)/verification";
			}
			return ngo ? "/(ngo)/team" : null;
		case "ORGANIZATION_ADMIN":
			return "/(ngo)/team";
		case "TEAM_INVITE":
			// The notification carries the invite id; the email carries a token.
			return id ? `/team/invites/${id}?by=id` : null;
		default:
			return null;
	}
}
