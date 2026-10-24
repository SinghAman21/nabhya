import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { OrgActivityTimeline } from "@/components/admin/activity-timeline";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { OrgPostsSection } from "@/components/admin/org-posts-section";
import {
	DangerButton,
	DecisionBar,
	FactGroup,
	ReasonStep,
	Section,
} from "@/components/admin/sheet-parts";
import {
	Banner,
	ErrorState,
	LoadingState,
	Surface,
} from "@/components/screen-shell";
import {
	eventStatusTone,
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption } from "@/components/ui/typography";
import {
	useAdminOrganization,
	useReviewOrganization,
	useSetOrganizationStatus,
} from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

/**
 * Full NGO dossier with the moderation actions attached.
 *
 * Read top to bottom the way a reviewer works: state, then the facts they
 * check against the documents, then the documents themselves - straight after
 * the facts, since they are what the panel is opened for (they used to come
 * last, below the timeline and every post) - then the history. The decision is
 * always in the same order (approve, under review, reject, suspend) so the
 * hand learns where each button is.
 *
 * **A `Drawer`, not a `Sheet`, and `xl`.** Opening an NGO is not leaving the
 * list - the reviewer is working *down* a filtered directory, and the row they
 * came from, plus the ten after it, stay visible on the left while they decide.
 * A centred dialog covers exactly that. 720 rather than the drawer's usual 520
 * because a dossier is fact tables and document cards, not a column of short
 * fields: at 520 the fact rows wrap and each document stacks its own two
 * buttons. On a phone `Drawer` *is* a `Sheet`, so nothing changes there.
 *
 * **The decision lives in the pinned footer.** It used to be four full-width
 * buttons at the bottom of the scroll, which meant the action was only
 * reachable after scrolling past every fact - and a stack of four 100%-wide
 * buttons reads as a menu, not a decision. Pinned, sized to their labels, and
 * in a row, they are always there and the primary one is obvious.
 *
 * **A reason is asked for when it is needed, where the press happened.**
 * Reject, Suspend and Delete turn the footer into a `ReasonStep`. The reason used to be
 * a field at the end of the body, so pressing Reject with it empty put an
 * error on a field below the fold and the button looked dead.
 */
