import type { UploadUserDocumentInput } from "@nabhya/shared";
import { USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	Award,
	Bookmark,
	Building2,
	ChevronRight,
	Pencil,
	TrendingUp,
} from "lucide-react-native";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import { NotificationBell } from "@/components/notification-bell";
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
import { useSignOut } from "@/hooks/use-auth";
import {
	useMyUserDocuments,
	useUploadUserDocument,
} from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

const ID_DOCUMENTS: Array<{
	type: UploadUserDocumentInput["documentType"];
	hint: string;
}> = [
	{ type: "AADHAR_CARD", hint: "Front and back in a single PDF or image" },
	{ type: "OTHER", hint: "Passport, driving licence or voter ID" },
];

export default function VolunteerProfile() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const me = useMe();
	const documents = useMyUserDocuments();
	const upload = useUploadUserDocument();

	const submit = (
		documentType: UploadUserDocumentInput["documentType"],
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
				subtitle="Your details and identity verification."
				action={<NotificationBell />}
			/>

			{me.isLoading ? (
				<LoadingState />
			) : me.isError ? (
				<ErrorState
					message={apiErrorMessage(me.error)}
					onRetry={() => me.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={me.isRefetching}
							onRefresh={() => {
								me.refetch();
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
							<Body weight="bold" style={{ flex: 1 }} numberOfLines={1}>
								{me.data?.name ?? "Volunteer"}
							</Body>
							<StatusPill
								label={`ID ${humanizeStatus(me.data?.verificationStatus).toLowerCase()}`}
								tone={verificationTone(me.data?.verificationStatus)}
							/>
						</View>
						<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
							{me.data?.email}
						</Caption>
						{(me.data?.city || me.data?.state) && (
							<Caption color="tertiary">
								{[me.data?.city, me.data?.state].filter(Boolean).join(", ")}
							</Caption>
						)}
					</Surface>

					<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
						<Surface onPress={() => router.push("/certificates")}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Award size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									My certificates
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>

						<Surface onPress={() => router.push("/edit-profile")}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Pencil size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									Edit profile
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>

						<Surface onPress={() => router.push("/impact")}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<TrendingUp size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									My impact
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>

						<Surface onPress={() => router.push("/ngos")}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Building2 size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									Browse NGOs
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>

						<Surface onPress={() => router.push("/bookmarks")}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Bookmark size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									Saved NGOs
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>
					</View>

					<Caption
						weight="bold"
						color="tertiary"
						style={{
							letterSpacing: 1,
							textTransform: "uppercase",
							marginBottom: spacing[2],
						}}
					>
						Identity verification
					</Caption>
					<Caption color="tertiary" style={{ marginBottom: spacing[4] }}>
						A verified ID shows NGOs they can trust your application. One
						document is enough — you don't need both.
					</Caption>

					{documents.isLoading ? (
						<LoadingState />
					) : (
						ID_DOCUMENTS.map((doc) => (
							<DocumentUploadTile
								key={doc.type}
								title={USER_DOCUMENT_LABELS[doc.type] ?? doc.type}
								hint={doc.hint}
								purpose="USER_DOCUMENT"
								existing={byType.get(doc.type)}
								saving={upload.isPending}
								onUploaded={(key) => submit(doc.type, key)}
							/>
						))
					)}

					<Button
						variant="outline"
						onPress={() => signOut.mutate()}
						loading={signOut.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Sign out
					</Button>
				</ScrollView>
			)}
		</View>
	);
}
