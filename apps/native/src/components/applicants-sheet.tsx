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
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useIssueCertificate,
	useMarkAttendance,
	useRevokeCertificate,
} from "@/hooks/use-engagement";
import { useEventApplicants, useReviewApplication } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
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
	const [note, setNote] = useState("");

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
			{
				applicationId: applicant.id,
				input: { status, reviewNote: note.trim() || undefined },
			},
			{
				onSuccess: () => setNote(""),
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

					<Label style={{ marginBottom: spacing[1.5] }}>
						Note to the volunteer <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="Where to meet, what to bring, why they weren't selected"
						value={note}
						onChangeText={setNote}
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
							marginBottom: spacing[4],
						}}
					/>
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
								eventId={eventId ?? ""}
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
	eventId,
	canAccept,
	busy,
	onDecide,
}: {
	applicant: EventApplicant;
	eventId: string;
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

			{applicant.status === "ACCEPTED" && (
				<AttendanceControls applicant={applicant} eventId={eventId} />
			)}

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

/**
 * Post-event controls for an accepted volunteer.
 *
 * Attendance is deliberately an explicit confirmation rather than something
 * inferred from the event's end date, and the server refuses to issue a
 * certificate without it.
 */
function AttendanceControls({
	applicant,
	eventId,
}: {
	applicant: EventApplicant;
	eventId: string;
}) {
	const { colors, spacing } = useTheme();
	const [note, setNote] = useState("");
	const [showNote, setShowNote] = useState(false);

	const attendance = useMarkAttendance(eventId);
	const issue = useIssueCertificate(eventId);
	const revoke = useRevokeCertificate();

	const attended = !!applicant.attendedAt;
	const certificate = applicant.certificate;
	const busy = attendance.isPending || issue.isPending || revoke.isPending;

	const confirmRevoke = () => {
		if (!certificate) return;
		// The record survives revocation, so a link already shared with an
		// employer resolves to "revoked" rather than disappearing.
		Alert.alert(
			"Revoke certificate",
			`${certificate.code} will show as revoked to anyone who verifies it. This cannot be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Revoke",
					style: "destructive",
					onPress: () =>
						revoke.mutate(
							{ id: certificate.id, reason: "Revoked by the organization" },
							{
								onError: (error) =>
									Alert.alert("Could not revoke", apiErrorMessage(error)),
							},
						),
				},
			],
		);
	};

	const toggleAttendance = () => {
		attendance.mutate(
			{ applicationId: applicant.id, attended: !attended },
			{
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	const issueCertificate = () => {
		issue.mutate(
			{ applicationId: applicant.id, note: note.trim() || undefined },
			{
				onSuccess: () => {
					setNote("");
					setShowNote(false);
					Alert.alert("Certificate issued", "The volunteer has been notified.");
				},
				onError: (error) =>
					Alert.alert("Could not issue", apiErrorMessage(error)),
			},
		);
	};

	return (
		<View
			style={{
				marginTop: spacing[3],
				paddingTop: spacing[3],
				borderTopWidth: 1,
				borderTopColor: colors.border.light,
			}}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}
			>
				<Pressable onPress={toggleAttendance} disabled={busy} hitSlop={8}>
					<Caption
						weight="medium"
						color={
							attended
								? (colors.success.main as string)
								: (colors.primary.main as string)
						}
					>
						{attended ? "✓ Attended" : "Mark attended"}
					</Caption>
				</Pressable>

				{attended && !certificate && (
					<Pressable
						onPress={() => setShowNote((v) => !v)}
						disabled={busy}
						hitSlop={8}
					>
						<Caption weight="medium" color={colors.primary.main as string}>
							Issue certificate
						</Caption>
					</Pressable>
				)}

				{certificate && (
					<>
						<Caption
							color={
								certificate.revokedAt
									? (colors.error.main as string)
									: (colors.success.main as string)
							}
						>
							{certificate.revokedAt ? "Revoked" : `✓ ${certificate.code}`}
						</Caption>
						{!certificate.revokedAt && (
							<Pressable onPress={confirmRevoke} disabled={busy} hitSlop={8}>
								<Caption weight="medium" color={colors.error.main as string}>
									{revoke.isPending ? "Revoking…" : "Revoke"}
								</Caption>
							</Pressable>
						)}
					</>
				)}
			</View>

			{showNote && (
				<View style={{ marginTop: spacing[3] }}>
					<Input
						placeholder="Optional note — e.g. hours contributed"
						value={note}
						onChangeText={setNote}
						style={{
							borderWidth: 0,
							borderRadius: 12,
							backgroundColor: colors.background.tertiary,
							paddingVertical: spacing[3],
						}}
					/>
					<Pressable
						onPress={issueCertificate}
						disabled={busy}
						hitSlop={8}
						style={{ marginTop: spacing[2] }}
					>
						<Caption weight="bold" color={colors.primary.main as string}>
							{issue.isPending ? "Issuing…" : "Confirm and issue"}
						</Caption>
					</Pressable>
				</View>
			)}
		</View>
	);
}
