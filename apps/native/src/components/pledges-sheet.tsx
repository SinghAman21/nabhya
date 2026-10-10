import type { PledgeStatus } from "@nabhya/shared";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ContactActions } from "@/components/contact-actions";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import { usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeStatusLabel,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useReviewPledge } from "@/hooks/use-needs";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, orgNeedsApi, queryKeys } from "@/lib/api";
import { formatProgress, formatRelative } from "@/lib/format";
import type { NeedPledge, OrgNeedListItem } from "@/lib/types";

type StatusFilter = "ALL" | PledgeStatus;
type Decision = "ACCEPTED" | "REJECTED" | "COMPLETED";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "COMPLETED", label: "Received" },
	{ value: "ALL", label: "All" },
];

/**
 * Pledge review for one post - the organisation side of the donation loop.
 *
 * Accepting advances the need's `fulfilledQuantity` by the pledged amount and
 * auto-closes it once the target is met; completing marks the handover done.
 *
 * The note to the volunteer lives on the row it is for. It used to be one
 * field above the list, "sent with your next decision" - a mode error: a
 * pickup address typed for one person went to whoever was tapped next.
 */
export function PledgesSheet({
	need,
	onClose,
}: {
	need: OrgNeedListItem | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");

	// Paged and filtered by the server - filtering page 1 here hid every
	// pending pledge past the twentieth.
	const params = filter === "ALL" ? {} : { status: filter };
	const { query, items, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgNeedPledges(need?.id ?? "", params),
		fetchPage: (page) =>
			orgNeedsApi.pledges(need?.id as string, { ...params, page, limit: 20 }),
		enabled: !!need?.id,
	});
	const review = useReviewPledge(need?.id ?? "");

	// Accepting, declining or completing is `people.review` - plus suspension,
	// which the role check alone missed.
	const reviewBlocked = useOrgAccess().blocked("people.review");

	const close = () => {
		setFilter("PENDING");
		onClose();
	};

	const decide = async (pledge: NeedPledge, status: Decision, note: string) => {
		const who = pledge.user.fullName ?? "the volunteer";
		if (status === "REJECTED") {
			const ok = await confirm({
				title: `Decline ${who}'s offer?`,
				message: note
					? "They'll be told it isn't needed this time, with your note."
					: "They'll be told it isn't needed this time.",
				confirmLabel: "Decline",
				cancelLabel: "Keep pending",
			});
			if (!ok) return;
		}
		review.mutate(
			{
				pledgeId: pledge.id,
				input: { status, reviewNote: note.trim() || undefined },
			},
			{
				onSuccess: () =>
					toast.success(
						status === "ACCEPTED"
							? `Offer from ${who} accepted. They have been notified.`
							: status === "COMPLETED"
								? `Marked received from ${who}.`
								: `Offer from ${who} declined.`,
					),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const header = (
		<View style={{ paddingTop: spacing[1], paddingBottom: spacing[2] }}>
			{need && (
				<Caption
					weight="medium"
					color="secondary"
					style={{ marginBottom: spacing[3] }}
				>
					{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
					{need.status !== "OPEN" ? ` · ${humanizeStatus(need.status)}` : ""}
				</Caption>
			)}
			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />
		</View>
	);

	return (
		<Sheet
			visible={!!need}
			onClose={close}
			title="Responses"
			subtitle={need?.title}
			scrollable={false}
			detents={["60%", "92%"]}
		>
			{query.isLoading ? (
				<LoadingState label="Loading responses" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<SheetFlatList
					data={items}
					keyExtractor={(item) => item.id}
					ListHeaderComponent={header}
					onEndReached={loadMore}
					onEndReachedThreshold={0.6}
					ListFooterComponent={
						items.length > 0 ? (
							<LoadMoreFooter
								hasMore={!!query.hasNextPage}
								loading={query.isFetchingNextPage}
								onLoadMore={loadMore}
								count={items.length}
								noun="responses"
							/>
						) : null
					}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					ListEmptyComponent={
						<EmptyState
							icon={Package}
							title={
								filter === "PENDING" ? "No one waiting" : "No responses here"
							}
							description={
								filter === "PENDING"
									? "When a volunteer offers to help with this post, it shows up here for your decision."
									: "Nothing matches this filter yet."
							}
						/>
					}
					renderItem={({ item }) => (
						<PledgeRow
							pledge={item}
							unit={need?.unit ?? null}
							reviewBlocked={reviewBlocked}
							deciding={
								review.isPending && review.variables?.pledgeId === item.id
									? review.variables.input.status
									: null
							}
							onDecide={(status, note) => decide(item, status, note)}
						/>
					)}
				/>
			)}
		</Sheet>
	);
}

function PledgeRow({
	pledge,
	unit,
	reviewBlocked,
	deciding,
	onDecide,
}: {
	pledge: NeedPledge;
	unit: string | null;
	/** Why `people.review` is denied, or null when it is allowed. */
	reviewBlocked: string | null;
	/** Which decision is in flight for *this* row, if any. */
	deciding: Decision | null;
	onDecide: (status: Decision, note: string) => void;
}) {
	const { colors, spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [note, setNote] = useState("");
	const [noteOpen, setNoteOpen] = useState(false);
	const busy = deciding !== null;
	const canReview = !reviewBlocked;
	const open = pledge.status === "PENDING" || pledge.status === "ACCEPTED";
	const name = pledge.user.fullName ?? "Unnamed volunteer";
	const verified = pledge.user.verificationStatus === "VERIFIED";
	// City only: contact details wait for acceptance (`ContactActions`).
	const meta = [pledge.user.city, verified ? "ID verified" : null]
		.filter(Boolean)
		.join(" · ");

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={pledge.user.fullName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{name}
					</Body>
					<Caption
						color={verified ? (colors.success.ink as string) : "tertiary"}
						numberOfLines={1}
					>
						{meta}
					</Caption>
				</View>
				<StatusPill
					label={pledgeStatusLabel(pledge.status)}
					tone={pledgeTone(pledge.status)}
				/>
			</View>

			{pledge.quantity !== null && (
				<Body weight="medium" style={{ marginTop: spacing[3] }}>
					Offering {pledge.quantity}
					{unit ? ` ${unit}` : ""}
				</Body>
			)}

			{pledge.message && (
				<View
					style={{
						marginTop: spacing[2],
						paddingLeft: spacing[3],
						borderLeftWidth: 2,
						borderLeftColor: colors.border.dark,
					}}
				>
					<BodySmall color="secondary">“{pledge.message}”</BodySmall>
				</View>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{formatRelative(pledge.createdAt)}
				{pledge.reviewNote ? ` · Your note: ${pledge.reviewNote}` : ""}
			</Caption>

			{/* Once accepted the NGO has to arrange the handover - #9's
			    "follow up after the pledge", without building chat. */}
			{(pledge.status === "ACCEPTED" || pledge.status === "COMPLETED") && (
				<ContactActions
					name={name}
					phone={pledge.user.phone}
					email={pledge.user.email}
				/>
			)}

			{open && reviewBlocked ? (
				<Caption color="tertiary" style={{ marginTop: spacing[4] }}>
					{reviewBlocked}
				</Caption>
			) : open && noteOpen ? (
				<Field
					label={`Note to ${name}`}
					optional
					hint="Sent with your decision - pickup address, timing, a thank-you."
					style={{ marginTop: spacing[4], marginBottom: 0 }}
				>
					<Input
						placeholder="e.g. Drop off at our Andheri office, Mon–Fri 10–5"
						value={note}
						onChangeText={setNote}
						style={inputStyle}
						autoFocus
					/>
				</Field>
			) : open ? (
				<Button
					variant="link"
					size="sm"
					onPress={() => setNoteOpen(true)}
					style={{ alignSelf: "flex-start", marginTop: spacing[2] }}
					accessibilityLabel={`Add a note for ${name}`}
				>
					Add a note
				</Button>
			) : null}
			{pledge.status === "PENDING" && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginTop: spacing[4],
					}}
				>
					<Button
						style={{ flex: 1 }}
						disabled={busy || !canReview}
						loading={deciding === "ACCEPTED"}
						onPress={() => onDecide("ACCEPTED", note)}
						accessibilityLabel={`Accept offer from ${name}`}
					>
						Accept
					</Button>
					<Button
						variant="outline"
						style={{ flex: 1 }}
						disabled={busy || !canReview}
						loading={deciding === "REJECTED"}
						onPress={() => onDecide("REJECTED", note)}
						accessibilityLabel={`Decline offer from ${name}`}
					>
						Decline
					</Button>
				</View>
			)}
			{pledge.status === "ACCEPTED" && (
				<View style={{ marginTop: spacing[4] }}>
					<Button
						disabled={busy || !canReview}
						loading={deciding === "COMPLETED"}
						onPress={() => onDecide("COMPLETED", note)}
						accessibilityLabel={`Mark ${name}'s items as received`}
					>
						Mark received
					</Button>
				</View>
			)}
		</Surface>
	);
}
