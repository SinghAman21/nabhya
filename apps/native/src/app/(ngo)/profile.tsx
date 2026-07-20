import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import {
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption } from "@/components/ui/typography";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/** Document types the verification queue expects, in the order we ask for them. */
const REQUIRED_DOCUMENTS: Array<{
	type: UploadOrgDocumentInput["documentType"];
	hint: string;
}> = [
	{
		type: "NGO_REGISTRATION_CERTIFICATE",
		hint: "Trust / Society / Section 8 registration document",
	},
	{ type: "PAN_CARD", hint: "Organization PAN card" },
	{ type: "80G_CERTIFICATE", hint: "Optional — enables tax-deductible giving" },
	{ type: "12A_CERTIFICATE", hint: "Optional — tax exemption registration" },
];

export default function NgoProfile() {
	const { colors, spacing } = useTheme();
	const signOut = useAuthStore((s) => s.signOut);

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();

	const submit = (
		documentType: UploadOrgDocumentInput["documentType"],
		documentKey: string,
	) => {
		upload.mutate(
			{ documentType, documentKey },
			{
				onError: (error) =>
					Alert.alert("Could not save document", apiErrorMessage(error)),
			},
		);
	};

	// Latest submission per type — re-uploading supersedes rather than stacks.
	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<ScreenHeader
				title="Profile"
				subtitle="Your organization and its verification status."
			/>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError ? (
				<ErrorState
					message={apiErrorMessage(org.error)}
					onRetry={() => org.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={org.isRefetching}
							onRefresh={() => {
								org.refetch();
								documents.refetch();
							}}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					<Surface style={{ marginBottom: spacing[5] }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: spacing[3],
							}}
						>
							<Body weight="bold" style={{ flex: 1 }} numberOfLines={2}>
								{org.data?.organizationName}
							</Body>
							<StatusPill
								label={humanizeStatus(org.data?.verificationStatus)}
								tone={verificationTone(org.data?.verificationStatus)}
							/>
						</View>
						<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
							{[org.data?.city, org.data?.state].filter(Boolean).join(", ")}
						</Caption>

						{org.data?.rejectionReason && (
							<View
								style={{
									marginTop: spacing[3],
									padding: spacing[3],
									borderRadius: 12,
									backgroundColor: colors.error.bg,
								}}
							>
								<Caption weight="bold" color={colors.error.main as string}>
									Verification rejected
								</Caption>
								<Caption color="secondary">{org.data.rejectionReason}</Caption>
								<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
									Upload a corrected document below to re-open review.
								</Caption>
							</View>
						)}
					</Surface>

					<Caption
						weight="bold"
						color="tertiary"
						style={{
							letterSpacing: 1,
							textTransform: "uppercase",
							marginBottom: spacing[3],
						}}
					>
						Verification documents
					</Caption>

					{documents.isLoading ? (
						<LoadingState />
					) : (
						REQUIRED_DOCUMENTS.map((doc) => (
							<DocumentUploadTile
								key={doc.type}
								title={ORG_DOCUMENT_LABELS[doc.type] ?? doc.type}
								hint={doc.hint}
								purpose="ORG_DOCUMENT"
								existing={byType.get(doc.type)}
								saving={upload.isPending}
								onUploaded={(key) => submit(doc.type, key)}
							/>
						))
					)}

					<Button
						variant="outline"
						onPress={signOut}
						style={{ marginTop: spacing[6] }}
					>
						Sign out
					</Button>
				</ScrollView>
			)}
		</View>
	);
}
