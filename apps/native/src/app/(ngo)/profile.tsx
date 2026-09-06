import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	Bell,
	Building2,
	CalendarDays,
	ChevronRight,
	FileText,
	HandCoins,
	HeartHandshake,
	Megaphone,
	Moon,
	Pencil,
	ShieldCheck,
	Star,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	RefreshControl,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import {
	Banner,
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Caption, H3, H4 } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSignOut } from "@/hooks/use-auth";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";

/**
 * The organisation's own page, top to bottom in the order a coordinator needs it:
 *
 * 1. Who we are — one tappable card: avatar, name, city, verification line.
 *    Tapping it edits the profile; there is no separate edit button to find.
 * 2. What we have done — three numbers, once verified.
 * 3. What needs us — the verification banner, only while it does.
 * 4. Where things are — two short groups: manage, then settings.
 * 5. Verification documents — the legal uploads, below the fold.
 * 6. Sign out — on its own at the end, away from everything else.
 *
 * Mirrors `(volunteer)/profile.tsx`: same `Surface` identity card, same
 * `MetricRow`, same `Banner` position, same grouped `ListRow`s, same sticky
 * desktop rail. Posts live in the feed composer, not here — a profile screen
 * is a hub, and every extra section on the hub is a section before the thing
 * the coordinator came for.
 */

