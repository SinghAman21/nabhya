import { USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { ErrorState, LoadingState, Surface } from "@/components/screen-shell";
import {
	applicationTone,
	humanizeStatus,
	pledgeTone,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, H3, Label } from "@/components/ui/typography";
import { useAdminUser, useSetUserStatus } from "@/hooks/use-admin";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Per-user dossier. The participation lists are the point of this screen —
 * which events they applied to, what the outcome was, and what they pledged.
 */
export function UserDetailSheet({
	userId,
	onClose,
}: {
	userId: string | null;
	onClose: () => void;
}) {
	const { colors, spacing } = useTheme();
	const [reason, setReason] = useState("");

	const query = useAdminUser(userId ?? undefined);
	const setStatus = useSetUserStatus();
	const _openDocument = useOpenDocument();

	const user = query.data;

	const close = () => {
		setReason("");
		onClose();
	};

	const toggleSuspension = () => {
		if (!userId || !user) return;
		const suspending = user.status !== "SUSPENDED";

		if (suspending && !reason.trim()) {
			Alert.alert(
				"Reason required",
				"Add a reason before suspending this user.",
			);
			return;
		}

		Alert.alert(
			suspending ? "Suspend user" : "Reinstate user",
			suspending
				? "They will be signed out and blocked from the app until reinstated."
				: "They will regain access immediately.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: suspending ? "Suspend" : "Reinstate",
					style: suspending ? "destructive" : "default",
					onPress: () =>
						setStatus.mutate(
							{
								id: userId,
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
			visible={!!userId}
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
						{user?.fullName ?? "Volunteer"}
					</H2>
					<Pressable onPress={close} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				{query.isLoading ? (
					<LoadingState />
				) : query.isError || !user ? (
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
								flexWrap: "wrap",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							{user.roles.map((role) => (
								<StatusPill
									key={role}
									label={humanizeStatus(role)}
									tone="info"
								/>
							))}
							<StatusPill
								label={`ID ${humanizeStatus(user.verificationStatus).toLowerCase()}`}
								tone={verificationTone(user.verificationStatus)}
							/>
							{user.status === "SUSPENDED" && (
								<StatusPill label="Suspended" tone="error" />
							)}
						</View>

						{user.suspendedReason && (
							<Surface
								style={{
									marginBottom: spacing[5],
									backgroundColor: colors.error.bg,
									borderColor: colors.error.border,
								}}
							>
								<Caption weight="bold" color={colors.error.main as string}>
									Suspension reason
								</Caption>
								<Caption color="secondary">{user.suspendedReason}</Caption>
							</Surface>
						)}

						<View
							style={{
								flexDirection: "row",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							<StatCell label="Applications" value={user.stats.applications} />
							<StatCell label="Accepted" value={user.stats.accepted} />
							<StatCell label="Pledges" value={user.stats.pledges} />
						</View>

						<SectionTitle>Contact</SectionTitle>
						<Surface style={{ marginBottom: spacing[5] }}>
							<InfoRow label="Email" value={user.email} />
							<InfoRow label="Phone" value={user.phone} />
							<InfoRow
								label="Location"
								value={[user.city, user.state].filter(Boolean).join(", ")}
							/>
							<InfoRow label="Joined" value={formatDate(user.createdAt)} />
							<InfoRow
								label="Onboarded"
								value={
									user.onboardedAt
										? formatDate(user.onboardedAt)
										: "Not finished"
								}
								last
							/>
						</Surface>

						{user.organization && (
							<>
								<SectionTitle>Owns organization</SectionTitle>
								<Surface style={{ marginBottom: spacing[5] }}>
									<Body weight="bold">
										{user.organization.organizationName}
									</Body>
									<View style={{ flexDirection: "row", marginTop: spacing[2] }}>
										<StatusPill
											label={humanizeStatus(
												user.organization.verificationStatus,
											)}
											tone={verificationTone(
												user.organization.verificationStatus,
											)}
										/>
									</View>
								</Surface>
							</>
						)}

						<SectionTitle>Identity documents</SectionTitle>
						<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
							{user.documents.length === 0 ? (
								<Surface>
									<Caption color="tertiary">No documents submitted.</Caption>
								</Surface>
							) : (
								user.documents.map((document) => (
									<DocumentReviewRow
										key={document.id}
										document={document}
										kind="user"
										label={
											USER_DOCUMENT_LABELS[document.documentType] ??
											humanizeStatus(document.documentType)
										}
									/>
								))
							)}
						</View>

						<SectionTitle>Event participation</SectionTitle>
						<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
							{user.applications.length === 0 ? (
								<Surface>
									<Caption color="tertiary">
										Hasn't applied to any events yet.
									</Caption>
								</Surface>
							) : (
								user.applications.map((application) => (
									<Surface key={application.id}>
										<View
											style={{
												flexDirection: "row",
												alignItems: "center",
												justifyContent: "space-between",
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
								))
							)}
						</View>

						<SectionTitle>Pledges</SectionTitle>
						<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
							{user.pledges.length === 0 ? (
								<Surface>
									<Caption color="tertiary">No pledges yet.</Caption>
								</Surface>
							) : (
								user.pledges.map((pledge) => (
									<Surface key={pledge.id}>
										<View
											style={{
												flexDirection: "row",
												alignItems: "center",
												justifyContent: "space-between",
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
								))
							)}
						</View>

						<SectionTitle>Moderation</SectionTitle>
						<Label style={{ marginBottom: spacing[1.5] }}>
							Reason <Caption color="tertiary">(required to suspend)</Caption>
						</Label>
						<Input
							placeholder="Why is this account being actioned?"
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
						<Button
							variant={user.status === "SUSPENDED" ? "outline" : "destructive"}
							onPress={toggleSuspension}
							loading={setStatus.isPending}
						>
							{user.status === "SUSPENDED" ? "Reinstate user" : "Suspend user"}
						</Button>
					</ScrollView>
				)}
			</View>
		</Modal>
	);
}

function StatCell({ label, value }: { label: string; value: number }) {
	return (
		<Surface style={{ flex: 1 }}>
			<H3>{value}</H3>
			<Caption color="tertiary">{label}</Caption>
		</Surface>
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
