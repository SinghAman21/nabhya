import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { Lock, ShieldCheck } from "lucide-react-native";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import {
	currentDocumentsByType,
	ORG_OPTIONAL_DOCUMENTS,
	ORG_REQUIRED_DOCUMENTS,
	ORG_VERIFICATION_STEPS,
	type OrgDocumentType,
	orgVerificationStep,
} from "@/lib/org-verification";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * Verification, as a three-stage journey the NGO can see itself on.
 *
 * ## Layout
 *
 * Desktop is two columns. The wide one is the work - the stage rail, where you
 * stand, and the upload slots. The narrow one is the reassurance: what a
 * reviewer is checking, how long it takes, and that none of it is ever public.
 * That copy used to be a single grey sentence at the very bottom, below eight
 * upload tiles, which is the one place a worried person will not look.
 *
 * The upload slots pair up two-across on desktop. Each is a card, and a column
 * of four full-width cards on a 1000pt page is a lot of scrolling for four
 * files.
 *
 * The stage rail sits inside a `Surface` via `StepIndicator embedded`. It used
 * to be the wizard variant, dragged into place with
 * `marginHorizontal: -spacing[6]` to cancel gutters and a safe-area inset it
 * had no business applying on a pushed page that already has a header.
 *
 * ## Where the document set is defined
 *
 * `lib/org-verification.ts`, not here - the profile's Verification tab reports
 * on the same four slots and the same three stages, and two screens disagreeing
 * about which one you are on is worse than neither showing it.
 */

/** Wide enough for two upload cards side by side, and no wider. */
const PAGE: ViewStyle = {
	width: "100%",
	maxWidth: 1080,
	alignSelf: "center",
};

const MAIN_COLUMN = 2;
const ASIDE_COLUMN = 1;

