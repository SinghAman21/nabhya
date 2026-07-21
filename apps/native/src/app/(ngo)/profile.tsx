import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { Pencil } from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	Pressable,
	RefreshControl,
	ScrollView,
	View,
} from "react-native";
import { DocumentsCard } from "@/components/documents-card";
import { OrgEditSheet } from "@/components/org-edit-sheet";
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
import { Body, Caption, H3 } from "@/components/ui/typography";
import {
	useMyOrganization,
	useMyOrgDocuments,
	useUploadOrgDocument,
} from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const ORG_DOCUMENT_TYPES = [
	{ value: "NGO_REGISTRATION_CERTIFICATE", label: "Registration certificate" },
	{ value: "PAN_CARD", label: "PAN card" },
	{ value: "80G_CERTIFICATE", label: "80G certificate" },
	{ value: "12A_CERTIFICATE", label: "12A certificate" },
	{ value: "GST_CERTIFICATE", label: "GST certificate" },
	{ value: "BANK_ACCOUNT_PROOF", label: "Bank account proof" },
	{ value: "OTHER", label: "Other" },
];

export default function NgoProfile() {
	const { colors, spacing } = useTheme();
	const [editOpen, setEditOpen] = useState(false);
	const email = useAuthStore((s) => s.email);
	const signOut = useAuthStore((s) => s.signOut);

	const orgQuery = useMyOrganization();
	const documents = useMyOrgDocuments();
	const uploadDocument = useUploadOrgDocument();
	const organization = orgQuery.data;

	if (orgQuery.isLoading) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<LoadingState label="Loading your organization…" />
			</View>
		);
	}

	if (orgQuery.isError) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<ErrorState
					message={apiErrorMessage(orgQuery.error)}
					onRetry={() => orgQuery.refetch()}
				/>
			</View>
		);
	}

	const facts = [
		organization?.orgType ? humanizeStatus(organization.orgType) : null,
		organization?.foundingYear ? `Since ${organization.foundingYear}` : null,
		organization?.teamSize ? `${organization.teamSize} people` : null,
		[organization?.city, organization?.state].filter(Boolean).join(", ") ||
			null,
	].filter(Boolean);

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.background.warm }}
			contentContainerStyle={{
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
				paddingBottom: spacing[10],
			}}
			refreshControl={
				<RefreshControl
					refreshing={orgQuery.isRefetching}
					onRefresh={() => orgQuery.refetch()}
					tintColor={colors.primary.main as string}
				/>
			}
		>
			<ScreenHeader
				title="Organization"
				subtitle="Your public profile and verification documents."
				action={
					<Pressable
						onPress={() => setEditOpen(true)}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.background.primary,
							borderWidth: 1,
							borderColor: colors.border.light,
						}}
					>
						<Pencil size={18} color={colors.text.secondary as string} />
					</Pressable>
				}
			/>

			<Surface style={{ marginBottom: spacing[4] }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
					}}
				>
					<View
						style={{
							width: 52,
							height: 52,
							borderRadius: 26,
							backgroundColor: colors.primary.main,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<H3 color={colors.primary.contrast as string}>
							{(organization?.organizationName ?? "O")[0]?.toUpperCase()}
						</H3>
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="bold" numberOfLines={2}>
							{organization?.organizationName}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{facts.join(" · ") || "Add details to complete your profile"}
						</Caption>
					</View>
					<StatusPill
						label={humanizeStatus(
							organization?.verificationStatus ?? "PENDING",
						)}
						tone={verificationTone(organization?.verificationStatus)}
					/>
				</View>

				{organization?.verificationStatus === "REJECTED" &&
					organization.rejectionReason && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[3] }}
						>
							{organization.rejectionReason}
						</Caption>
					)}

				{organization?.description ? (
					<Caption color="secondary" style={{ marginTop: spacing[3] }}>
						{organization.description}
					</Caption>
				) : null}

				{(organization?.categories.length ?? 0) > 0 && (
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
							marginTop: spacing[3],
						}}
					>
						{organization?.categories.map((category) => (
							<StatusPill key={category.id} label={category.name} tone="info" />
						))}
					</View>
				)}
			</Surface>

			<View style={{ marginBottom: spacing[4] }}>
				<DocumentsCard
					title="Verification documents"
					hint="Legal documents the Nabhya team reviews to verify your NGO."
					documents={documents.data}
					isLoading={documents.isLoading}
					typeOptions={ORG_DOCUMENT_TYPES}
					submitting={uploadDocument.isPending}
					onSubmit={(input, onDone) =>
						uploadDocument.mutate(input as UploadOrgDocumentInput, {
							onSuccess: onDone,
							onError: (error) =>
								Alert.alert("Could not submit", apiErrorMessage(error)),
						})
					}
				/>
			</View>

			<Surface style={{ marginBottom: spacing[4] }}>
				<Body weight="bold">Account</Body>
				<Caption color="tertiary" style={{ marginTop: 2 }}>
					{email}
				</Caption>
				<Button
					variant="outline"
					onPress={signOut}
					style={{ marginTop: spacing[4] }}
				>
					Sign out
				</Button>
			</Surface>

			<OrgEditSheet
				visible={editOpen}
				onClose={() => setEditOpen(false)}
				organization={organization}
			/>
		</ScrollView>
	);
}
