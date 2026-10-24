import { useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu, type SelectOption } from "@/components/admin/select-menu";
import { Toolbar } from "@/components/admin/toolbar";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { FormFooterRow, useFormButtonGrow } from "@/components/ngo/form-footer";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import {
	Banner,
	EmptyState,
	FilterChips,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Body, BodySmall, Caption, H2 } from "@/components/ui/typography";
import { useReplyToReview } from "@/hooks/use-engagement";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, engagementApi, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";

type ReplyFilter = "ALL" | "UNANSWERED";

const FILTERS: Array<SelectOption<ReplyFilter>> = [
	{ value: "ALL", label: "All" },
	{
		value: "UNANSWERED",
		label: "Awaiting reply",
		hint: "Reviews with no public answer yet",
	},
];

/**
 * Reviews of the organisation, and its public replies.
 *
 * - **Phone: cards.** A review is read one at a time there, and the reply
 *   opens in a sheet over it.
 * - **Desktop: the console's table**, like events, needs and donations. The
 *   job on a desktop is triage - which reviews still have no answer, which
 *   are the one-star ones - and that is a scan down a column, which a grid of
 *   cards with the rating at a different height in every box cannot give.
 *   The review text is the flexing column, clamped to two lines; the whole
 *   text is in the reply drawer, which docks right so the rows stay visible
 *   while answering them one after another.
 *
 * `?show=awaiting` opens on the unanswered filter - the dashboard's "reviews
 * to answer" row links here with it.
 */
export default function OrgReviews() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const { show } = useLocalSearchParams<{ show?: string }>();
	const [filter, setFilter] = useState<ReplyFilter>(
		show === "awaiting" ? "UNANSWERED" : "ALL",
	);
	const [replying, setReplying] = useState<ReviewItem | null>(null);
	const access = useOrgAccess();
	// A pushed screen can still be mounted when the dashboard links here
	// again, so the param is honoured on change, not only on first render.
	useEffect(() => {
		if (show === "awaiting") setFilter("UNANSWERED");
	}, [show]);

	// "Awaiting reply" is a server filter, and the count is the whole org's -
	// both used to be computed over whichever pages had loaded.
	const params = filter === "UNANSWERED" ? { awaitingReply: true } : {};
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgReviews(params),
		fetchPage: (page) =>
			engagementApi.listMyOrgReviews({ ...params, page, limit: 20 }),
	});
	const columns = useGridColumns();

	const summary = first?.summary;
	const unanswered = first?.awaitingReplyCount ?? 0;
	// A reply is public and signed by the NGO, so it takes content.publish.
	const replyBlocked = access.blocked("content.publish");

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

	const subtitle =
		summary && summary.count > 0
			? `${summary.average.toFixed(1)} average from ${summary.count} review${summary.count === 1 ? "" : "s"}${unanswered > 0 ? ` · ${unanswered} awaiting your reply` : ""}`
			: "What volunteers say about working with you";

	const viewOnly = replyBlocked ? (
		<View style={{ marginBottom: spacing[4] }}>
			<Banner tone="info" title="View only" description={replyBlocked} />
		</View>
	) : null;

	const empty = (
		<EmptyState
			icon={Star}
			title={
				filter === "UNANSWERED" ? "Every review answered" : "No reviews yet"
			}
			description={
				filter === "UNANSWERED"
					? "New reviews will show here until you reply."
					: "Volunteers can review you after an event or a pledge. Each one appears here, and your reply is shown publicly beneath it."
			}
		/>
	);

	const sheet = (
		<ReplySheet review={replying} onClose={() => setReplying(null)} />
	);

	if (isDesktop) {
		return (
			<AdminScreen
				title="Reviews"
				subtitle={subtitle}
				toolbar={
					<Toolbar>
						<SelectMenu
							label="Show"
							value={filter}
							options={FILTERS}
							onChange={setFilter}
						/>
					</Toolbar>
				}
				onNearEnd={loadMore}
				refreshing={query.isRefetching && !query.isFetchingNextPage}
				onRefresh={() => query.refetch()}
			>
				{viewOnly}
				<ConsoleList
					query={query}
					items={items}
					total={first?.meta.total ?? items.length}
					loadMore={loadMore}
					noun="review"
					view="table"
					columns={reviewColumns(replyBlocked ? undefined : setReplying)}
					rowKey={(review) => review.id}
					// The row opens the reply - the one thing to do with a review.
					// A role that cannot reply gets a row that reads, not one that
					// opens a form it cannot submit.
					{...(replyBlocked ? {} : { onRowPress: setReplying })}
					rowLabel={(review) =>
						`${review.reply ? "Edit your reply to" : "Reply to"} ${review.user.fullName ?? "this volunteer"}`
					}
					loadingLabel="Loading reviews"
					renderCard={(review) => (
						<ReviewRow
							review={review}
							onReply={replyBlocked ? undefined : () => setReplying(review)}
						/>
					)}
					empty={empty}
				/>
				{sheet}
			</AdminScreen>
		);
	}

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

			{viewOnly}

			<PagedList
				query={query}
				items={items}
				loadMore={loadMore}
				numColumns={columns}
				noun="reviews"
				header={
					<>
						{summaryCard}
						{summary && summary.count > 0 && (
							<FilterChips
								options={FILTERS}
								value={filter}
								onChange={setFilter}
							/>
						)}
					</>
				}
				keyExtractor={(item) => item.id}
				renderItem={(item) => (
					<ReviewRow
						review={item}
						onReply={replyBlocked ? undefined : () => setReplying(item)}
					/>
				)}
				empty={empty}
			/>

			{sheet}
		</Screen>
	);
}

