import type { ApplicationStatus } from "@nabhya/shared";
import { Users, X } from "lucide-react-native";
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
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useEventApplicants, useReviewApplication } from "@/hooks/use-events";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { EventApplicant } from "@/lib/types";

type StatusFilter = "ALL" | ApplicationStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "REJECTED", label: "Rejected" },
	{ value: "ALL", label: "All" },
];

/** Applicant review for a single event — accept or reject in place. */
export function ApplicantsSheet({
	eventId,
	eventTitle,
	remainingPlaces,
	onClose,
}: {
	eventId: string | null;
	eventTitle: string;
	remainingPlaces: number;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");

	const query = useEventApplicants(
		eventId ?? undefined,
		filter === "ALL" ? {} : { status: filter },
	);
	const review = useReviewApplication(eventId ?? "");

	const decide = (
		applicant: EventApplicant,
		status: "ACCEPTED" | "REJECTED",
	) => {
		review.mutate(
			{ applicationId: applicant.id, input: { status } },
			{
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	return (
		<Modal
			visible={!!eventId}
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
							<H2 numberOfLines={2}>Applicants</H2>
							<Caption color="tertiary" numberOfLines={1}>
								{eventTitle}
							</Caption>
						</View>
						<Pressable onPress={onClose} hitSlop={12}>
							<X size={22} color={colors.text.tertiary as string} />
						</Pressable>
					</View>

					<Caption
						color={
							remainingPlaces > 0
								? "secondary"
								: (colors.warning.main as string)
						}
						style={{ marginTop: spacing[3] }}
					>
						{remainingPlaces > 0
							? `${remainingPlaces} place${remainingPlaces === 1 ? "" : "s"} remaining`
							: "All places are filled"}
					</Caption>
				</View>

				<View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[4] }}>
					<FilterChips options={FILTERS} value={filter} onChange={setFilter} />
				</View>

				{query.isLoading ? (
					<LoadingState label="Loading applicants…" />
				) : query.isError ? (
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				) : (
					<FlatList
						data={query.data?.items ?? []}
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
								icon={Users}
								title="No applicants here"
								description={
									filter === "PENDING"
										? "New applications will show up here for review."
										: "Nothing matches this filter yet."
								}
							/>
						}
						renderItem={({ item }) => (
							<ApplicantRow
								applicant={item}
								canAccept={remainingPlaces > 0}
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

function ApplicantRow({
	applicant,
	canAccept,
	busy,
	onDecide,
}: {
	applicant: EventApplicant;
	canAccept: boolean;
	busy: boolean;
	onDecide: (status: "ACCEPTED" | "REJECTED") => void;
}) {
	const { colors, spacing } = useTheme();
	const isPending = applicant.status === "PENDING";

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
						{(applicant.volunteer.fullName ??
							applicant.volunteer.email)[0]?.toUpperCase()}
					</Body>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{applicant.volunteer.fullName ?? "Unnamed volunteer"}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{applicant.volunteer.city ?? applicant.volunteer.email}
					</Caption>
				</View>
				<StatusPill
					label={humanizeStatus(applicant.status)}
					tone={applicationTone(applicant.status)}
				/>
			</View>

			{applicant.volunteer.verificationStatus === "VERIFIED" && (
				<Caption
					color={colors.success.main as string}
					style={{ marginTop: spacing[2] }}
				>
					ID verified
				</Caption>
			)}

			{applicant.message && (
				<Caption color="secondary" style={{ marginTop: spacing[3] }}>
					“{applicant.message}”
				</Caption>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				Applied {formatRelative(applicant.appliedAt)}
			</Caption>

			{isPending && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginTop: spacing[4],
					}}
				>
					<Pressable
						disabled={busy || !canAccept}
						onPress={() => onDecide("ACCEPTED")}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing[2.5],
							borderRadius: 12,
							backgroundColor: colors.primary.main,
							opacity: busy || !canAccept ? 0.5 : 1,
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
		</Surface>
	);
}
