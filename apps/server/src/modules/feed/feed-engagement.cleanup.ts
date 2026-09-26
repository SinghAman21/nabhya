import type { db as dbType } from "@nabhya/db";
import { postComments, postInteractions } from "@nabhya/db/schema";
import type { PostTag } from "@nabhya/shared";
import { and, eq } from "drizzle-orm";

/**
 * Clears the likes, saves, shares, impressions and comments pointing at one
 * feed row.
 *
 * `post_interactions.post_id` and `post_comments.post_id` are polymorphic -
 * the row they name lives in `posts`, `events`, `needs` or `announcements`
 * depending on `target_type` - so no foreign key can cascade for them. Every
 * path that deletes one of those four rows has to call this, or the orphaned
 * engagement outlives the thing it counted.
 *
 * Not yet wired into any delete path (`feed.service.ts#remove`,
 * `events.service.ts`, `needs.service.ts`, `publishing.service.ts` each
 * delete their own row without calling this) - the gap it fixes is real but
 * unaddressed; wire it in before relying on it.
 *
 * A plain function rather than a service method: the events, needs and
 * publishing modules would otherwise each need a cross-module provider just to
 * run two deletes.
 */
export async function deleteFeedEngagement(
	db: typeof dbType,
	targetType: PostTag,
	postId: string,
) {
	await Promise.all([
		db
			.delete(postInteractions)
			.where(
				and(
					eq(postInteractions.targetType, targetType),
					eq(postInteractions.postId, postId),
				),
			),
		db
			.delete(postComments)
			.where(
				and(
					eq(postComments.targetType, targetType),
					eq(postComments.postId, postId),
				),
			),
	]);
}
