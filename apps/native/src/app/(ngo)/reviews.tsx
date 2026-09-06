import { useInfiniteQuery } from "@tanstack/react-query";
import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	GridCell,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Body, BodySmall, Caption, H2 } from "@/components/ui/typography";
import { useReplyToReview } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, engagementApi, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";

type ReplyFilter = "ALL" | "UNANSWERED";

const FILTERS: Array<{ value: ReplyFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "UNANSWERED", label: "Awaiting reply" },
];

const PAGE_SIZE = 20;

/**
 * Reviews of this org, page by page. The summary rides along on every page;
 * the first page's copy is the one drawn. The reply filter is local — the API
 * has no such parameter.
 */
function useOrgReviewPages() {
	return useInfiniteQuery({
		queryKey: queryKeys.orgReviews({ paged: true }),
		queryFn: ({ pageParam }) =>
			engagementApi.listMyOrgReviews({ page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

export default function OrgReviews() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<ReplyFilter>("ALL");
	const [replying, setReplying] = useState<ReviewItem | null>(null);
	const query = useOrgReviewPages();
	const columns = useGridColumns();

	const summary = query.data?.pages[0]?.summary;
	const all = query.data?.pages.flatMap((page) => page.items) ?? [];
	const items = filter === "ALL" ? all : all.filter((review) => !review.reply);
	const unanswered = all.filter((review) => !review.reply).length;

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

	const summaryCard =
		summary && summary.count > 0 ? (
			<Surface style={{ marginBottom: spacing[5] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[5],
					}}
				>
					<View style={{ alignItems: "flex-start" }}>
						<H2>{summary.average.toFixed(1)}</H2>
						<Caption color="tertiary">
							{summary.count} review{summary.count === 1 ? "" : "s"}
						</Caption>
					</View>
					<View style={{ flex: 1, gap: spacing[1.5] }}>
						{[5, 4, 3, 2, 1].map((star) => {
							const value = summary.distribution[String(star)] ?? 0;
							const share = summary.count ? value / summary.count : 0;
							return (
								<View
									key={star}
									accessible
									accessibilityLabel={`${star} star: ${value}`}
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
											height: 4,
											borderRadius: 2,
											backgroundColor: colors.background.tertiary,
											overflow: "hidden",
										}}
									>
										<View
											style={{
												width: `${share * 100}%`,
												height: "100%",
												backgroundColor: colors.text.primary,
											}}
										/>
									</View>
									<Caption
										color="quaternary"
										style={{ width: 22, textAlign: "right" }}
									>
										{value}
									</Caption>
								</View>
							);
						})}
					</View>
				</View>
			</Surface>
		) : null;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Reviews"
				subtitle={
					unanswered > 0
						? `${unanswered} awaiting your reply`
						: "What volunteers say about working with you"
				}
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					key={`grid-${columns}`}
					numColumns={columns}
					columnWrapperStyle={columns > 1 ? { gap: spacing[3] } : undefined}
					data={items}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					onEndReached={loadMore}
					onEndReachedThreshold={0.5}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching && !query.isFetchingNextPage}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListHeaderComponent={
						<>
							{summaryCard}
							{all.length > 0 && (
								<FilterChips
									options={FILTERS}
									value={filter}
									onChange={setFilter}
								/>
							)}
						</>
					}
					ListEmptyComponent={
						<EmptyState
							icon={Star}
							title={
								filter === "UNANSWERED"
									? "Every review answered"
									: "No reviews yet"
							}
							description={
								filter === "UNANSWERED"
									? "New reviews will show here until you reply."
									: "Volunteers can review you after an event or a pledge. Each one appears here, and your reply is shown publicly beneath it."
							}
						/>
					}
					ListFooterComponent={
						<LoadMoreFooter
							hasMore={!!query.hasNextPage}
							loading={query.isFetchingNextPage}
							onLoadMore={loadMore}
							count={items.length}
							noun="reviews"
						/>
					}
					renderItem={({ item }) => (
						<GridCell>
							<ReviewRow review={item} onReply={() => setReplying(item)} />
						</GridCell>
					)}
				/>
			)}

			<ReplySheet review={replying} onClose={() => setReplying(null)} />
		</Screen>
	);
}

