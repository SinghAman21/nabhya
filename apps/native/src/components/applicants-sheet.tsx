import type { ApplicationStatus } from "@nabhya/shared";
import { Users } from "lucide-react-native";
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
	applicationTone,
	humanizeStatus,
	StatusPill,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet, SheetFlatList } from "@/components/ui/sheet";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import {
	useIssueCertificate,
	useMarkAttendance,
	useRevokeCertificate,
} from "@/hooks/use-engagement";
import { useEventApplicants, useReviewApplication } from "@/hooks/use-events";
import { useMyTeamRole } from "@/hooks/use-my-team-role";
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
	const inputStyle = useFieldInputStyle();
	const [filter, setFilter] = useState<StatusFilter>("PENDING");
	const [note, setNote] = useState("");

	const query = useEventApplicants(
		eventId ?? undefined,
		filter === "ALL" ? {} : { status: filter },
	);
	const review = useReviewApplication(eventId ?? "");

	// Accepting or rejecting is `people.review`. Allowed while the role is
	// still resolving; the server still 403s anything the role cannot do.
	const teamRole = useMyTeamRole();
	const canReview = teamRole.isLoading ? true : teamRole.can("people.review");

	const close = () => {
		setNote("");
		setFilter("PENDING");
		onClose();
	};

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
				onSuccess: () => {
					setNote("");
					const who = applicant.volunteer.fullName ?? "The volunteer";
					toast.success(
						status === "ACCEPTED"
							? `${who} accepted. They have been notified.`
							: `${who} declined.`,
					);
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const header = (
		<View style={{ paddingTop: spacing[1], paddingBottom: spacing[2] }}>
			<Caption
				weight="medium"
				color={
					remainingPlaces > 0 ? "secondary" : (colors.warning.ink as string)
				}
				style={{ marginBottom: spacing[3] }}
			>
				{remainingPlaces > 0
					? `${remainingPlaces} place${remainingPlaces === 1 ? "" : "s"} left`
					: "All places are filled — raise the volunteer count to accept more."}
			</Caption>
			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />
			{filter === "PENDING" && (
				<Field
					label="Note to the volunteer"
					optional
					hint="Sent with your next decision. Where to meet, what to bring, or why not this time."
				>
					<Input
						placeholder="e.g. Meet at Gate 3 by 8am, wear closed shoes"
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
			visible={!!eventId}
			onClose={close}
			title="Applicants"
			subtitle={eventTitle}
			scrollable={false}
			detents={["60%", "92%"]}
		>
			{query.isLoading ? (
				<LoadingState label="Loading applicants" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<SheetFlatList
					data={query.data?.items ?? []}
					keyExtractor={(item) => item.id}
					ListHeaderComponent={header}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					ListEmptyComponent={
						<EmptyState
							icon={Users}
							title={
								filter === "PENDING" ? "No one waiting" : "No applicants here"
							}
							description={
								filter === "PENDING"
									? "New applications land here. You'll also see a count on the event."
									: "Nothing matches this filter yet."
							}
						/>
					}
					renderItem={({ item }) => (
						<ApplicantRow
							applicant={item}
							eventId={eventId ?? ""}
							canAccept={remainingPlaces > 0}
							canReview={canReview}
							busy={review.isPending}
							deciding={
								review.isPending && review.variables?.applicationId === item.id
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

function ApplicantRow({
	applicant,
	eventId,
	canAccept,
	canReview,
	busy,
	deciding,
	onDecide,
}: {
	applicant: EventApplicant;
	eventId: string;
	canAccept: boolean;
	/** `people.review` — false only once the role has resolved as denied. */
	canReview: boolean;
	busy: boolean;
	/** Which decision is in flight for *this* row, if any. */
	deciding: "ACCEPTED" | "REJECTED" | null;
	onDecide: (status: "ACCEPTED" | "REJECTED") => void;
}) {
	const { colors, spacing } = useTheme();
	const isPending = applicant.status === "PENDING";
	const name = applicant.volunteer.fullName ?? "Unnamed volunteer";
	const verified = applicant.volunteer.verificationStatus === "VERIFIED";
	const meta = [
		applicant.volunteer.city ?? applicant.volunteer.email,
		verified ? "ID verified" : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={applicant.volunteer.fullName} />
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
					label={humanizeStatus(applicant.status)}
					tone={applicationTone(applicant.status)}
				/>
			</View>

			{applicant.message && (
				<View
					style={{
						marginTop: spacing[3],
						paddingLeft: spacing[3],
						borderLeftWidth: 2,
						borderLeftColor: colors.border.dark,
					}}
				>
					<BodySmall color="secondary">“{applicant.message}”</BodySmall>
				</View>
			)}

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				Applied {formatRelative(applicant.appliedAt)}
				{applicant.reviewNote ? ` · Your note: ${applicant.reviewNote}` : ""}
			</Caption>

			{applicant.status === "ACCEPTED" && (
				<AttendanceControls applicant={applicant} eventId={eventId} />
			)}

			{isPending && (
				<>
					{!canReview ? (
						<Caption color="tertiary" style={{ marginTop: spacing[4] }}>
							Your role doesn't allow reviews. Ask an owner or admin.
						</Caption>
					) : null}
					<View
						style={{
							flexDirection: "row",
							gap: spacing[2],
							marginTop: spacing[4],
						}}
					>
						<Button
							style={{ flex: 1 }}
							disabled={busy || !canAccept || !canReview}
							loading={deciding === "ACCEPTED"}
							onPress={() => onDecide("ACCEPTED")}
							accessibilityLabel={`Accept ${name}`}
						>
							Accept
						</Button>
						<Button
							variant="outline"
							style={{ flex: 1 }}
							disabled={busy || !canReview}
							loading={deciding === "REJECTED"}
							onPress={() => onDecide("REJECTED")}
							accessibilityLabel={`Reject ${name}`}
						>
							Reject
						</Button>
					</View>
				</>
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
	const inputStyle = useFieldInputStyle();
	const [note, setNote] = useState("");
	const [showNote, setShowNote] = useState(false);

	const attendance = useMarkAttendance(eventId);
	const issue = useIssueCertificate(eventId);
	const revoke = useRevokeCertificate();

	const attended = !!applicant.attendedAt;
	const certificate = applicant.certificate;
	const busy = attendance.isPending || issue.isPending || revoke.isPending;

	const confirmRevoke = async () => {
		if (!certificate) return;
		// The record survives revocation, so a link already shared with an
		// employer resolves to "revoked" rather than disappearing.
		const ok = await confirm({
			title: "Revoke this certificate?",
			message: `${certificate.code} will show as revoked to anyone who verifies it, including anyone the volunteer has already sent it to. This cannot be undone.`,
			confirmLabel: "Revoke",
		});
		if (!ok) return;
		revoke.mutate(
			{ id: certificate.id, reason: "Revoked by the organization" },
			{
				onSuccess: () => toast.success("Certificate revoked."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const toggleAttendance = () => {
		attendance.mutate(
			{ applicationId: applicant.id, attended: !attended },
			{
				onError: (error) => toast.error(apiErrorMessage(error)),
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
					toast.success("Certificate issued. The volunteer has been notified.");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<View
			style={{
				marginTop: spacing[3],
				paddingTop: spacing[3],
				borderTopWidth: 1,
				borderTopColor: colors.border.hairline,
				gap: spacing[2],
			}}
		>
			{certificate ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
					}}
				>
					<View style={{ flex: 1 }}>
						<Caption
							weight="medium"
							color={
								certificate.revokedAt
									? (colors.error.ink as string)
									: (colors.success.ink as string)
							}
						>
							{certificate.revokedAt
								? "Certificate revoked"
								: `Certificate ${certificate.code}`}
						</Caption>
						<Caption color="quaternary">Attended</Caption>
					</View>
					{!certificate.revokedAt && (
						<Button
							variant="outline"
							size="sm"
							onPress={confirmRevoke}
							disabled={busy}
							loading={revoke.isPending}
						>
							Revoke
						</Button>
					)}
				</View>
			) : (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
						flexWrap: "wrap",
					}}
				>
					<Button
						variant="outline"
						size="sm"
						onPress={toggleAttendance}
						disabled={busy}
						loading={attendance.isPending}
						accessibilityState={{ checked: attended }}
					>
						{attended ? "Attended ✓" : "Mark attended"}
					</Button>
					{attended && (
						<Button
							size="sm"
							onPress={() => setShowNote((v) => !v)}
							disabled={busy}
						>
							Issue certificate
						</Button>
					)}
					{!attended && (
						<Caption color="quaternary" style={{ flex: 1 }}>
							Confirm attendance after the event to issue a certificate.
						</Caption>
					)}
				</View>
			)}

			{showNote && !certificate && (
				<View style={{ marginTop: spacing[2] }}>
					<Field
						label="Note on the certificate"
						optional
						hint="e.g. 6 hours · led the registration desk"
						style={{ marginBottom: spacing[3] }}
					>
						<Input
							placeholder="Hours contributed, role, anything worth recording"
							value={note}
							onChangeText={setNote}
							style={inputStyle}
						/>
					</Field>
					<Button
						onPress={issueCertificate}
						disabled={busy}
						loading={issue.isPending}
					>
						Confirm and issue
					</Button>
				</View>
			)}
		</View>
	);
}
