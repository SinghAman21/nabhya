import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { FactGroup, ReasonField } from "@/components/admin/sheet-parts";
import {
	Banner,
	ErrorState,
	LoadingState,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import {
	useAdminOrganization,
	useReviewOrganization,
	useSetOrganizationStatus,
} from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Full NGO dossier with the moderation actions attached.
 *
 * Read top to bottom the way a reviewer works: state, then the facts they
 * check against the documents, then the documents themselves, then the
 * decision — always in the same order (approve, under review, reject,
 * suspend) so the hand learns where each button is. The reason box sits
 * directly above the buttons that need it, and complains there, inline.
 */
export function OrgDetailSheet({
	organizationId,
	onClose,
}: {
	organizationId: string | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const [reason, setReason] = useState("");
	const [reasonError, setReasonError] = useState<string | null>(null);

	const query = useAdminOrganization(organizationId ?? undefined);
	const review = useReviewOrganization();
	const setStatus = useSetOrganizationStatus();

	const org = query.data;
	const busy = review.isPending || setStatus.isPending;

	const close = () => {
		setReason("");
		setReasonError(null);
		onClose();
	};

	const changeReason = (text: string) => {
		setReason(text);
		if (reasonError && text.trim()) setReasonError(null);
	};

	const decide = (
		verificationStatus: "UNDER_REVIEW" | "VERIFIED" | "REJECTED",
	) => {
		if (!organizationId) return;
		const text = reason.trim();
		if (verificationStatus === "REJECTED" && !text) {
			setReasonError(
				"Tell the organization what is missing or wrong so they can fix it.",
			);
			return;
		}
		setReasonError(null);
		review.mutate(
			{
				id: organizationId,
				input: { verificationStatus, reason: text || undefined },
			},
			{
				onSuccess: () => setReason(""),
				onError: (error) =>
					Alert.alert("Could not update", apiErrorMessage(error)),
			},
		);
	};

	const toggleSuspension = () => {
		if (!organizationId || !org) return;
		const suspending = org.status !== "SUSPENDED";
		const text = reason.trim();

		if (suspending && !text) {
			setReasonError("Add a reason before suspending this organization.");
			return;
		}
		setReasonError(null);

		Alert.alert(
			suspending ? "Suspend organization?" : "Reinstate organization?",
			suspending
				? "Their published events will be cancelled and open needs closed."
				: "They will be able to publish again.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: suspending ? "Suspend" : "Reinstate",
					style: suspending ? "destructive" : "default",
					onPress: () =>
						setStatus.mutate(
							{
								id: organizationId,
								input: {
									status: suspending ? "SUSPENDED" : "ACTIVE",
									reason: text || undefined,
								},
							},
							{
								onSuccess: () => setReason(""),
								onError: (error) =>
									Alert.alert("Could not update", apiErrorMessage(error)),
							},
						),
				},
			],
		);
	};

	const suspended = org?.status === "SUSPENDED";

	return (
		<Sheet
			visible={!!organizationId}
			onClose={close}
			title={org?.organizationName ?? "Organization"}
			subtitle={
				org?.registrationNumber
					? `Reg. ${org.registrationNumber}`
					: (org?.email ?? undefined)
			}
		>
			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !org ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
							marginBottom: spacing[5],
						}}
					>
						<StatusPill
							label={humanizeStatus(org.verificationStatus)}
							tone={verificationTone(org.verificationStatus)}
						/>
						{suspended && <StatusPill label="Suspended" tone="error" />}
					</View>

					{org.rejectionReason && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner
								tone="error"
								title="Rejected"
								description={org.rejectionReason}
							/>
						</View>
					)}

					<Section title="Organization">
						<FactGroup
							facts={[
								{ label: "Type", value: humanizeStatus(org.orgType) },
								{ label: "Registration", value: org.registrationNumber },
								{ label: "Email", value: org.email },
								{ label: "Phone", value: org.phone },
								{ label: "Website", value: org.website },
								{
									label: "Location",
									value: [org.address, org.city, org.state, org.pincode]
										.filter(Boolean)
										.join(", "),
								},
								{
									label: "Team size",
									value: org.teamSize ? String(org.teamSize) : null,
								},
								{
									label: "Founded",
									value: org.foundingYear ? String(org.foundingYear) : null,
								},
								{ label: "Registered", value: formatDate(org.createdAt) },
							]}
						/>
					</Section>

					{(org.description || org.mission) && (
						<Section title="About">
							<Surface>
								{org.description && (
									<Body color="secondary">{org.description}</Body>
								)}
								{org.mission && (
									<Caption
										color="tertiary"
										style={{ marginTop: org.description ? spacing[2] : 0 }}
									>
										Mission: {org.mission}
									</Caption>
								)}
							</Surface>
						</Section>
					)}

					<Section title="Owner">
						<FactGroup
							facts={[
								{ label: "Name", value: org.owner.fullName },
								{ label: "Email", value: org.owner.email },
								{ label: "Phone", value: org.owner.phone },
								{
									label: "ID status",
									value: humanizeStatus(org.owner.verificationStatus),
								},
							]}
						/>
					</Section>

					<Section title="Activity">
						<FactGroup
							facts={[
								{
									label: "Events",
									value: `${org.stats.events.total} total · ${org.stats.events.published} published`,
								},
								{
									label: "Needs",
									value: `${org.stats.needs.total} total · ${org.stats.needs.open} open`,
								},
							]}
						/>
						{org.recentEvents.length > 0 && (
							<View style={{ gap: spacing[2], marginTop: spacing[2] }}>
								{org.recentEvents.slice(0, 3).map((event) => (
									<Surface key={event.id}>
										<View
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: spacing[2],
											}}
										>
											<Body
												weight="medium"
												style={{ flex: 1 }}
												numberOfLines={1}
											>
												{event.title}
											</Body>
											<StatusPill
												label={humanizeStatus(event.status)}
												tone={eventStatusTone(event.status)}
											/>
										</View>
										<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
											{formatDate(event.startAt)} · {event.acceptedCount} of{" "}
											{event.volunteersNeeded} volunteers
										</Caption>
									</Surface>
								))}
							</View>
						)}
					</Section>

					<Section
						title={`Documents${org.documents.length ? ` (${org.documents.length})` : ""}`}
					>
						{org.documents.length === 0 ? (
							<Surface>
								<Caption color="tertiary">
									Nothing uploaded yet. The NGO must submit its registration
									documents before it can be verified.
								</Caption>
							</Surface>
						) : (
							<View style={{ gap: spacing[2] }}>
								{org.documents.map((document) => (
									<DocumentReviewRow
										key={document.id}
										document={document}
										kind="organization"
										label={
											ORG_DOCUMENT_LABELS[document.documentType] ??
											humanizeStatus(document.documentType)
										}
									/>
								))}
							</View>
						)}
					</Section>

					<SectionTitle>Decision</SectionTitle>
					<ReasonField
						value={reason}
						onChangeText={changeReason}
						placeholder="Explain what's missing or wrong"
						requiredFor="reject or suspend"
						error={reasonError}
					/>

					<View style={{ gap: spacing[2], paddingBottom: spacing[2] }}>
						{org.verificationStatus !== "VERIFIED" && (
							<Button
								onPress={() => decide("VERIFIED")}
								disabled={busy}
								loading={
									review.isPending &&
									review.variables?.input.verificationStatus === "VERIFIED"
								}
							>
								Approve organization
							</Button>
						)}
						{org.verificationStatus === "PENDING" && (
							<Button
								variant="outline"
								onPress={() => decide("UNDER_REVIEW")}
								disabled={busy}
								loading={
									review.isPending &&
									review.variables?.input.verificationStatus === "UNDER_REVIEW"
								}
							>
								Mark under review
							</Button>
						)}
						{org.verificationStatus !== "REJECTED" && (
							<Button
								variant="outline"
								onPress={() => decide("REJECTED")}
								disabled={busy}
								loading={
									review.isPending &&
									review.variables?.input.verificationStatus === "REJECTED"
								}
							>
								Reject
							</Button>
						)}
						<Button
							variant={suspended ? "outline" : "destructive"}
							onPress={toggleSuspension}
							disabled={busy}
							loading={setStatus.isPending}
						>
							{suspended ? "Reinstate organization" : "Suspend organization"}
						</Button>
					</View>
				</>
			)}
		</Sheet>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[5] }}>
			<SectionTitle>{title}</SectionTitle>
			{children}
		</View>
	);
}
