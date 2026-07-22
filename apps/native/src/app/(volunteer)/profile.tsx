import { isSelfieDocument } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	Award,
	Bookmark,
	Building2,
	ChevronRight,
	Pencil,
	TrendingUp,
} from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
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
import { useMyUserDocuments } from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { DocVerificationStatus } from "@/lib/types";

export default function VolunteerProfile() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const me = useMe();
	const documents = useMyUserDocuments();

	// Verification now needs two artifacts. Surface each one's own status; the
	// account-level pill above reflects both (server-derived).
	const govIdDoc = (documents.data ?? []).find(
		(doc) => !isSelfieDocument(doc.documentType),
	);
	const selfieDoc = (documents.data ?? []).find((doc) =>
		isSelfieDocument(doc.documentType),
	);
	const hasSubmitted = Boolean(govIdDoc || selfieDoc);
	const reviewNote = govIdDoc?.remarks || selfieDoc?.remarks;

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
						Verify with a government ID and a quick selfie so NGOs know they can
						trust your application. Both are needed to get verified.
					</Caption>

					{documents.isLoading ? (
						<LoadingState />
					) : (
						<Surface style={{ gap: spacing[3] }}>
							<VerificationArtifact
								label="Government ID"
								status={govIdDoc?.verificationStatus}
							/>
							<VerificationArtifact
								label="Verification selfie"
								status={selfieDoc?.verificationStatus}
							/>
							{reviewNote && (
								<Caption color="secondary">“{reviewNote}”</Caption>
							)}
							<Button
								onPress={() => router.push("/verify-identity")}
								style={{ marginTop: spacing[1] }}
							>
								{hasSubmitted ? "Update documents" : "Get verified"}
							</Button>
						</Surface>
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

function VerificationArtifact({
	label,
	status,
}: {
	label: string;
	status?: DocVerificationStatus | null;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: spacing[2],
			}}
		>
			<Body weight="medium" style={{ flex: 1 }}>
				{label}
			</Body>
			{status ? (
				<StatusPill
					label={humanizeStatus(status)}
					tone={verificationTone(status)}
				/>
			) : (
				<Caption color="quaternary">Not submitted</Caption>
			)}
		</View>
	);
}