/**
 * The desktop table's columns. Who and when, the rating, the review itself
 * (flexing, two lines), and where the reply stands. No sort: the endpoint
 * orders newest first and takes no sort key, and a browser re-sort of one
 * 20-row page would only order that page.
 */
function reviewColumns(
	onReply: ((review: ReviewItem) => void) | undefined,
): Array<TableColumn<ReviewItem>> {
	return [
		{
			key: "volunteer",
			header: "Volunteer",
			width: 220,
			render: (review) => (
				<View style={{ minWidth: 0, alignSelf: "stretch" }}>
					<Body weight="medium" numberOfLines={1}>
						{review.user.fullName ?? "Volunteer"}
					</Body>
					<Caption color="quaternary" numberOfLines={1}>
						{formatRelative(review.createdAt)}
					</Caption>
				</View>
			),
		},
		{
			key: "rating",
			header: "Rating",
			width: 96,
			render: (review) => <Stars rating={review.rating} />,
		},
		{
			key: "review",
			header: "Review",
			minWidth: 280,
			render: (review) =>
				review.body ? (
					<Caption color="secondary" numberOfLines={2}>
						{review.body}
					</Caption>
				) : (
					<Caption color="quaternary">Rating only, no text</Caption>
				),
		},
		{
			key: "reply",
			header: "Your reply",
			width: 220,
			render: (review) =>
				review.reply ? (
					<View style={{ minWidth: 0, alignSelf: "stretch" }}>
						<Caption color="tertiary" numberOfLines={1}>
							{review.reply}
						</Caption>
						{review.repliedAt ? (
							<Caption color="quaternary" numberOfLines={1}>
								{formatRelative(review.repliedAt)}
							</Caption>
						) : null}
					</View>
				) : (
					<StatusPill label="Awaiting reply" tone="warning" />
				),
		},
		{
			key: "actions",
			header: "",
			width: 104,
			align: "end",
			render: (review) =>
				onReply ? (
					<TextAction
						label={review.reply ? "Edit reply" : "Reply"}
						tone={review.reply ? "default" : "brand"}
						onPress={() => onReply(review)}
						accessibilityLabel={`${review.reply ? "Edit your reply to" : "Reply to"} ${review.user.fullName ?? "this volunteer"}`}
					/>
				) : null,
		},
	];
}

function ReviewRow({
	review,
	onReply,
}: {
	review: ReviewItem;
	/** Omitted when the viewer's team role cannot reply publicly. */
	onReply?: () => void;
}) {
	const { colors, spacing } = useTheme();
	const name = review.user.fullName ?? "Volunteer";

	return (
		<Surface>
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
						{onReply && (
							<TextAction
								label="Edit"
								onPress={onReply}
								accessibilityLabel={`Edit your reply to ${name}`}
							/>
						)}
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
					{onReply && (
						<TextAction
							label="Reply publicly"
							tone="brand"
							onPress={onReply}
							accessibilityLabel={`Reply to ${name}`}
						/>
					)}
				</View>
			)}
		</Surface>
	);
}

/** Five stars in ink - the amber `main` fails contrast as a glyph. */
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
 * Replying happens in a drawer rather than an inline field: the keyboard would
 * otherwise cover the review being answered, and the panel gives the reply a
 * pinned primary action. On desktop it docks right, so the table stays in
 * view and the next unanswered row is one click away; on a phone `Drawer` is
 * the same bottom sheet it always was. The review is quoted in full - the
 * table clamps it to two lines.
 */
function ReplySheet({
	review,
	onClose,
}: {
	review: ReviewItem | null;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const textAreaStyle = useFieldInputStyle(120);
	const buttonGrow = useFormButtonGrow();
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
				onSuccess: () => {
					toast.success("Reply posted. It shows under the review.");
					onClose();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Drawer
			visible={!!review}
			onClose={onClose}
			title={review?.reply ? "Edit your reply" : "Reply publicly"}
			subtitle={
				review ? `To ${review.user.fullName ?? "a volunteer"}` : undefined
			}
			footer={
				// The drawers' shared footer: the action sized to its label on
				// desktop, not a 400pt orange bar unlike every other form drawer.
				<View style={{ gap: spacing[2] }}>
					<FieldError message={error} />
					<FormFooterRow
						primary={
							<Button
								onPress={submit}
								loading={respond.isPending}
								style={buttonGrow}
							>
								{review?.reply ? "Save reply" : "Post reply"}
							</Button>
						}
					/>
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				{review?.body && (
					<View
						style={{
							paddingLeft: spacing[3],
							borderLeftWidth: 2,
							borderLeftColor: colors.border.dark,
							marginBottom: spacing[4],
						}}
					>
						<Caption color="tertiary">“{review.body}”</Caption>
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
		</Drawer>
	);
}
