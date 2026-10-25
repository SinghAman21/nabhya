import type { PledgeStatus } from "@nabhya/shared";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { withCounts } from "@/components/applicants-sheet";
import { ContactActions } from "@/components/contact-actions";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import { useFormButtonGrow } from "@/components/ngo/form-footer";
import { NeedSummary } from "@/components/ngo/record-summary";
import { usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	SectionTitle,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import {
	pledgeStatusLabel,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useReviewPledge, useUpdateNeed } from "@/hooks/use-needs";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage, orgNeedsApi, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
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
 * One need as a record: the post itself, then every pledge on it - the
 * organisation side of the donation loop.
 *
 * Accepting advances the need's `fulfilledQuantity` by the pledged amount and
 * auto-closes it once the target is met; completing marks the handover done.
 *
 * A right-hand `Drawer` (`xl`) on desktop and a sheet on a phone, opening on
 * `NeedSummary` - direction, urgency, the quantity over its bar, the closing
 * date, Edit - for the same reason `ApplicantsDrawer` does: it used to be a
 * centred dialog whose only fact about the post was "12 of 40 blankets". The
 * chips carry the server's per-state `counts`, so "Pending 3" reads before it
 * is pressed.
 *
 * The note to the volunteer lives on the row it is for. It used to be one
 * field above the list, "sent with your next decision" - a mode error: a
 * pickup address typed for one person went to whoever was tapped next.
 */
export function PledgesDrawer({
	need,
	onClose,
	onEdit,
}: {
	need: OrgNeedListItem | null;
	onClose: () => void;
	/** Closes this drawer, then opens the editor - one drawer at a time. */
	onEdit?: (need: OrgNeedListItem) => void;
}) {
	const { spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");

	// Paged and filtered by the server - filtering page 1 here hid every
	// pending pledge past the twentieth.
	const params = filter === "ALL" ? {} : { status: filter };
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgNeedPledges(need?.id ?? "", params),
		fetchPage: (page) =>
			orgNeedsApi.pledges(need?.id as string, { ...params, page, limit: 20 }),
		enabled: !!need?.id,
	});
	const review = useReviewPledge(need?.id ?? "");

	// Accepting, declining or completing is `people.review` - plus suspension,
	// which the role check alone missed.
	const access = useOrgAccess();
	const reviewBlocked = access.blocked("people.review");
	// Closing or reopening is an edit of the post (`content.publish`, as the
	// server checks). The editor had no status control at all, so "open until
	// the target is met or you close it" named an action nobody could take.
	const canChangeStatus = !access.blocked("content.publish");
	const updateNeed = useUpdateNeed();

	const setOpen = async (target: OrgNeedListItem, open: boolean) => {
		if (!open) {
			const ok = await confirm({
				title: "Close this post?",
				message:
					"It leaves the feed and stops taking new offers. Accepted offers stay as they are, and you can reopen it later.",
				confirmLabel: "Close post",
				destructive: false,
			});
			if (!ok) return;
		}
		updateNeed.mutate(
			{ id: target.id, input: { status: open ? "OPEN" : "CLOSED" } },
			{
				onSuccess: () =>
					toast.success(
						open
							? "Post reopened - it's back in the feed."
							: "Post closed - no new offers.",
					),
				onError: (error) =>
					toast.error(
						`Couldn't ${open ? "reopen" : "close"} the post. ${apiErrorMessage(error, "Try again in a moment.")}`,
					),
			},
		);
	};

	const counts = first?.counts;
	const chipOptions = withCounts(FILTERS, (value) =>
		counts ? (value === "ALL" ? counts.all : counts[value]) : undefined,
	);

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

	let list: React.ReactNode;
	if (query.isLoading) {
		list = <SkeletonList variant="card" count={3} />;
	} else if (query.isError) {
		list = (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	} else if (items.length === 0) {
		list = (
			<EmptyState
				icon={Package}
				title={filter === "PENDING" ? "No one waiting" : "No responses here"}
				description={
					filter === "PENDING"
						? (counts?.all ?? 0) > 0
							? "Every response has a decision. The other filters hold them."
							: "When a volunteer offers to help with this post, it shows up here for your decision."
						: "Nothing matches this filter yet."
				}
			/>
		);
	} else {
		list = (
			<View style={{ gap: spacing[3] }}>
				{items.map((item) => (
					<PledgeRow
						key={item.id}
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
				))}
				<LoadMoreFooter
					hasMore={!!query.hasNextPage}
					loading={query.isFetchingNextPage}
					onLoadMore={loadMore}
					count={items.length}
					noun="responses"
				/>
			</View>
		);
	}

	return (
		<Drawer
			visible={!!need}
			onClose={close}
			title={need?.title ?? "Need"}
			subtitle={
				need?.type === "OFFER" ? "Offer and responses" : "Need and responses"
			}
			xl
		>
			{need && (
				<NeedSummary
					need={need}
					onEdit={onEdit ? () => onEdit(need) : undefined}
				/>
			)}
			{need && canChangeStatus && need.status !== "FULFILLED" ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
						marginTop: spacing[3],
					}}
				>
					<Caption color="tertiary" style={{ flex: 1 }}>
						{need.status === "OPEN"
							? "Taking offers in the feed."
							: "Closed - hidden from the feed, no new offers."}
					</Caption>
					<TextAction
						label={need.status === "OPEN" ? "Close post" : "Reopen"}
						disabled={updateNeed.isPending}
						onPress={() => void setOpen(need, need.status !== "OPEN")}
					/>
				</View>
			) : null}
			<View style={{ marginTop: spacing[6] }}>
				<SectionTitle>Responses</SectionTitle>
				<FilterChips
					label="Filter responses"
					options={chipOptions}
					value={filter}
					onChange={setFilter}
				/>
				{list}
			</View>
		</Drawer>
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
	const grow = useFormButtonGrow();
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
					// The link's own 14pt padding is pulled back so its text lines up
					// with the message and the meta line above it.
					style={{
						alignSelf: "flex-start",
						marginTop: spacing[2],
						marginLeft: -spacing[3.5],
					}}
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
						style={grow}
						disabled={busy || !canReview}
						loading={deciding === "ACCEPTED"}
						onPress={() => onDecide("ACCEPTED", note)}
						accessibilityLabel={`Accept offer from ${name}`}
					>
						Accept
					</Button>
					<Button
						variant="outline"
						style={grow}
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
				<View style={{ marginTop: spacing[4], flexDirection: "row" }}>
					<Button
						style={grow}
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
