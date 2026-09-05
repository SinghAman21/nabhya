import type { PledgeStatus } from "@nabhya/shared";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
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
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useNeedPledges, useReviewPledge } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatProgress, formatRelative } from "@/lib/format";
import type { NeedPledge, OrgNeedListItem } from "@/lib/types";

type StatusFilter = "ALL" | PledgeStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "COMPLETED", label: "Completed" },
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
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");
	const [note, setNote] = useState("");

	const query = useNeedPledges(need?.id ?? undefined);
	const review = useReviewPledge(need?.id ?? "");

	const items = (query.data?.items ?? []).filter((pledge) =>
		filter === "ALL" ? true : pledge.status === filter,
	);

	const close = () => {
		setNote("");
		onClose();
	};

	const decide = (
		pledge: NeedPledge,
		status: "ACCEPTED" | "REJECTED" | "COMPLETED",
	) => {
		review.mutate(
			{
				pledgeId: pledge.id,
				input: { status, reviewNote: note.trim() || undefined },
			},
			{
				onSuccess: () => setNote(""),
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	const noteField = (
		<View style={{ paddingTop: spacing[1], paddingBottom: spacing[4] }}>
			{need && (
				<Caption color="secondary" style={{ marginBottom: spacing[3] }}>
					{formatProgress(need.fulfilledQuantity, need.quantity, need.unit)}
				</Caption>
			)}
			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />
			<Label style={{ marginBottom: spacing[1.5] }}>
				Note to the volunteer <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="Pickup address, timing, anything they need to know"
				value={note}
				onChangeText={setNote}
				style={{
					borderWidth: 0,
					borderRadius: 12,
					backgroundColor: colors.background.tertiary,
					paddingVertical: spacing[3],
				}}
			/>
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
				<LoadingState label="Loading responses…" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<SheetFlatList
					data={items}
					keyExtractor={(item) => item.id}
					ListHeaderComponent={noteField}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					ListEmptyComponent={
						<EmptyState
							icon={Package}
							title="No responses here"
							description={
								filter === "PENDING"
									? "New offers will appear here for review."
									: "Nothing matches this filter yet."
							}
						/>
					}
					renderItem={({ item }) => (
						<PledgeRow
							pledge={item}
							unit={need?.unit ?? null}
							busy={review.isPending}
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
	busy,
	onDecide,
}: {
	pledge: NeedPledge;
	unit: string | null;
	busy: boolean;
	onDecide: (status: "ACCEPTED" | "REJECTED" | "COMPLETED") => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<View
					style={{
						width: 40,
						height: 40,
						borderRadius: 20,
						backgroundColor: colors.primary.main,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Body weight="bold" color={colors.primary.contrast as string}>
						{(pledge.user.fullName ?? pledge.user.email)[0]?.toUpperCase()}
					</Body>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{pledge.user.fullName ?? "Unnamed volunteer"}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{pledge.user.city ?? pledge.user.email}
					</Caption>
				</View>
				<StatusPill
					label={humanizeStatus(pledge.status)}
					tone={pledgeTone(pledge.status)}
				/>
			</View>

			{pledge.quantity !== null && (
				<Body weight="medium" style={{ marginTop: spacing[3] }}>
					Offering {pledge.quantity}
					{unit ? ` ${unit}` : ""}
				</Body>
			)}

			{pledge.user.verificationStatus === "VERIFIED" && (
				<Caption
					color={colors.success.main as string}
					style={{ marginTop: spacing[1] }}
				>
					ID verified
				</Caption>
			)}

			{pledge.message && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{pledge.message}”
				</Caption>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{formatRelative(pledge.createdAt)}
			</Caption>

			<View
				style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[4] }}
			>
				{pledge.status === "PENDING" && (
					<>
						<Action
							label="Accept"
							primary
							disabled={busy}
							onPress={() => onDecide("ACCEPTED")}
						/>
						<Action
							label="Reject"
							disabled={busy}
							onPress={() => onDecide("REJECTED")}
						/>
					</>
				)}
				{pledge.status === "ACCEPTED" && (
					<Action
						label="Mark received"
						primary
						disabled={busy}
						onPress={() => onDecide("COMPLETED")}
					/>
				)}
			</View>
		</Surface>
	);
}

function Action({
	label,
	primary,
	disabled,
	onPress,
}: {
	label: string;
	primary?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={{
				flex: 1,
				alignItems: "center",
				paddingVertical: spacing[2.5],
				borderRadius: 12,
				backgroundColor: primary ? colors.primary.main : "transparent",
				borderWidth: primary ? 0 : 1,
				borderColor: colors.border.medium,
				opacity: disabled ? 0.5 : 1,
			}}
		>
			<Body
				weight={primary ? "bold" : "medium"}
				color={primary ? (colors.primary.contrast as string) : "primary"}
			>
				{label}
			</Body>
		</Pressable>
	);
}
