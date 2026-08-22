import { Star } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { BackButton } from "@/components/back-button";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Input } from "@/components/ui/input";
import { Body, Caption, H3 } from "@/components/ui/typography";
import { useMyOrgReviews, useReplyToReview } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";

export default function OrgReviews() {
	const { colors, spacing } = useTheme();
	const query = useMyOrgReviews();

	const summary = query.data?.summary;

	return (
		<Screen>
			<BackButton />

			<ScreenHeader
				title="Reviews"
				subtitle="What volunteers say about working with you."
			/>

			{summary && summary.count > 0 && (
				<Surface style={{ marginBottom: spacing[4] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[4],
						}}
					>
						<View>
							<H3>{summary.average.toFixed(1)}</H3>
							<Caption color="tertiary">
								{summary.count} review{summary.count === 1 ? "" : "s"}
							</Caption>
						</View>
						<View style={{ flex: 1, gap: spacing[1] }}>
							{[5, 4, 3, 2, 1].map((star) => {
								const value = summary.distribution[String(star)] ?? 0;
								const share = summary.count ? value / summary.count : 0;
								return (
									<View
										key={star}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: spacing[2],
										}}
									>
										<Caption color="quaternary" style={{ width: 10 }}>
											{star}
										</Caption>
										<View
											style={{
												flex: 1,
												height: 5,
												borderRadius: 3,
												backgroundColor: colors.background.tertiary,
												overflow: "hidden",
											}}
										>
											<View
												style={{
													width: `${share * 100}%`,
													height: "100%",
													backgroundColor: colors.warning.main,
												}}
											/>
										</View>
										<Caption color="quaternary" style={{ width: 18 }}>
											{value}
										</Caption>
									</View>
								);
							})}
						</View>
					</View>
				</Surface>
			)}

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.data?.items ?? []}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Star}
							title="No reviews yet"
							description="Volunteers can review you after they've worked with your organization."
						/>
					}
					renderItem={({ item }) => <ReviewRow review={item} />}
				/>
			)}
		</Screen>
	);
}

function ReviewRow({ review }: { review: ReviewItem }) {
	const { colors, spacing } = useTheme();
	const [replying, setReplying] = useState(false);
	const [reply, setReply] = useState("");

	const respond = useReplyToReview();

	const submit = () => {
		if (!reply.trim()) return;
		respond.mutate(
			{ reviewId: review.id, input: { reply: reply.trim() } },
			{
				onSuccess: () => {
					setReplying(false);
					setReply("");
				},
				onError: (error) =>
					Alert.alert("Could not reply", apiErrorMessage(error)),
			},
		);
	};

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[2],
				}}
			>
				<Body weight="bold" numberOfLines={1} style={{ flex: 1 }}>
					{review.user.fullName ?? "Volunteer"}
				</Body>
				<Caption color={colors.warning.main as string}>
					{"★".repeat(review.rating)}
					{"☆".repeat(5 - review.rating)}
				</Caption>
			</View>

			{review.body && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					{review.body}
				</Caption>
			)}
			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{formatRelative(review.createdAt)}
			</Caption>

			{review.reply ? (
				<View
					style={{
						marginTop: spacing[3],
						paddingLeft: spacing[3],
						borderLeftWidth: 2,
						borderLeftColor: colors.primary.main,
					}}
				>
					<Caption weight="medium" color="tertiary">
						Your response
					</Caption>
					<Caption color="secondary">{review.reply}</Caption>
				</View>
			) : replying ? (
				<View style={{ marginTop: spacing[3] }}>
					<Input
						placeholder="Thank them, or explain what you've changed"
						value={reply}
						onChangeText={setReply}
						multiline
						autoFocus
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
							minHeight: 80,
							textAlignVertical: "top",
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							gap: spacing[4],
							marginTop: spacing[2],
						}}
					>
						<Pressable
							onPress={submit}
							disabled={respond.isPending || !reply.trim()}
							hitSlop={8}
						>
							<Caption
								weight="medium"
								color={
									reply.trim()
										? (colors.primary.main as string)
										: (colors.text.disabled as string)
								}
							>
								{respond.isPending ? "Posting…" : "Post reply"}
							</Caption>
						</Pressable>
						<Pressable onPress={() => setReplying(false)} hitSlop={8}>
							<Caption weight="medium" color="secondary">
								Cancel
							</Caption>
						</Pressable>
					</View>
				</View>
			) : (
				<Pressable
					onPress={() => setReplying(true)}
					hitSlop={8}
					style={{ marginTop: spacing[3] }}
				>
					<Caption weight="medium" color={colors.primary.main as string}>
						Reply publicly
					</Caption>
				</Pressable>
			)}
		</Surface>
	);
}
