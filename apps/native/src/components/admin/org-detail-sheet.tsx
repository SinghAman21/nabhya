import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, H2, Label } from "@/components/ui/typography";
import {
	useAdminOrganization,
	useReviewOrganization,
	useSetOrganizationStatus,
} from "@/hooks/use-admin";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Full NGO dossier with the moderation actions attached — documents, activity
 * counts and recent events, so a decision can be made without leaving here.
 */
export function OrgDetailSheet({
	organizationId,
	onClose,
}: {
	organizationId: string | null;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [reason, setReason] = useState("");

	const query = useAdminOrganization(organizationId ?? undefined);
	const review = useReviewOrganization();
	const _openDocument = useOpenDocument();
	const setStatus = useSetOrganizationStatus();

	const org = query.data;
	const busy = review.isPending || setStatus.isPending;

	const close = () => {
		setReason("");
		onClose();
	};

	const decide = (
		verificationStatus: "UNDER_REVIEW" | "VERIFIED" | "REJECTED",
	) => {
		if (!organizationId) return;
		if (verificationStatus === "REJECTED" && !reason.trim()) {
			Alert.alert(
				"Reason required",
				"Tell the organization why they were rejected so they can fix it.",
			);
			return;
		}
		review.mutate(
			{
				id: organizationId,
				input: { verificationStatus, reason: reason.trim() || undefined },
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

		if (suspending && !reason.trim()) {
			Alert.alert(
				"Reason required",
				"Add a reason before suspending this organization.",
			);
			return;
		}

		Alert.alert(
			suspending ? "Suspend organization" : "Reinstate organization",
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
									reason: reason.trim() || undefined,
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

	return (
		<Modal
			visible={!!organizationId}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={close}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<H2 style={{ flex: 1 }} numberOfLines={1}>
						{org?.organizationName ?? "Organization"}
					</H2>
					<Pressable onPress={close} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				{query.isLoading ? (
					<LoadingState />
				) : query.isError || !org ? (
					<ErrorState
						message={apiErrorMessage(query.error)}
						onRetry={() => query.refetch()}
					/>
				) : (
					<ScrollView
						contentContainerStyle={{
							paddingHorizontal: spacing[6],
							paddingBottom: spacing[12],
						}}
						keyboardShouldPersistTaps="handled"
					>
						<View
							style={{
								flexDirection: "row",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							<StatusPill
								label={humanizeStatus(org.verificationStatus)}
								tone={verificationTone(org.verificationStatus)}
							/>
							{org.status === "SUSPENDED" && (
								<StatusPill label="Suspended" tone="error" />
							)}
						</View>

						{org.rejectionReason && (
							<Surface
								style={{
									marginBottom: spacing[5],
									backgroundColor: colors.error.bg,
									borderColor: colors.error.border,
								}}
							>
								<Caption weight="bold" color={colors.error.main as string}>
									Rejection reason
								</Caption>
								<Caption color="secondary">{org.rejectionReason}</Caption>
							</Surface>
						)}

						<SectionTitle>Details</SectionTitle>
						<Surface style={{ marginBottom: spacing[5] }}>
							<InfoRow label="Type" value={humanizeStatus(org.orgType)} />
							<InfoRow label="Registration" value={org.registrationNumber} />
							<InfoRow label="Email" value={org.email} />
							<InfoRow label="Phone" value={org.phone} />
							<InfoRow
								label="Location"
								value={[org.city, org.state, org.pincode]
									.filter(Boolean)
									.join(", ")}
							/>
							<InfoRow
								label="Team size"
								value={org.teamSize ? String(org.teamSize) : null}
							/>
							<InfoRow
								label="Founded"
								value={org.foundingYear ? String(org.foundingYear) : null}
							/>
							<InfoRow
								label="Registered"
								value={formatDate(org.createdAt)}
								last
							/>
						</Surface>

						<SectionTitle>Owner</SectionTitle>
						<Surface style={{ marginBottom: spacing[5] }}>
							<InfoRow label="Name" value={org.owner.fullName} />
							<InfoRow label="Email" value={org.owner.email} />
							<InfoRow label="Phone" value={org.owner.phone} />
							<InfoRow
								label="ID status"
								value={humanizeStatus(org.owner.verificationStatus)}
								last
							/>
						</Surface>

						<SectionTitle>Activity</SectionTitle>
						<Surface style={{ marginBottom: spacing[5] }}>
							<InfoRow
								label="Events"
								value={`${org.stats.events.total} total · ${org.stats.events.published} published`}
							/>
							<InfoRow
								label="Needs"
								value={`${org.stats.needs.total} total · ${org.stats.needs.open} open`}
								last
							/>
						</Surface>

						<SectionTitle>Documents ({org.documents.length})</SectionTitle>
						<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
							{org.documents.length === 0 && (
								<Surface>
									<Caption color="tertiary">
										No documents uploaded yet — the NGO must submit these before
										it can be verified.
									</Caption>
								</Surface>
							)}
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

						<SectionTitle>Decision</SectionTitle>
						<Label style={{ marginBottom: spacing[1.5] }}>
							Reason{" "}
							<Caption color="tertiary">
								(required to reject or suspend)
							</Caption>
						</Label>
						<Input
							placeholder="Explain what's missing or wrong"
							value={reason}
							onChangeText={setReason}
							multiline
							style={{
								borderWidth: 0,
								borderRadius: 12,
								backgroundColor: colors.background.tertiary,
								paddingVertical: spacing[3.5],
								minHeight: 88,
								textAlignVertical: "top",
								marginBottom: spacing[4],
							}}
						/>

						{org.verificationStatus !== "VERIFIED" && (
							<Button
								onPress={() => decide("VERIFIED")}
								disabled={busy}
								style={{ marginBottom: spacing[2] }}
							>
								Approve organization
							</Button>
						)}
						{org.verificationStatus === "PENDING" && (
							<Button
								variant="outline"
								onPress={() => decide("UNDER_REVIEW")}
								disabled={busy}
								style={{ marginBottom: spacing[2] }}
							>
								Mark under review
							</Button>
						)}
						{org.verificationStatus !== "REJECTED" && (
							<Button
								variant="outline"
								onPress={() => decide("REJECTED")}
								disabled={busy}
								style={{ marginBottom: spacing[2] }}
							>
								Reject
							</Button>
						)}
						<Button
							variant={org.status === "SUSPENDED" ? "outline" : "destructive"}
							onPress={toggleSuspension}
							disabled={busy}
						>
							{org.status === "SUSPENDED"
								? "Reinstate organization"
								: "Suspend organization"}
						</Button>
					</ScrollView>
				)}
			</View>
		</Modal>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	const { spacing } = useTheme();
	return (
		<Caption
			weight="bold"
			color="tertiary"
			style={{
				letterSpacing: 1,
				textTransform: "uppercase",
				marginBottom: spacing[2],
			}}
		>
			{children}
		</Caption>
	);
}

function InfoRow({
	label,
	value,
	last,
}: {
	label: string;
	value?: string | null;
	last?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				gap: spacing[4],
				paddingBottom: last ? 0 : spacing[2],
				marginBottom: last ? 0 : spacing[2],
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: colors.border.light,
			}}
		>
			<Caption color="tertiary">{label}</Caption>
			<Caption
				weight="medium"
				color={value ? "primary" : "quaternary"}
				style={{ flex: 1, textAlign: "right" }}
			>
				{value || "—"}
			</Caption>
		</View>
	);
}