const STICKY_RAIL = {
	width: 340,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

const APPEARANCE_LABEL = { system: "System", light: "Light", dark: "Dark" };

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
	const { preference, setColorScheme } = useAppTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const { isDesktop } = useMedia();
	const [appearanceOpen, setAppearanceOpen] = useState(false);

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();

	const data = org.data;
	const status = data?.verificationStatus;
	const isVerified = status === "VERIFIED";
	const impact = useOrganizationImpact(isVerified ? data?.id : undefined);

	const byType = new Map(
		(documents.data ?? []).map((document) => [document.documentType, document]),
	);

	const location = [data?.city, data?.state].filter(Boolean).join(", ");

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

	if (org.isLoading || org.isError || !data) {
		return (
			<Screen>
				<ScreenHeader title="Profile" />
				{org.isLoading ? (
					<LoadingState />
				) : (
					<ErrorState
						message={apiErrorMessage(org.error)}
						onRetry={() => org.refetch()}
					/>
				)}
			</Screen>
		);
	}

	/* 1. Who we are ---------------------------------------------------------- */
	const identity = (
		<Surface
			onPress={() => router.push("/(ngo)/edit" as never)}
			style={{ marginBottom: spacing[4] }}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}
			>
				<Avatar name={data.organizationName} verified={isVerified} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<H3 numberOfLines={1}>{data.organizationName}</H3>
					{location ? (
						<Caption color="tertiary" numberOfLines={1}>
							{location}
						</Caption>
					) : (
						<Caption color="quaternary">Add your city</Caption>
					)}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1],
							marginTop: spacing[1.5],
						}}
					>
						<ShieldCheck
							size={13}
							strokeWidth={2.2}
							color={
								isVerified
									? (colors.success.ink as string)
									: (colors.text.quaternary as string)
							}
						/>
						<Caption
							weight="medium"
							color={
								isVerified
									? (colors.success.ink as string)
									: (colors.text.quaternary as string)
							}
						>
							{isVerified ? "Verified organisation" : "Not verified yet"}
						</Caption>
					</View>
				</View>
				<ChevronRight size={18} color={colors.text.quaternary as string} />
			</View>
		</Surface>
	);

	/* 2. What we have done --------------------------------------------------- */
	const numbers =
		isVerified && impact.data ? (
			<View style={{ marginBottom: spacing[5] }}>
				<MetricRow
					stats={[
						{ label: "Events hosted", value: impact.data.eventsHosted ?? 0 },
						{
							label: "Volunteers engaged",
							value: impact.data.volunteersEngaged ?? 0,
						},
						{
							label: "Needs fulfilled",
							value: impact.data.needsFulfilled ?? 0,
						},
					]}
				/>
			</View>
		) : null;

	/* 3. What needs us ------------------------------------------------------- */
	const verification = isVerified ? null : (
		<View style={{ marginBottom: spacing[6] }}>
			<Banner
				tone={
					status === "REJECTED"
						? "error"
						: status === "UNDER_REVIEW"
							? "info"
							: "warning"
				}
				title={
					status === "REJECTED"
						? "Verification was not approved"
						: status === "UNDER_REVIEW"
							? "Verification under review"
							: "Get verified to go public"
				}
				description={
					status === "REJECTED"
						? (data.rejectionReason ??
							"See the reviewer's notes and upload corrected documents.")
						: status === "UNDER_REVIEW"
							? "A reviewer is checking your documents. Usually a few days."
							: "Upload your registration certificate and PAN card. Until then, events and needs stay private."
				}
				onPress={() => router.push("/(ngo)/verification" as never)}
			/>
		</View>
	);

	/* 4. Where things are ---------------------------------------------------- */
	const manage = (
		<View style={{ marginBottom: spacing[6] }}>
			<SectionTitle>Manage</SectionTitle>
			<ListGroup>
				<ListRow
					icon={CalendarDays}
					label="Events"
					onPress={() => router.push("/(ngo)/events" as never)}
				/>
				<ListRow
					icon={HeartHandshake}
					label="Needs"
					onPress={() => router.push("/(ngo)/needs" as never)}
				/>
				<ListRow
					icon={Megaphone}
					label="Updates"
					onPress={() => router.push("/(ngo)/announcements" as never)}
				/>
				<ListRow
					icon={Star}
					label="Reviews"
					onPress={() => router.push("/(ngo)/reviews" as never)}
				/>
				<ListRow
					icon={HandCoins}
					label="Donations"
					onPress={() => router.push("/(ngo)/donations" as never)}
				/>
				<ListRow
					icon={FileText}
					label="Transparency"
					onPress={() => router.push("/(ngo)/reports" as never)}
				/>
				<ListRow
					icon={Users}
					label="Team"
					onPress={() => router.push("/(ngo)/team" as never)}
				/>
			</ListGroup>
		</View>
	);

	const settings = (
		<View style={{ marginBottom: spacing[8] }}>
			<SectionTitle>Settings</SectionTitle>
			<ListGroup>
				<ListRow
					icon={Pencil}
					label="Edit profile"
					onPress={() => router.push("/(ngo)/edit" as never)}
				/>
				<ListRow
					icon={Building2}
					label="Public profile"
					hint="What volunteers and donors see"
					onPress={() => router.push(`/ngos/${data.id}` as never)}
				/>
				<ListRow
					icon={ShieldCheck}
					label="Identity verification"
					value={
						<Caption color="tertiary">
							{isVerified
								? "Verified"
								: status === "UNDER_REVIEW"
									? "Under review"
									: status === "REJECTED"
										? "Action needed"
										: "Not started"}
						</Caption>
					}
					onPress={() => router.push("/(ngo)/verification" as never)}
				/>
				<ListRow
					icon={Bell}
					label="Notifications"
					onPress={() => router.push("/notifications" as never)}
				/>
				<ListRow
					icon={Moon}
					label="Appearance"
					value={
						<Caption color="tertiary">{APPEARANCE_LABEL[preference]}</Caption>
					}
					onPress={() => setAppearanceOpen(true)}
				/>
			</ListGroup>
		</View>
	);

	/* 5. Verification documents ---------------------------------------------- */
	const docs = (
		<View style={{ marginBottom: spacing[8] }}>
			<SectionTitle>Verification documents</SectionTitle>
			{documents.isLoading ? (
				<LoadingState />
			) : (
				<View style={{ gap: spacing[3] }}>
					{REQUIRED_DOCUMENTS.map((document) => (
						<DocumentUploadTile
							key={document.type}
							title={ORG_DOCUMENT_LABELS[document.type] ?? document.type}
							hint={document.hint}
							purpose="ORG_DOCUMENT"
							existing={byType.get(document.type)}
							saving={upload.isPending}
							onUploaded={(key) => submit(document.type, key)}
						/>
					))}
				</View>
			)}
		</View>
	);

	/* 6. Sign out ------------------------------------------------------------ */
	const signOutButton = (
		<View style={{ gap: spacing[3], alignItems: "center" }}>
			<Button
				variant="outline"
				onPress={() => signOut.mutate()}
				loading={signOut.isPending}
				accessibilityLabel="Sign out"
				style={{ alignSelf: "stretch" }}
			>
				Sign out
			</Button>
			{data.email ? (
				<Caption color="quaternary" numberOfLines={1}>
					{data.email}
				</Caption>
			) : null}
		</View>
	);

	const appearanceSheet = (
		<Sheet
			visible={appearanceOpen}
			onClose={() => setAppearanceOpen(false)}
			title="Appearance"
			subtitle="System follows your phone's setting."
		>
			<View style={{ paddingBottom: spacing[2] }}>
				{(["system", "light", "dark"] as const).map((option) => (
					<SheetOption
						key={option}
						label={APPEARANCE_LABEL[option]}
						selected={preference === option}
						onPress={() => {
							setColorScheme(option);
							setAppearanceOpen(false);
						}}
					/>
				))}
			</View>
		</Sheet>
	);

	return (
		<Screen>
			<ScreenHeader title="Profile" />

			{isDesktop ? (
				<View style={{ flexDirection: "row", gap: spacing[6] }}>
					<View style={STICKY_RAIL}>
						{identity}
						{verification}
						{signOutButton}
					</View>
					<View style={{ flex: 1 }}>
						{numbers}
						{manage}
						{docs}
						{settings}
					</View>
				</View>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={org.isRefetching || documents.isRefetching}
							onRefresh={() => {
								org.refetch();
								documents.refetch();
								if (isVerified) impact.refetch();
							}}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					{identity}
					{numbers}
					{verification}
					{manage}
					{docs}
					{settings}
					{signOutButton}
				</ScrollView>
			)}

			{appearanceSheet}
		</Screen>
	);
}

function Avatar({
	name,
	verified,
}: {
	name?: string | null;
	verified?: boolean;
}) {
	const { colors } = useTheme();
	const initials =
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "N";

	return (
		<View style={{ position: "relative" }}>
			<View
				style={{
					width: 60,
					height: 60,
					borderRadius: 30,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.primary.tint,
				}}
			>
				<H4 color={colors.primary.ink as string}>{initials}</H4>
			</View>
			{verified && (
				<View
					accessibilityLabel="Verified"
					style={{
						position: "absolute",
						bottom: -2,
						right: -2,
						width: 22,
						height: 22,
						borderRadius: 11,
						backgroundColor: colors.success.main,
						borderWidth: 2,
						borderColor: colors.background.card,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<ShieldCheck size={11} color="#FFFFFF" strokeWidth={2.5} />
				</View>
			)}
		</View>
	);
}
