import type { UploadUserDocumentInput } from "@nabhya/shared";
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
import { ProfileEditSheet } from "@/components/profile-edit-sheet";
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
	useCategories,
	useMe,
	useMyDocuments,
	useUploadUserDocument,
} from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const USER_DOCUMENT_TYPES = [
	{ value: "AADHAR_CARD", label: "Aadhaar card" },
	{ value: "OTHER", label: "Other ID" },
];

export default function VolunteerProfile() {
	const { colors, spacing } = useTheme();
	const [editOpen, setEditOpen] = useState(false);
	const signOut = useAuthStore((s) => s.signOut);

	const meQuery = useMe();
	const categories = useCategories();
	const documents = useMyDocuments();
	const uploadDocument = useUploadUserDocument();
	const me = meQuery.data;

	if (meQuery.isLoading) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<LoadingState label="Loading your profile…" />
			</View>
		);
	}

	if (meQuery.isError) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<ErrorState
					message={apiErrorMessage(meQuery.error)}
					onRetry={() => meQuery.refetch()}
				/>
			</View>
		);
	}

	const interests = (categories.data ?? []).filter((category) =>
		me?.interestCategoryIds.includes(category.id),
	);
	const location =
		[me?.city, me?.state].filter(Boolean).join(", ") || "Location not set";

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
					refreshing={meQuery.isRefetching}
					onRefresh={() => meQuery.refetch()}
					tintColor={colors.primary.main as string}
				/>
			}
		>
			<ScreenHeader
				title="Profile"
				subtitle="How NGOs see you when you apply and pledge."
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
							{(me?.name ?? me?.email ?? "V")[0]?.toUpperCase()}
						</H3>
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="bold" numberOfLines={1}>
							{me?.name ?? "Add your name"}
						</Body>
						<Caption color="tertiary" numberOfLines={1}>
							{location}
						</Caption>
					</View>
					<StatusPill
						label={
							me?.verificationStatus === "VERIFIED"
								? "ID verified"
								: humanizeStatus(me?.verificationStatus ?? "PENDING")
						}
						tone={verificationTone(me?.verificationStatus)}
					/>
				</View>

				{me?.bio ? (
					<Caption color="secondary" style={{ marginTop: spacing[3] }}>
						{me.bio}
					</Caption>
				) : null}

				{interests.length > 0 && (
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
							marginTop: spacing[3],
						}}
					>
						{interests.map((category) => (
							<StatusPill key={category.id} label={category.name} tone="info" />
						))}
					</View>
				)}
			</Surface>

			<View style={{ marginBottom: spacing[4] }}>
				<DocumentsCard
					title="Identity verification"
					hint="A verified ID helps NGOs trust your applications and pledges."
					documents={documents.data}
					isLoading={documents.isLoading}
					typeOptions={USER_DOCUMENT_TYPES}
					submitting={uploadDocument.isPending}
					onSubmit={(input, onDone) =>
						uploadDocument.mutate(input as UploadUserDocumentInput, {
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
					{me?.email}
				</Caption>
				<Button
					variant="outline"
					onPress={signOut}
					style={{ marginTop: spacing[4] }}
				>
					Sign out
				</Button>
			</Surface>

			<ProfileEditSheet
				visible={editOpen}
				onClose={() => setEditOpen(false)}
				profile={me}
			/>
		</ScrollView>
	);
}
