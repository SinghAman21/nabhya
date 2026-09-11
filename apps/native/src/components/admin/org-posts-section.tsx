import type { PostTag } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { LoadMoreButton } from "@/components/paged-list";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminDeletePost } from "@/hooks/use-admin";
import { useAdminOrganizationPostsPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { SelectMenu } from "./select-menu";

const TAGS: PostTag[] = ["POST", "EVENT", "NEED", "ANNOUNCEMENT"];

/**
 * An NGO's published feed posts, with superadmin moderation attached.
 *
 * Served by `GET /api/admin/organizations/:id/posts`; deletion reuses the
 * feed's own removal through `DELETE /api/admin/posts/:id`, so attached media
 * is deleted from storage and a `DELETE_POST` audit entry is written.
 *
 * **Deletion is moderation, not an overflow option.** It sits behind `confirm`
 * with its consequence spelled out, and the result is a toast — the drawer
 * stays open either way, so an inline error would be missed and a closing
 * sheet would blink with nothing said.
 *
 * Drawer-safe like the activity timeline: eager rows plus `LoadMoreButton`,
 * never a nested list.
 */
export function OrgPostsSection({
	organizationId,
}: {
	organizationId: string;
}) {
	const { spacing } = useTheme();
	const [tag, setTag] = useState<PostTag | "ALL">("ALL");
	const posts = useAdminOrganizationPostsPaged(organizationId, {
		...(tag === "ALL" ? {} : { tag }),
	});
	const deletePost = useAdminDeletePost();

	const confirmDelete = async (postId: string) => {
		const ok = await confirm({
			title: "Delete post?",
			message:
				"This removes the post from the feed and deletes its attached media. This cannot be undone.",
			confirmLabel: "Delete",
			destructive: true,
		});
		if (!ok) return;
		deletePost.mutate(postId, {
			onSuccess: () => toast.success("Post deleted."),
			onError: (error) => toast.error(apiErrorMessage(error)),
		});
	};

	return (
		<View style={{ gap: spacing[3] }}>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
				<SelectMenu<PostTag | "ALL">
					label="Tag"
					value={tag}
					onChange={setTag}
					options={[
						{ value: "ALL", label: "All posts" },
						...TAGS.map((entry) => ({
							value: entry as PostTag | "ALL",
							label: humanizeStatus(entry),
						})),
					]}
				/>
				{posts.total > 0 && (
					<Caption color="quaternary" style={{ alignSelf: "center" }}>
						{posts.total} {posts.total === 1 ? "post" : "posts"}
					</Caption>
				)}
			</View>

			{posts.query.isLoading ? (
				<Surface>
					<LoadingState />
				</Surface>
			) : posts.query.isError && posts.items.length === 0 ? (
				<Surface>
					<ErrorState
						message={apiErrorMessage(posts.query.error)}
						onRetry={() => posts.query.refetch()}
					/>
				</Surface>
			) : posts.items.length === 0 ? (
				<Surface>
					<Caption color="tertiary">
						No posts published yet. Posts the NGO publishes from the feed
						composer appear here for review.
					</Caption>
				</Surface>
			) : (
				<View style={{ gap: spacing[2] }}>
					{posts.items.map((post) => {
						const deleting =
							deletePost.isPending && deletePost.variables === post.id;
						return (
							<Surface key={post.id}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[2],
									}}
								>
									<StatusPill label={humanizeStatus(post.tag)} tone="neutral" />
									<Caption
										color="quaternary"
										style={{ flex: 1 }}
										numberOfLines={1}
									>
										{formatRelative(post.createdAt)} ·{" "}
										{formatDate(post.createdAt)}
									</Caption>
								</View>
								<Body
									color="secondary"
									numberOfLines={4}
									style={{ marginTop: spacing[2] }}
								>
									{post.text}
								</Body>
								<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
									By {post.author.fullName ?? "Unknown"}
									{post.media.length > 0
										? ` · ${post.media.length} attachment${post.media.length === 1 ? "" : "s"}`
										: ""}
								</Caption>
								<View style={{ marginTop: spacing[3] }}>
									<Button
										variant="destructive"
										size="sm"
										loading={deleting}
										disabled={deletePost.isPending}
										onPress={() => void confirmDelete(post.id)}
										accessibilityLabel={`Delete post published ${formatDate(post.createdAt)}`}
									>
										Delete post
									</Button>
								</View>
							</Surface>
						);
					})}
					<LoadMoreButton
						query={posts.query as never}
						loadMore={posts.loadMore}
					/>
				</View>
			)}
		</View>
	);
}
