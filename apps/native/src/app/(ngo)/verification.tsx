import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { ShieldCheck } from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import {
	ErrorState,
	LoadingState,
	Screen,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption } from "@/components/ui/typography";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

const REQUIRED_DOCS: UploadOrgDocumentInput["documentType"][] = [
	"NGO_REGISTRATION_CERTIFICATE",
	"PAN_CARD",
	"80G_CERTIFICATE",
	"12A_CERTIFICATE",
];

const DOC_HINTS: Record<string, string> = {
	NGO_REGISTRATION_CERTIFICATE:
		"Official registration document from the relevant authority",
	PAN_CARD: "Organization PAN card",
	"80G_CERTIFICATE": "80G tax exemption certificate (if applicable)",
	"12A_CERTIFICATE": "12A trust registration certificate (if applicable)",
};

export default function NgoVerification() {
	const { colors, spacing } = useTheme();

	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();

	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);
	const uploadedCount = REQUIRED_DOCS.filter((d) => byType.has(d)).length;
	const allDone = uploadedCount === REQUIRED_DOCS.length;

	const handleUploaded = (documentType: string, key: string) => {
		upload.mutate({
			documentType: documentType as UploadOrgDocumentInput["documentType"],
			documentKey: key,
		});
	};

	return (
		<Screen>
			<BackButton />
			<Body weight="bold" style={{ fontSize: 22, marginBottom: spacing[1] }}>
				Verification
			</Body>
			<Caption
				color="tertiary"
				style={{ marginBottom: spacing[5], lineHeight: 20 }}
			>
				Submit the documents below for verification. NGOs must upload at least
				their registration certificate and PAN card to be eligible for
				verification.
			</Caption>

			{/* ── Progress summary ─────────────────────────────────────── */}
			<Surface style={{ marginBottom: spacing[5] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<View
						style={{
							width: 44,
							height: 44,
							borderRadius: 12,
							backgroundColor: allDone
								? `${colors.success.main}15`
								: `${colors.primary.main}12`,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<ShieldCheck
							size={22}
							color={
								(allDone ? colors.success.main : colors.primary.main) as string
							}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="semibold">
							{allDone
								? "All documents submitted"
								: `${uploadedCount} of ${REQUIRED_DOCS.length} uploaded`}
						</Body>
						<Caption color="tertiary">
							{allDone
								? "Waiting for superadmin review"
								: "Some documents are still missing"}
						</Caption>
					</View>
				</View>
			</Surface>

			{documents.isLoading ? (
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
							refreshing={documents.isRefetching}
							onRefresh={() => documents.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					{REQUIRED_DOCS.map((docType) => (
						<DocumentUploadTile
							key={docType}
							title={ORG_DOCUMENT_LABELS[docType] ?? docType}
							hint={DOC_HINTS[docType]}
							purpose="ORG_DOCUMENT"
							existing={byType.get(docType)}
							onUploaded={async (key) => handleUploaded(docType, key)}
							saving={upload.isPending}
						/>
					))}
				</ScrollView>
			)}
		</Screen>
	);
}
