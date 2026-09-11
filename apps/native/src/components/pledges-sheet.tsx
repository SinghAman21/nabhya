import type { PledgeStatus } from "@nabhya/shared";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { InitialAvatar } from "@/components/initial-avatar";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useMyTeamRole } from "@/hooks/use-my-team-role";
import { useNeedPledges, useReviewPledge } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
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
 * Pledge review for one post — the organisation side of the donation loop.
 *
 * Accepting advances the need's `fulfilledQuantity` by the pledged amount and
 * auto-closes it once the target is met; completing marks the handover done.
 */
export function PledgesSheet({
	need,
	onClose,
}: {
	need: OrgNeedListItem | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");
	const [note, setNote] = useState("");

	const query = useNeedPledges(need?.id ?? undefined);
	const review = useReviewPledge(need?.id ?? "");

	// Accepting, declining or completing is `people.review`. Allowed while the
	// role is still resolving; the server still 403s anything denied.
	const teamRole = useMyTeamRole();
	const canReview = teamRole.isLoading ? true : teamRole.can("people.review");

	const items = (query.data?.items ?? []).filter((pledge) =>
		filter === "ALL" ? true : pledge.status === filter,
	);

	const close = () => {
		setNote("");
		setFilter("PENDING");
		onClose();
	};

	const decide = (pledge: NeedPledge, status: Decision) => {
		review.mutate(
			{
				pledgeId: pledge.id,
				input: { status, reviewNote: note.trim() || undefined },
			},
			{
				onSuccess: () => {
					setNote("");
					toast.success(
						status === "ACCEPTED" ? "Pledge accepted." : "Pledge declined.",
					);
				},
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
			{(filter === "PENDING" || filter === "ACCEPTED") && (
				<Field
					label="Note to the volunteer"
					optional
					hint="Sent with your next decision — pickup address, timing, a thank-you."
				>
					<Input
						placeholder="e.g. Drop off at our Andheri office, Mon–Fri 10–5"
						value={note}
						onChangeText={setNote}
						style={inputStyle}
					/>
				</Field>
			)}
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
							canReview={canReview}
							busy={review.isPending}
							deciding={
								review.isPending && review.variables?.pledgeId === item.id
									? review.variables.input.status
									: null
							}
							onDecide={(status) => decide(item, status)}
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
	canReview,
	busy,
	deciding,
	onDecide,
}: {
	pledge: NeedPledge;
	unit: string | null;
	/** `people.review` — false only once the role has resolved as denied. */
	canReview: boolean;
	busy: boolean;
	deciding: Decision | null;
	onDecide: (status: Decision) => void;
}) {
	const { colors, spacing } = useTheme();
	const name = pledge.user.fullName ?? "Unnamed volunteer";
	const verified = pledge.user.verificationStatus === "VERIFIED";
	const meta = [
		pledge.user.city ?? pledge.user.email,
		verified ? "ID verified" : null,
	]
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
					label={
						pledge.status === "COMPLETED"
							? "Received"
							: humanizeStatus(pledge.status)
					}
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

			{!canReview &&
			pledge.status !== "REJECTED" &&
			pledge.status !== "COMPLETED" ? (
				<Caption color="tertiary" style={{ marginTop: spacing[4] }}>
					Your role doesn't allow reviews. Ask an owner or admin.
				</Caption>
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
						onPress={() => onDecide("ACCEPTED")}
						accessibilityLabel={`Accept offer from ${name}`}
					>
						Accept
					</Button>
					<Button
						variant="outline"
						style={{ flex: 1 }}
						disabled={busy || !canReview}
						loading={deciding === "REJECTED"}
						onPress={() => onDecide("REJECTED")}
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
						onPress={() => onDecide("COMPLETED")}
						accessibilityLabel={`Mark ${name}'s items as received`}
					>
						Mark received
					</Button>
				</View>
			)}
		</Surface>
	);
}
