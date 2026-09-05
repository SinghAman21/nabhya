import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { RefreshControl, ScrollView, View } from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
} from "@/components/screen-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Caption } from "@/components/ui/typography";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

type DocType = UploadOrgDocumentInput["documentType"];

const REQUIRED: Array<{ type: DocType; hint: string }> = [
	{
		type: "NGO_REGISTRATION_CERTIFICATE",
		hint: "Trust deed, society registration or Section 8 incorporation certificate.",
	},
	{
		type: "PAN_CARD",
		hint: "The organisation's PAN card, not a trustee's.",
	},
];

const OPTIONAL: Array<{ type: DocType; hint: string }> = [
	{
		type: "80G_CERTIFICATE",
		hint: "Lets donors claim tax relief. Shown as a badge on your profile.",
	},
	{
		type: "12A_CERTIFICATE",
		hint: "Income-tax registration for the trust. Speeds up review.",
	},
];

const STEPS = ["Documents", "Review", "Verified"];

/**
 * Verification, as a three-step journey the NGO can see itself on: upload the
 * required documents, wait for review, become verified. The step indicator is
 * derived from the organisation's status and the document set, so it moves on
 * its own as the reviewer works.
 */
export default function NgoVerification() {
	const { colors, spacing } = useTheme();

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();

	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);
	const requiredUploaded = REQUIRED.filter((d) => byType.has(d.type)).length;
	const allRequired = requiredUploaded === REQUIRED.length;
	const rejected = (documents.data ?? []).filter(
		(doc) => doc.verificationStatus === "REJECTED",
	);

	const status = org.data?.verificationStatus;
	const isVerified = status === "VERIFIED";
	const currentStep = isVerified ? 2 : allRequired ? 1 : 0;

	const handleUploaded = (documentType: DocType, key: string) => {
		upload.mutate({ documentType, documentKey: key });
	};

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
			description={
				org.data?.rejectionReason ??
				"A reviewer left notes on the documents below. Upload a corrected copy of each to reopen review."
			}
		/>
	) : allRequired ? (
		<Banner
			tone="info"
			title="Under review"
			description="A reviewer is checking your documents — usually a few days. You'll be notified either way. Adding the optional documents below can speed things up."
		/>
	) : (
		<Banner
			tone="warning"
			title={`${requiredUploaded} of ${REQUIRED.length} required documents uploaded`}
			description="Review starts as soon as both are in. Until you're verified, events and needs stay private."
		/>
	);

	const isSaving = (type: DocType) =>
		upload.isPending && upload.variables?.documentType === type;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Verification"
				subtitle="Reviewed by the Nabhya team"
			/>

			{documents.isLoading || org.isLoading ? (
				<LoadingState />
			) : documents.isError ? (
				<ErrorState
					message={apiErrorMessage(documents.error)}
					onRetry={() => documents.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={documents.isRefetching || org.isRefetching}
							onRefresh={() => {
								documents.refetch();
								org.refetch();
							}}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					{/* StepIndicator carries its own gutters and top padding; pull it
					    back into the screen's gutters so it lines up with the cards. */}
					<View
						style={{ marginHorizontal: -spacing[6], marginTop: -spacing[6] }}
					>
						<StepIndicator steps={STEPS} currentStep={currentStep} />
					</View>

					<View style={{ marginBottom: spacing[6] }}>{banner}</View>

					{upload.isError && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner
								tone="error"
								title="Could not attach the document"
								description={apiErrorMessage(upload.error)}
							/>
						</View>
					)}

					<SectionTitle>Required</SectionTitle>
					<View style={{ gap: spacing[3], marginBottom: spacing[6] }}>
						{REQUIRED.map((doc) => (
							<DocumentUploadTile
								key={doc.type}
								title={ORG_DOCUMENT_LABELS[doc.type] ?? doc.type}
								hint={doc.hint}
								purpose="ORG_DOCUMENT"
								organizationDocumentType={doc.type}
								existing={byType.get(doc.type)}
								onUploaded={(key) => handleUploaded(doc.type, key)}
								saving={isSaving(doc.type)}
								required
							/>
						))}
					</View>

					<SectionTitle>Optional</SectionTitle>
					<View style={{ gap: spacing[3] }}>
						{OPTIONAL.map((doc) => (
							<DocumentUploadTile
								key={doc.type}
								title={ORG_DOCUMENT_LABELS[doc.type] ?? doc.type}
								hint={doc.hint}
								purpose="ORG_DOCUMENT"
								organizationDocumentType={doc.type}
								existing={byType.get(doc.type)}
								onUploaded={(key) => handleUploaded(doc.type, key)}
								saving={isSaving(doc.type)}
								required={false}
							/>
						))}
					</View>

					<Caption color="quaternary" style={{ marginTop: spacing[6] }}>
						Documents are private to you and the reviewer. They are never shown
						on your public profile.
					</Caption>
				</ScrollView>
			)}
		</Screen>
	);
}