export default function NgoVerification() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();
	const access = useOrgAccess();
	// Uploading is `org.edit` server-side: owners, admins and managers.
	const uploadBlocked = access.blocked("org.edit");

	const byType = currentDocumentsByType(documents.data);
	const requiredUploaded = ORG_REQUIRED_DOCUMENTS.filter((d) =>
		byType.has(d.type),
	).length;
	const allRequired = requiredUploaded === ORG_REQUIRED_DOCUMENTS.length;
	// Only a document that still stands can need another look - a rejected
	// copy that has since been replaced is history, not a to-do.
	const rejected = [...byType.values()].filter(
		(doc) => doc.verificationStatus === "REJECTED",
	);
	const requiredCount = ORG_REQUIRED_DOCUMENTS.length;

	const status = org.data?.verificationStatus;
	const isVerified = status === "VERIFIED";
	const currentStep = orgVerificationStep(status, requiredUploaded);

	const handleUploaded = (documentType: OrgDocumentType, key: string) =>
		upload.mutate({ documentType, documentKey: key });

	const isSaving = (type: OrgDocumentType) =>
		upload.isPending && upload.variables?.documentType === type;

	const banner = isVerified ? (
		<Banner
			tone="success"
			title="Your NGO is verified"
			description="Events, needs and updates are public. Keep documents current if a reviewer asks for a newer copy."
		/>
	) : status === "REJECTED" || rejected.length > 0 ? (
		<Banner
			tone="error"
			title="Verification needs another look"
			// The org-level reason survives the re-upload that reopens review, so
			// it is only still the answer while the org itself is REJECTED.
			description={
				(status === "REJECTED" ? org.data?.rejectionReason : null) ??
				"A reviewer left notes on the documents below. Upload a corrected copy of each to reopen review."
			}
		/>
	) : allRequired ? (
		<Banner
			tone="info"
			title="Under review"
			description="A reviewer is checking your documents - usually a few days. You'll get a notification either way. Adding the optional documents below can speed things up."
		/>
	) : (
		<Banner
			tone="warning"
			title={`${requiredUploaded} of ${requiredCount} required documents uploaded`}
			description={`Review starts as soon as ${requiredCount === 2 ? "both are" : "all are"} in. Until you're verified, events and needs stay private.`}
		/>
	);

	/**
	 * Two across on desktop, one per row on a phone. `flexBasis: "48%"` rather
	 * than `flex: 1` so a section with an odd number of slots leaves the last
	 * one at half width instead of stretching it across the row.
	 */
	const slots = (specs: typeof ORG_REQUIRED_DOCUMENTS) => (
		<View
			style={{
				flexDirection: isDesktop ? "row" : "column",
				flexWrap: "wrap",
				gap: spacing[3],
			}}
		>
			{specs.map((doc) => (
				<View
					key={doc.type}
					style={isDesktop ? { flexBasis: "48%", flexGrow: 1 } : undefined}
				>
					<DocumentUploadTile
						title={ORG_DOCUMENT_LABELS[doc.type] ?? doc.type}
						hint={doc.hint}
						purpose="ORG_DOCUMENT"
						existing={byType.get(doc.type)}
						onUploaded={(key) => handleUploaded(doc.type, key)}
						saving={isSaving(doc.type)}
						readOnly={!!uploadBlocked}
					/>
				</View>
			))}
		</View>
	);

	const stages = (
		<Surface>
			<StepIndicator
				steps={ORG_VERIFICATION_STEPS}
				currentStep={currentStep}
				embedded
			/>
		</Surface>
	);

	const main = (
		<View style={{ gap: spacing[6] }}>
			{stages}
			{banner}

			{uploadBlocked ? (
				<Banner tone="info" title="View only" description={uploadBlocked} />
			) : null}

			{upload.isError ? (
				<Banner
					tone="error"
					title="Could not attach the document"
					description={apiErrorMessage(upload.error)}
				/>
			) : null}

			<View>
				<SectionTitle>Required</SectionTitle>
				{slots(ORG_REQUIRED_DOCUMENTS)}
			</View>

			<View>
				<SectionTitle>Optional</SectionTitle>
				{slots(ORG_OPTIONAL_DOCUMENTS)}
			</View>
		</View>
	);

	/**
	 * The answers to the two questions an NGO actually has here - "what are they
	 * looking for?" and "who sees my PAN card?" - placed where they are read
	 * rather than in a footnote under the last upload slot.
	 */
	const aside = (
		<View style={{ gap: spacing[6] }}>
			<View>
				<SectionTitle>What a reviewer checks</SectionTitle>
				<Surface>
					<View style={{ gap: spacing[4] }}>
						<Note
							icon={ShieldCheck}
							title="That the organisation is real"
							body="The registration certificate is matched against the registration number on your profile, so the two need to agree."
						/>
						<Note
							icon={ShieldCheck}
							title="That the PAN belongs to the NGO"
							body="Not a trustee's or a founder's. A personal PAN is the most common reason a review is sent back."
						/>
						<Note
							icon={ShieldCheck}
							title="That the copy is readable"
							body="A photograph is fine if every line can be read. Corners cut off, glare across a seal, or a page missing all mean another round."
						/>
					</View>
				</Surface>
			</View>

			<Surface>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Lock
						size={18}
						strokeWidth={1.75}
						color={colors.text.tertiary as string}
					/>
					<View style={{ flex: 1, gap: spacing[1] }}>
						<Label>Private to you and the reviewer</Label>
						<Caption color="tertiary">
							These documents never appear on your public page, in the feed, or
							to a volunteer or donor. Verification shows as a badge; the paper
							behind it does not.
						</Caption>
					</View>
				</View>
			</Surface>

			<Surface>
				<View style={{ gap: spacing[1] }}>
					<Label>How long it takes</Label>
					<Caption color="tertiary">
						Usually a few days once the required documents are in. You get a
						notification either way - there is nothing to keep checking.
					</Caption>
				</View>
			</Surface>
		</View>
	);

	return (
		<Screen>
			<View style={PAGE}>
				<ScreenHeader
					back
					title="Verification"
					subtitle="Reviewed by the Nabhya team"
				/>
			</View>

			{documents.isLoading || org.isLoading ? (
				<LoadingState />
			) : documents.isError || org.isError ? (
				<ErrorState
					message={apiErrorMessage(documents.error ?? org.error)}
					onRetry={() => {
						documents.refetch();
						org.refetch();
					}}
				/>
			) : (
				<ScrollView
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						isDesktop ? undefined : (
							<RefreshControl
								refreshing={documents.isRefetching || org.isRefetching}
								onRefresh={() => {
									documents.refetch();
									org.refetch();
								}}
								tintColor={colors.text.quaternary as string}
							/>
						)
					}
				>
					<View style={PAGE}>
						{isDesktop ? (
							<View style={{ flexDirection: "row", gap: spacing[6] }}>
								<View style={{ flex: MAIN_COLUMN, minWidth: 0 }}>{main}</View>
								<View style={{ flex: ASIDE_COLUMN, minWidth: 0 }}>{aside}</View>
							</View>
						) : (
							<View style={{ gap: spacing[6] }}>
								{main}
								{aside}
							</View>
						)}
					</View>
				</ScrollView>
			)}
		</Screen>
	);
}

function Note({
	icon: Icon,
	title,
	body,
}: {
	icon: typeof ShieldCheck;
	title: string;
	body: string;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ flexDirection: "row", gap: spacing[3] }}>
			<Icon
				size={17}
				strokeWidth={1.75}
				color={colors.text.tertiary as string}
				style={{ marginTop: 2 }}
			/>
			<View style={{ flex: 1, gap: spacing[0.5] }}>
				<Body weight="medium">{title}</Body>
				<Caption color="tertiary">{body}</Caption>
			</View>
		</View>
	);
}
