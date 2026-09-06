import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import {
	useCreateFeedComment,
	useDeleteFeedComment,
	useFeedComments,
} from "@/hooks/use-feed";
import { useTheme } from "@/hooks/use-theme";
import type { FeedComment, FeedItem } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

export function FeedCommentsSheet({
	item,
	onClose,
}: {
	item: FeedItem;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const email = useAuthStore((state) => state.email);
	const userId = useAuthStore((state) => state.user?.id);
	const [body, setBody] = useState("");
	const comments = useFeedComments(item, { page: 1, limit: 50 });
	const createComment = useCreateFeedComment();
	const deleteComment = useDeleteFeedComment();

	const submit = () => {
		const trimmed = body.trim();
		if (!trimmed) return;
		createComment.mutate(
			{ item, body: trimmed },
			{ onSuccess: () => setBody("") },
		);
	};

	return (
		<Sheet
			visible
			onClose={onClose}
			title="Comments"
			subtitle={
				item.title || item.organization?.organizationName || "Feed item"
			}
			scrollable={false}
			detents={["58%", "88%"]}
			footer={
				<View style={{ gap: spacing[2] }}>
					{email ? (
						<>
							<Input
								value={body}
								onChangeText={setBody}
								placeholder="Add a thoughtful comment"
								multiline
								returnKeyType="send"
								onSubmitEditing={submit}
							/>
							<Button
								onPress={submit}
								loading={createComment.isPending}
								disabled={!body.trim()}
							>
								Comment
							</Button>
						</>
					) : (
						<Caption color="tertiary" style={{ textAlign: "center" }}>
							Sign in to join the conversation.
						</Caption>
					)}
				</View>
			}
		>
			{comments.isLoading ? (
				<Caption color="tertiary" style={{ padding: spacing[5] }}>
					Loading comments...
				</Caption>
			) : comments.data?.items.length ? (
				<SheetFlatList
					data={comments.data.items}
					keyExtractor={(comment) => comment.id}
					renderItem={({ item: comment }) => (
						<CommentRow
							comment={comment}
							canDelete={comment.user.id === userId}
							onDelete={() => deleteComment.mutate(comment.id)}
						/>
					)}
				/>
			) : (
				<View style={{ padding: spacing[5], gap: spacing[1] }}>
					<Body weight="semibold">Be the first to comment</Body>
					<Caption color="tertiary">
						Thoughtful responses help volunteers find the right opportunity.
					</Caption>
				</View>
			)}
		</Sheet>
	);
}

function CommentRow({
	comment,
	canDelete,
	onDelete,
}: {
	comment: FeedComment;
	canDelete: boolean;
	onDelete: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				paddingVertical: spacing[3],
				borderBottomWidth: 1,
				borderBottomColor: colors.border.hairline,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					gap: spacing[3],
				}}
			>
				<View style={{ flex: 1, gap: spacing[1] }}>
					<Label weight="semibold">
						{comment.user.fullName || "Nabhya volunteer"}
					</Label>
					<Body color="secondary">{comment.body}</Body>
				</View>
				{canDelete && (
					<Button variant="ghost" size="sm" onPress={onDelete}>
						Delete
					</Button>
				)}
			</View>
		</View>
	);
}