function ReviewRow({
	review,
	onReply,
}: {
	review: ReviewItem;
	onReply: () => void;
}) {
	const { colors, spacing } = useTheme();
	const name = review.user.fullName ?? "Volunteer";

	return (
		<Surface onPress={review.reply ? undefined : onReply}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={review.user.fullName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{name}
					</Body>
					<Caption color="quaternary">
						{formatRelative(review.createdAt)}
					</Caption>
				</View>
				<Stars rating={review.rating} />
			</View>

			{review.body && (
				<BodySmall color="secondary" style={{ marginTop: spacing[3] }}>
					{review.body}
				</BodySmall>
			)}

			{review.reply ? (
				<View
					style={{
						marginTop: spacing[3],
						paddingTop: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: spacing[1],
						}}
					>
						<Caption weight="medium" color="tertiary">
							Your reply
							{review.repliedAt ? ` · ${formatRelative(review.repliedAt)}` : ""}
						</Caption>
						<TextAction
							label="Edit"
							onPress={onReply}
							accessibilityLabel={`Edit your reply to ${name}`}
						/>
					</View>
					<Caption color="secondary">{review.reply}</Caption>
				</View>
			) : (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						marginTop: spacing[3],
						paddingTop: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					<StatusPill label="Awaiting reply" tone="warning" />
					<TextAction
						label="Reply publicly"
						tone="brand"
						onPress={onReply}
						accessibilityLabel={`Reply to ${name}`}
					/>
				</View>
			)}
		</Surface>
	);
}

/** Five stars in ink — the amber `main` fails contrast as a glyph. */
function Stars({ rating }: { rating: number }) {
	const { colors, spacing } = useTheme();
	return (
		<View
			accessible
			accessibilityLabel={`${rating} out of 5 stars`}
			style={{ flexDirection: "row", gap: spacing[0.5] }}
		>
			{[1, 2, 3, 4, 5].map((star) => (
				<Star
					key={star}
					size={14}
					strokeWidth={1.75}
					color={
						star <= rating
							? (colors.warning.ink as string)
							: (colors.border.dark as string)
					}
					fill={star <= rating ? (colors.warning.ink as string) : "transparent"}
				/>
			))}
		</View>
	);
}

/**
 * Replying happens in a sheet rather than an inline field: the keyboard would
 * otherwise cover the review being answered, and a sheet gives the reply a
 * clear primary action.
 */
function ReplySheet({
	review,
	onClose,
}: {
	review: ReviewItem | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const textAreaStyle = useFieldInputStyle(120);
	const [reply, setReply] = useState("");
	const [error, setError] = useState<string | null>(null);
	const respond = useReplyToReview();

	useEffect(() => {
		setReply(review?.reply ?? "");
		setError(null);
	}, [review]);

	const submit = () => {
		if (!review) return;
		const text = reply.trim();
		if (!text) {
			setError("Write a reply first.");
			return;
		}
		setError(null);
		respond.mutate(
			{ reviewId: review.id, input: { reply: text } },
			{
				onSuccess: onClose,
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Sheet
			visible={!!review}
			onClose={onClose}
			title={review?.reply ? "Edit your reply" : "Reply publicly"}
			subtitle={
				review ? `To ${review.user.fullName ?? "a volunteer"}` : undefined
			}
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={error} />
					<Button onPress={submit} loading={respond.isPending}>
						{review?.reply ? "Save reply" : "Post reply"}
					</Button>
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				{review?.body && (
					<View
						style={{
							paddingLeft: spacing[3],
							borderLeftWidth: 2,
							borderLeftColor: "transparent",
							marginBottom: spacing[4],
						}}
					>
						<Caption color="tertiary" numberOfLines={4}>
							“{review.body}”
						</Caption>
					</View>
				)}
				<Field
					label="Your reply"
					hint="Shown publicly under the review, with your NGO's name."
				>
					<Input
						placeholder="Thank them, or explain what you've changed"
						value={reply}
						onChangeText={setReply}
						multiline
						autoFocus
						style={textAreaStyle}
					/>
				</Field>
			</View>
		</Sheet>
	);
}
