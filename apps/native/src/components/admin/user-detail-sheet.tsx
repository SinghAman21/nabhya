import { USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { FactGroup, ReasonField } from "@/components/admin/sheet-parts";
import {
	Banner,
	ErrorState,
	LoadingState,
	MetricRow,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	pledgeTone,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { confirm, toast } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/sheet";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminUser, useSetUserStatus } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Per-user dossier. State first, then the identity documents — the thing a
 * reviewer most often opens this for — then the participation record that
 * tells them whether this is a real volunteer, then the one decision.
 */
export function UserDetailSheet({
	userId,
	onClose,
}: {
	userId: string | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	const [reason, setReason] = useState("");
	const [reasonError, setReasonError] = useState<string | null>(null);

	const query = useAdminUser(userId ?? undefined);
	const setStatus = useSetUserStatus();

	const user = query.data;
	const suspended = user?.status === "SUSPENDED";

	const close = () => {
		setReason("");
		setReasonError(null);
		onClose();
	};

	const changeReason = (text: string) => {
		setReason(text);
		if (reasonError && text.trim()) setReasonError(null);
	};

	const toggleSuspension = async () => {
		if (!userId || !user) return;
		const suspending = user.status !== "SUSPENDED";
		const text = reason.trim();

		if (suspending && !text) {
			setReasonError("Add a reason before suspending this account.");
			return;
		}
		setReasonError(null);

		const ok = await confirm({
			title: suspending ? "Suspend account?" : "Reinstate account?",
			message: suspending
				? "They will be signed out and blocked from the app until reinstated."
				: "They will regain access immediately.",
			confirmLabel: suspending ? "Suspend" : "Reinstate",
			destructive: suspending,
		});
		if (!ok) return;
		setStatus.mutate(
			{
				id: userId,
				input: {
					status: suspending ? "SUSPENDED" : "ACTIVE",
					reason: text || undefined,
				},
			},
			{
				onSuccess: () => {
					setReason("");
					toast.success(
						suspending ? "Account suspended." : "Account reinstated.",
					);
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<Sheet
			visible={!!userId}
			onClose={close}
			title={user?.fullName ?? "Account"}
			subtitle={user?.email}
		>
			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !user ? (
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
						{user.roles.map((role) => (
							<StatusPill key={role} label={humanizeStatus(role)} tone="info" />
						))}
						<StatusPill
							label={`ID ${humanizeStatus(user.verificationStatus).toLowerCase()}`}
							tone={verificationTone(user.verificationStatus)}
						/>
						{suspended && <StatusPill label="Suspended" tone="error" />}
					</View>

					{user.suspendedReason && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner
								tone="error"
								title="Suspended"
								description={user.suspendedReason}
							/>
						</View>
					)}

					<View style={{ marginBottom: spacing[5] }}>
						<MetricRow
							stats={[
								{ label: "Applications", value: user.stats.applications },
								{ label: "Accepted", value: user.stats.accepted },
								{ label: "Pledges", value: user.stats.pledges },
							]}
						/>
					</View>

					<Section title="Contact">
						<FactGroup
							facts={[
								{ label: "Email", value: user.email },
								{ label: "Phone", value: user.phone },
								{
									label: "Location",
									value: [user.city, user.state].filter(Boolean).join(", "),
								},
								{ label: "Joined", value: formatDate(user.createdAt) },
								{
									label: "Onboarded",
									value: user.onboardedAt
										? formatDate(user.onboardedAt)
										: "Not finished",
								},
							]}
						/>
					</Section>

					{user.organization && (
						<Section title="Owns organization">
							<Surface>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[2],
									}}
								>
									<Body weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
										{user.organization.organizationName}
									</Body>
									<StatusPill
										label={humanizeStatus(user.organization.verificationStatus)}
										tone={verificationTone(
											user.organization.verificationStatus,
										)}
									/>
								</View>
							</Surface>
						</Section>
					)}

					<Section
						title={`Identity documents${user.documents.length ? ` (${user.documents.length})` : ""}`}
					>
						{user.documents.length === 0 ? (
							<Surface>
								<Caption color="tertiary">No documents submitted.</Caption>
							</Surface>
						) : (
							<View style={{ gap: spacing[2] }}>
								{user.documents.map((document) => (
									<DocumentReviewRow
										key={document.id}
										document={document}
										kind="user"
										label={
											USER_DOCUMENT_LABELS[document.documentType] ??
											humanizeStatus(document.documentType)
										}
									/>
								))}
							</View>
						)}
					</Section>

					<Section title="Event participation">
						{user.applications.length === 0 ? (
							<Surface>
								<Caption color="tertiary">
									Hasn't applied to any events yet.
								</Caption>
							</Surface>
						) : (
							<View style={{ gap: spacing[2] }}>
								{user.applications.map((application) => (
									<Surface key={application.id}>
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
												{application.event.title}
											</Body>
											<StatusPill
												label={humanizeStatus(application.status)}
												tone={applicationTone(application.status)}
											/>
										</View>
										<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
											{application.organization.organizationName} ·{" "}
											{formatDate(application.event.startAt)}
										</Caption>
									</Surface>
								))}
							</View>
						)}
					</Section>

					<Section title="Pledges">
						{user.pledges.length === 0 ? (
							<Surface>
								<Caption color="tertiary">No pledges yet.</Caption>
							</Surface>
						) : (
							<View style={{ gap: spacing[2] }}>
								{user.pledges.map((pledge) => (
									<Surface key={pledge.id}>
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
												{pledge.need.title}
											</Body>
											<StatusPill
												label={humanizeStatus(pledge.status)}
												tone={pledgeTone(pledge.status)}
											/>
										</View>
										<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
											{pledge.organization.organizationName}
											{pledge.quantity
												? ` · ${pledge.quantity}${pledge.need.unit ? ` ${pledge.need.unit}` : ""}`
												: ""}
										</Caption>
									</Surface>
								))}
							</View>
						)}
					</Section>

					<SectionTitle>Decision</SectionTitle>
					<ReasonField
						value={reason}
						onChangeText={changeReason}
						placeholder="Why is this account being actioned?"
						requiredFor="suspend"
						error={reasonError}
					/>
					<View style={{ paddingBottom: spacing[2] }}>
						<Button
							variant={suspended ? "outline" : "destructive"}
							onPress={toggleSuspension}
							loading={setStatus.isPending}
						>
							{suspended ? "Reinstate account" : "Suspend account"}
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
