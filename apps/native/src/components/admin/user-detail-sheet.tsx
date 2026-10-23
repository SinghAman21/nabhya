import { USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { UserActivityTimeline } from "@/components/admin/activity-timeline";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { FactGroup, ReasonStep, Section } from "@/components/admin/sheet-parts";
import {
	Banner,
	ErrorState,
	LoadingState,
	MetricRow,
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
import { Drawer } from "@/components/ui/drawer";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminUser, useSetUserStatus } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Per-user dossier. State first, then the identity documents - the thing a
 * reviewer most often opens this for - then the participation record that tells
 * them whether this is a real volunteer, then the one decision.
 *
 * A `Drawer` with `xl`, and the decision pinned in the footer, for the same
 * reasons as the NGO dossier - see the note at the top of
 * `org-detail-sheet.tsx`. The short version: the reviewer is working down a
 * filtered list and it should stay visible; and an action reachable only after
 * scrolling past a participation history is an action nobody reaches.
 */
export function UserDetailSheet({
	userId,
	onClose,
}: {
	userId: string | null;
	onClose: () => void;
}) {
	const { spacing } = useTheme();
	// The footer's "why?" step for a suspension - see `ReasonStep`.
	const [asking, setAsking] = useState<"suspend" | "delete" | null>(null);

	const query = useAdminUser(userId ?? undefined);
	const setStatus = useSetUserStatus();

	const user = query.data;
	const suspended = user?.status === "SUSPENDED";
	const deleted = user?.status === "DELETED";

	const close = () => {
		setAsking(null);
		onClose();
	};

	const suspend = (reason: string) => {
		if (!userId) return;
		setStatus.mutate(
			{ id: userId, input: { status: "SUSPENDED", reason } },
			{
				onSuccess: () => {
					setAsking(null);
					toast.success("Account suspended.");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const reinstate = async () => {
		if (!userId) return;
		const ok = await confirm({
			title: "Reinstate account?",
			message: "They will regain access immediately.",
			confirmLabel: "Reinstate",
		});
		if (!ok) return;
		setStatus.mutate(
			{ id: userId, input: { status: "ACTIVE" } },
			{
				onSuccess: () => toast.success("Account reinstated."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const restore = async () => {
		if (!userId) return;
		const ok = await confirm({
			title: "Restore account?",
			message: "They will regain access immediately.",
			confirmLabel: "Restore",
		});
		if (!ok) return;
		setStatus.mutate(
			{ id: userId, input: { status: "ACTIVE" } },
			{
				onSuccess: () => toast.success("Account restored."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const deleteAccount = (reason: string) => {
		if (!userId) return;
		setStatus.mutate(
			{ id: userId, input: { status: "DELETED", reason } },
			{
				onSuccess: () => {
					setAsking(null);
					toast.success("Account deleted. Its records were retained.");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<Drawer
			visible={!!userId}
			onClose={close}
			xl
			title={user?.fullName ?? "Account"}
			subtitle={user?.email}
			footer={
				user && asking ? (
					<ReasonStep
						title={`Why ${asking} ${user.fullName ?? user.email}?`}
						consequence={
							asking === "delete"
								? "They will be signed out and blocked from the app. Their records are retained, and the reason is recorded in the audit log."
								: "They are signed out and blocked from the app until reinstated. The reason is recorded in the audit log."
						}
						placeholder={
							asking === "delete"
								? "Reason for deleting this account"
								: "e.g. Repeated no-shows reported by three NGOs"
						}
						confirmLabel={asking === "delete" ? "Delete account" : "Suspend"}
						pending={setStatus.isPending}
						onCancel={() => setAsking(null)}
						onConfirm={asking === "delete" ? deleteAccount : suspend}
					/>
				) : user ? (
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
					>
						{deleted ? (
							<Button
								variant="outline"
								onPress={restore}
								loading={setStatus.isPending}
							>
								Restore account
							</Button>
						) : (
							<>
								<Button
									variant={suspended ? "outline" : "destructive"}
									onPress={suspended ? reinstate : () => setAsking("suspend")}
									loading={setStatus.isPending}
								>
									{suspended ? "Reinstate account" : "Suspend account"}
								</Button>
								<Button
									variant="destructive"
									onPress={() => setAsking("delete")}
									loading={setStatus.isPending}
								>
									Delete account
								</Button>
							</>
						)}
					</View>
				) : undefined
			}
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
						{deleted && <StatusPill label="Deleted" tone="error" />}
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

					<Section title="Timeline">
						{userId ? <UserActivityTimeline userId={userId} /> : null}
					</Section>
				</>
			)}
		</Drawer>
	);
}