export function OrgDetailSheet({
	organizationId,
	onClose,
	onOpenOwner,
	onNext,
}: {
	organizationId: string | null;
	onClose: () => void;
	/**
	 * Opens the owner's own account. The caller closes this drawer first and
	 * opens the user one - sequentially, never nested: a drawer inside a drawer
	 * is a `Modal` inside a `Modal`, and the inner one's `OverlayHost` would end
	 * up fighting the outer one's for every toast.
	 */
	onOpenOwner?: (userId: string) => void;
	/**
	 * Opens the row after this one in the list the drawer was opened from, or
	 * is absent on the last row. A reviewer works *down* a filtered directory,
	 * and closing the drawer, finding the next row and opening it again is three
	 * moves per NGO. With this, a verification decision moves straight on to the
	 * next NGO - the decided one usually leaves the "Awaiting" filter anyway -
	 * and "Next" skips one without deciding. Suspension does not advance: it is
	 * not part of working the queue, and the reviewer will want to see the
	 * result.
	 */
	onNext?: () => void;
}) {
	const { spacing } = useTheme();
	const router = useRouter();
	// Which reason-needing decision the footer is asking about, if any.
	const [step, setStep] = useState<"REJECT" | "SUSPEND" | "DELETE" | null>(
		null,
	);

	const query = useAdminOrganization(organizationId ?? undefined);
	const review = useReviewOrganization();
	const setStatus = useSetOrganizationStatus();

	const org = query.data;
	const busy = review.isPending || setStatus.isPending;
	const suspended = org?.status === "SUSPENDED";
	const deleted = org?.status === "DELETED";

	const close = () => {
		setStep(null);
		onClose();
	};

	const DECIDED: Record<"UNDER_REVIEW" | "VERIFIED" | "REJECTED", string> = {
		VERIFIED: "Organization verified.",
		UNDER_REVIEW: "Marked under review.",
		REJECTED: "Organization rejected. They have been told why.",
	};

	const decide = (
		verificationStatus: "UNDER_REVIEW" | "VERIFIED" | "REJECTED",
		reason?: string,
	) => {
		if (!organizationId) return;
		review.mutate(
			{
				id: organizationId,
				input: { verificationStatus, ...(reason ? { reason } : {}) },
			},
			{
				onSuccess: () => {
					setStep(null);
					toast.success(DECIDED[verificationStatus]);
					onNext?.();
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const suspend = (reason: string) => {
		if (!organizationId) return;
		setStatus.mutate(
			{ id: organizationId, input: { status: "SUSPENDED", reason } },
			{
				onSuccess: () => {
					setStep(null);
					toast.success("Organization suspended.");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const remove = (reason: string) => {
		if (!organizationId) return;
		setStatus.mutate(
			{ id: organizationId, input: { status: "DELETED", reason } },
			{
				onSuccess: () => {
					setStep(null);
					toast.success(
						"Organization deleted. Donations and certificates were retained.",
					);
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const reinstate = async () => {
		if (!organizationId) return;
		const ok = await confirm({
			title: deleted ? "Restore organization?" : "Reinstate organization?",
			message: deleted
				? "It reappears in the directory and its team can sign in to it again. Cancelled events stay cancelled - the NGO republishes what it wants."
				: "They will be able to publish again.",
			confirmLabel: deleted ? "Restore" : "Reinstate",
		});
		if (!ok) return;
		setStatus.mutate(
			{ id: organizationId, input: { status: "ACTIVE" } },
			{
				onSuccess: () =>
					toast.success(
						deleted ? "Organization restored." : "Organization reinstated.",
					),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	return (
		<Drawer
			visible={!!organizationId}
			onClose={close}
			xl
			title={org?.organizationName ?? "Organization"}
			subtitle={
				org?.registrationNumber
					? `Reg. ${org.registrationNumber}`
					: (org?.email ?? undefined)
			}
			footer={
				org && step === "REJECT" ? (
					<ReasonStep
						title={`Why reject ${org.organizationName}?`}
						consequence="The organization reads this and can fix what's wrong and resubmit."
						placeholder="e.g. The registration certificate is cut off on page 2"
						confirmLabel="Reject"
						pending={review.isPending}
						onCancel={() => setStep(null)}
						onConfirm={(reason) => decide("REJECTED", reason)}
					/>
				) : org && step === "SUSPEND" ? (
					<ReasonStep
						title={`Why suspend ${org.organizationName}?`}
						consequence="Their published events are cancelled and open needs closed; volunteers who applied are notified. The reason is recorded in the audit log."
						placeholder="e.g. Reported for collecting fees from volunteers"
						confirmLabel="Suspend"
						pending={setStatus.isPending}
						onCancel={() => setStep(null)}
						onConfirm={suspend}
					/>
				) : org && step === "DELETE" ? (
					<ReasonStep
						title={`Why delete ${org.organizationName}?`}
						consequence="It disappears from every public page, its live events are cancelled and open needs closed, and pending team invites are revoked. Donations, certificates and the audit trail are kept, and you can restore it later."
						placeholder="e.g. Registration found to be fraudulent"
						confirmLabel="Delete organization"
						pending={setStatus.isPending}
						onCancel={() => setStep(null)}
						onConfirm={remove}
					/>
				) : org && deleted ? (
					// A deleted NGO has no verification decision to make - restoring
					// it is the only action, and it must not sit beside "Approve".
					<DecisionBar>
						<Button
							variant="outline"
							onPress={reinstate}
							loading={setStatus.isPending}
						>
							Restore organization
						</Button>
					</DecisionBar>
				) : org ? (
					<DecisionBar>
						{org.verificationStatus !== "VERIFIED" && (
							<Button
								onPress={() => decide("VERIFIED")}
								disabled={busy}
								loading={
									review.isPending &&
									review.variables?.input.verificationStatus === "VERIFIED"
								}
							>
								{onNext ? "Approve & next" : "Approve"}
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
								onPress={() => setStep("REJECT")}
								disabled={busy}
								loading={
									review.isPending &&
									review.variables?.input.verificationStatus === "REJECTED"
								}
							>
								Reject
							</Button>
						)}
						{onNext && (
							<Button
								variant="ghost"
								onPress={onNext}
								disabled={busy}
								accessibilityLabel="Skip to the next organization"
							>
								Next
							</Button>
						)}
						{/* Suspension sits apart, at the far end: it is the one action
						    here that is not part of the verification decision, and a
						    destructive button beside "Approve" invites the wrong tap. */}
						{/* Neither is a fill: "Approve" is this footer's one primary,
						    and two red fills beside it shouted louder than the
						    decision the drawer is open for. Delete, the rarer act, is
						    the quietest; both still ask for a reason first. */}
						<View style={{ flexGrow: 1 }} />
						<DangerButton
							tone="text"
							onPress={() => setStep("DELETE")}
							disabled={busy}
						>
							Delete
						</DangerButton>
						{suspended ? (
							<Button
								variant="outline"
								onPress={reinstate}
								disabled={busy}
								loading={setStatus.isPending}
							>
								Reinstate
							</Button>
						) : (
							<DangerButton
								onPress={() => setStep("SUSPEND")}
								disabled={busy}
								loading={setStatus.isPending}
							>
								Suspend
							</DangerButton>
						)}
					</DecisionBar>
				) : undefined
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
						{deleted && <StatusPill label="Deleted" tone="error" />}
					</View>

					{org.statusReason && (suspended || deleted) && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner
								tone="error"
								title={
									deleted && org.deletedAt
										? `Deleted ${formatDate(org.deletedAt)}`
										: suspended
											? "Suspended"
											: "Deleted"
								}
								description={org.statusReason}
							/>
						</View>
					)}

					{org.rejectionReason && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner
								tone="error"
								title="Rejected"
								description={org.rejectionReason}
							/>
						</View>
					)}

					<View style={{ marginBottom: spacing[5], alignItems: "flex-start" }}>
						{/* Closes first: the ledger is a page, and a drawer left open
						    over it would cover the rows it was opened to show. */}
						<TextAction
							label="Donations to this NGO →"
							tone="brand"
							onPress={() => {
								close();
								router.push(`/(admin)/finance?org=${org.id}` as Href);
							}}
							accessibilityLabel={`Open the donation ledger for ${org.organizationName}`}
						/>
					</View>

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

					{/* The one route to an NGO's *account*, as opposed to its
					    organisation: `(admin)/volunteers` is volunteers only, so this
					    is where suspending an NGO's login lives - which is the right
					    place for it anyway, since you have just read the record. */}
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
						{onOpenOwner && (
							<View style={{ marginTop: spacing[2] }}>
								<TextAction
									label="Manage this account →"
									tone="brand"
									onPress={() => onOpenOwner(org.owner.id)}
									accessibilityLabel={`Manage the account of ${
										org.owner.fullName ?? org.owner.email
									}`}
								/>
							</View>
						)}
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

					<Section title="Timeline">
						{organizationId ? (
							<OrgActivityTimeline organizationId={organizationId} />
						) : null}
					</Section>

					<Section title="Posts">
						{organizationId ? (
							<OrgPostsSection organizationId={organizationId} />
						) : null}
					</Section>
				</>
			)}
		</Drawer>
	);
}
