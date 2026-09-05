import type { NeedType, NeedUrgency } from "@nabhya/shared";
import type {
	FeedApiItem,
	FeedApiItemType,
	FeedItem,
	FeedKind,
	FeedMedia,
	OrganizationSummary,
} from "@/lib/types";

/**
 * Maps the server's feed row to the client's.
 *
 * The ranking service returns one generic shape — `type`, `content`, viewer and
 * engagement blocks — for four different things. The card wants to narrow on
 * a `kind` and read typed facts, and the pledge sheet wants a `PublicNeed`.
 * Doing the translation once here keeps that knowledge out of every screen,
 * and means a change in the server payload is a change in one file.
 */

const URGENT_WINDOW_MS = 3 * 86_400_000;

/** Client kind → server item type, for the `kind` filter. */
export const KIND_TO_TYPE: Record<FeedKind, FeedApiItemType> = {
	need: "NEED",
	event: "EVENT",
	story: "ANNOUNCEMENT",
	post: "POST",
};

export function toFeedItem(row: FeedApiItem): FeedItem {
	const organization: OrganizationSummary | null = row.organization
		? {
				id: row.organization.id,
				organizationName: row.organization.name,
				logo: row.organization.logo,
				// Only verified, active NGOs reach the feed.
				city: null,
				state: null,
				verificationStatus: "VERIFIED",
			}
		: null;

	const base = {
		id: row.id,
		city: row.city,
		state: row.state,
		postedAt: row.createdAt,
		isFollowing: row.viewer?.followsOrganization ?? false,
		organization,
		author: row.author
			? { id: row.author.id, fullName: row.author.fullName }
			: null,
		engagement: row.engagement,
		viewer: row.viewer
			? { liked: row.viewer.liked, saved: row.viewer.saved }
			: null,
	};
	const c = row.content;

	switch (row.type) {
		case "NEED": {
			const urgency = (row.urgency ??
				str(c.urgency) ??
				"MEDIUM") as NeedUrgency;
			return {
				...base,
				kind: "need",
				title: str(c.title) ?? "",
				description: str(c.description) ?? "",
				isUrgent: urgency === "HIGH",
				need: {
					type: (str(c.type) ?? "WANT") as NeedType,
					quantity: num(c.quantity),
					unit: str(c.unit),
					fulfilledQuantity: num(c.fulfilledQuantity) ?? 0,
					urgency,
					// The pool only ever holds open needs.
					status: "OPEN",
					expiresAt: str(c.expiresAt),
				},
			};
		}
		case "EVENT": {
			const startAt = str(c.startAt) ?? row.createdAt;
			const start = Date.parse(startAt);
			const now = Date.now();
			return {
				...base,
				kind: "event",
				title: str(c.title) ?? "",
				description: str(c.description) ?? "",
				isUrgent:
					Number.isFinite(start) &&
					start >= now &&
					start - now <= URGENT_WINDOW_MS,
				event: {
					coverImage: str(c.coverImage),
					venue: str(c.venue),
					startAt,
					endAt: str(c.endAt) ?? startAt,
					applicationDeadline: str(c.applicationDeadline),
					volunteersNeeded: num(c.volunteersNeeded) ?? 0,
					acceptedCount: num(c.acceptedCount) ?? 0,
					status: "PUBLISHED",
				},
			};
		}
		case "ANNOUNCEMENT":
			return {
				...base,
				kind: "story",
				title: str(c.title) ?? "",
				description: str(c.body) ?? "",
				isUrgent: false,
				story: {
					coverImageKey: str(c.coverImageKey),
					isPinned: c.isPinned === true,
				},
			};
		default:
			return {
				...base,
				kind: "post",
				title: "",
				description: str(c.text) ?? "",
				isUrgent: false,
				post: {
					text: str(c.text) ?? "",
					media: Array.isArray(c.media) ? (c.media as FeedMedia[]) : [],
				},
			};
	}
}

function str(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (value instanceof Date) return value.toISOString();
	return null;
}

function num(value: unknown): number | null {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value)))
		return Number(value);
	return null;
}
