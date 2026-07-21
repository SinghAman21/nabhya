import type { PledgeStatus } from "@nabhya/shared";
import { HeartHandshake, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, View } from "react-native";
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
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useNeedPledges, useReviewPledge } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { NeedPledge, OrgNeedListItem } from "@/lib/types";

type StatusFilter = "ALL" | PledgeStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "COMPLETED", label: "Completed" },
	{ value: "ALL", label: "All" },
];

/**
 * Pledge review for a single need/offer post — accept, reject, or mark a
 * hand-over completed in place. The pledges endpoint has no status filter,
 * so filtering happens on the fetched page.
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

	const query = useNeedPledges(need?.id);
	const review = useReviewPledge(need?.id ?? "");

	const pledges = (query.data?.items ?? []).filter(
		(pledge) => filter === "ALL" || pledge.status === filter,
	);

	const decide = (
		pledge: NeedPledge,
		status: "ACCEPTED" | "REJECTED" | "COMPLETED",
	) => {
		review.mutate(
			{ pledgeId: pledge.id, input: { status } },
			{
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	return (
		<Modal
			visible={!!need}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "flex-start",
							justifyContent: "space-between",
							gap: spacing[3],
						}}
					>
						<View style={{ flex: 1 }}>
							<H2 numberOfLines={2}>
								{need?.type === "OFFER" ? "Claims" : "Pledges"}
							</H2>
							<Caption color="tertiary" numberOfLines={1}>
								{need?.title ?? ""}
							</Caption>
						</View>
						<Pressable onPress={onClose} hitSlop={12}>
							<X size={22} color={colors.text.tertiary as string} />
						</Pressable>
					</View>
				</View>

				<View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[4] }}>
					<FilterChips options={FILTERS} value={filter} onChange={setFilter} />
				</View>

				{query.isLoading ? (
					<LoadingState label="Loading responses…" />
				) : query.isError ? (
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				) : (
					<FlatList
						data={pledges}
						keyExtractor={(item) => item.id}
						contentContainerStyle={{
							paddingHorizontal: spacing[6],
							paddingBottom: spacing[10],
						}}
						ItemSeparatorComponent={() => (
							<View style={{ height: spacing[3] }} />
						)}
						ListEmptyComponent={
							<EmptyState
								icon={HeartHandshake}
								title="No responses here"
								description={
									filter === "PENDING"
										? "New responses will show up here for review."
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
			</View>
		</Modal>
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
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
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

			{pledge.user.verificationStatus === "VERIFIED" && (
				<Caption
					color={colors.success.main as string}
					style={{ marginTop: spacing[2] }}
				>
					ID verified
				</Caption>
			)}

			{pledge.quantity != null && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					Offering {pledge.quantity}
					{unit ? ` ${unit}` : ""}
				</Caption>
			)}

			{pledge.message && (
				<Caption color="secondary" style={{ marginTop: spacing[2] }}>
					“{pledge.message}”
				</Caption>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				Responded {formatRelative(pledge.createdAt)}
			</Caption>

			{pledge.status === "PENDING" && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginTop: spacing[4],
					}}
				>
					<Pressable
						disabled={busy}
						onPress={() => onDecide("ACCEPTED")}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing[2.5],
							borderRadius: 12,
							backgroundColor: colors.primary.main,
							opacity: busy ? 0.5 : 1,
						}}
					>
						<Body weight="bold" color={colors.primary.contrast as string}>
							Accept
						</Body>
					</Pressable>
					<Pressable
						disabled={busy}
						onPress={() => onDecide("REJECTED")}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing[2.5],
							borderRadius: 12,
							borderWidth: 1,
							borderColor: colors.border.medium,
							opacity: busy ? 0.5 : 1,
						}}
					>
						<Body weight="medium">Reject</Body>
					</Pressable>
				</View>
			)}

			{pledge.status === "ACCEPTED" && (
				<Pressable
					disabled={busy}
					onPress={() => onDecide("COMPLETED")}
					style={{
						alignItems: "center",
						paddingVertical: spacing[2.5],
						borderRadius: 12,
						marginTop: spacing[4],
						backgroundColor: colors.success.main,
						opacity: busy ? 0.5 : 1,
					}}
				>
					<Body weight="bold" color={colors.primary.contrast as string}>
						Mark handover complete
					</Body>
				</Pressable>
			)}
		</Surface>
	);
}
