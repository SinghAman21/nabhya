import { useRouter } from "expo-router";
import {
	CalendarDays,
	ChevronRight,
	FileText,
	Globe,
	HandCoins,
	HeartHandshake,
	Megaphone,
	ShieldCheck,
	Star,
	UserRound,
	Users,
} from "lucide-react-native";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { AppearanceRow } from "@/components/appearance-row";
import { InitialAvatar } from "@/components/initial-avatar";
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
import { Caption, H3 } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useOrgTeam } from "@/hooks/use-directory";
import { useMyOrgDocuments } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";

/** The two documents a reviewer needs before an NGO can be verified. */
const REQUIRED_DOCS = ["NGO_REGISTRATION_CERTIFICATE", "PAN_CARD"];

const STICKY_RAIL = {
	width: 340,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

/**
 * The organisation's own page, in the order a coordinator needs it:
 *
 * 1. Who we are — one tappable card: initials, name, type, city, causes and
 *    the verification line. Tapping it edits the profile.
 * 2. What needs us — the verification banner, only while it does.
 * 3. The numbers — events, needs, team.
 * 4. Where things are — the organisation, its audience, its money.
 * 5. Sign out — on its own at the end.
 *
 * Email, phone, website and the long description belong to the edit page and
 * the public profile; a hub that repeats them is a hub with the links pushed
 * below the fold.
 */
export default function NgoProfile() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const { isDesktop } = useMedia();

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const team = useOrgTeam();

	const data = org.data;
	const status = data?.verificationStatus;
	const isVerified = status === "VERIFIED";

	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);
	const requiredUploaded = REQUIRED_DOCS.filter((d) => byType.has(d)).length;
	const rejectedDoc = (documents.data ?? []).find(
		(doc) => doc.verificationStatus === "REJECTED",
	);

	const location = [data?.city, data?.state].filter(Boolean).join(", ");
	const causes = data?.categories?.map((c) => c.name).join(" · ");
	const typeLine = [
		data?.orgType,
		data?.foundingYear ? `Founded ${data.foundingYear}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	if (org.isLoading || org.isError) {
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
			onPress={() => router.push("/(ngo)/edit")}
			style={{ marginBottom: spacing[4] }}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}
			>
				<InitialAvatar name={data?.organizationName} size={60} square />
				<View style={{ flex: 1, minWidth: 0 }}>
					<H3 numberOfLines={2}>{data?.organizationName ?? "Your NGO"}</H3>
					{typeLine ? (
						<Caption color="tertiary" numberOfLines={1}>
							{typeLine}
						</Caption>
					) : null}
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
							{isVerified
								? "Verified NGO"
								: status === "UNDER_REVIEW"
									? "Verification under review"
									: status === "REJECTED"
										? "Verification not approved"
										: "Not verified yet"}
						</Caption>
					</View>
				</View>
				<ChevronRight size={18} color={colors.text.quaternary as string} />
			</View>
			{causes ? (
				<Caption
					color="secondary"
					numberOfLines={2}
					style={{
						marginTop: spacing[3],
						paddingTop: spacing[3],
						borderTopWidth: 1,
						borderTopColor: colors.border.hairline,
					}}
				>
					{causes}
				</Caption>
			) : null}
		</Surface>
	);

	/* 2. What needs us --------------------------------------------------------- */
	const verification =
		isVerified || documents.isLoading ? null : (
			<View style={{ marginBottom: spacing[6] }}>
				<Banner
					tone={
						status === "REJECTED" || rejectedDoc
							? "error"
							: status === "UNDER_REVIEW"
								? "info"
								: "warning"
					}
					title={
						status === "REJECTED" || rejectedDoc
							? "Verification needs another look"
							: status === "UNDER_REVIEW"
								? "Verification under review"
								: requiredUploaded === REQUIRED_DOCS.length
									? "Documents submitted"
									: "Upload your documents"
					}
					description={
						status === "REJECTED" && data?.rejectionReason
							? data.rejectionReason
							: rejectedDoc?.remarks
								? rejectedDoc.remarks
								: status === "UNDER_REVIEW"
									? "A reviewer is checking them. Usually a few days."
									: `${requiredUploaded} of ${REQUIRED_DOCS.length} required documents uploaded. Events and needs stay private until you're verified.`
					}
					onPress={() => router.push("/(ngo)/verification")}
				/>
			</View>
		);

	/* 3. The numbers ------------------------------------------------------------ */
	const numbers = (
		<View style={{ marginBottom: spacing[6] }}>
			<MetricRow
				stats={[
					{ label: "Events", value: data?.stats?.events?.total ?? 0 },
					{ label: "Open needs", value: data?.stats?.needs?.open ?? 0 },
					{ label: "Team", value: team.data?.length ?? 0 },
				]}
			/>
		</View>
	);

	/* 4. Where things are --------------------------------------------------------- */
	const organisation = (
		<View style={{ marginBottom: spacing[6] }}>
			<SectionTitle>Organisation</SectionTitle>
			<ListGroup>
				<ListRow
					icon={UserRound}
					label="Edit profile"
					onPress={() => router.push("/(ngo)/edit")}
				/>
				<ListRow
					icon={ShieldCheck}
					label="Verification"
					value={
						<Caption color="tertiary">
							{isVerified
								? "Verified"
								: status === "UNDER_REVIEW"
									? "Under review"
									: status === "REJECTED" || rejectedDoc
										? "Action needed"
										: `${requiredUploaded} of ${REQUIRED_DOCS.length} uploaded`}
						</Caption>
					}
					onPress={() => router.push("/(ngo)/verification")}
				/>
				<ListRow
					icon={Users}
					label="Team"
					value={
						<Caption color="tertiary">
							{team.data ? `${team.data.length}` : ""}
						</Caption>
					}
					onPress={() => router.push("/(ngo)/team")}
				/>
				{data?.id && (
					<ListRow
						icon={Globe}
						label="Public profile"
						hint="What volunteers and donors see"
						onPress={() => router.push(`/ngos/${data.id}` as never)}
					/>
				)}
				<AppearanceRow />
			</ListGroup>
		</View>
	);

	const programme = (
		<View style={{ marginBottom: spacing[6] }}>
			<SectionTitle>Programme</SectionTitle>
			<ListGroup>
				<ListRow
					icon={CalendarDays}
					label="Events"
					value={
						<Caption color="tertiary">
							{data?.stats?.events?.published ?? 0} published
						</Caption>
					}
					onPress={() => router.push("/(ngo)/events")}
				/>
				<ListRow
					icon={HeartHandshake}
					label="Needs"
					value={
						<Caption color="tertiary">
							{data?.stats?.needs?.open ?? 0} open
						</Caption>
					}
					onPress={() => router.push("/(ngo)/needs")}
				/>
				<ListRow
					icon={Megaphone}
					label="Updates"
					onPress={() => router.push("/(ngo)/announcements")}
				/>
				<ListRow
					icon={Star}
					label="Reviews"
					onPress={() => router.push("/(ngo)/reviews")}
				/>
			</ListGroup>
		</View>
	);

	const money = (
		<View style={{ marginBottom: spacing[8] }}>
			<SectionTitle>Money</SectionTitle>
			<ListGroup>
				<ListRow
					icon={HandCoins}
					label="Donations"
					onPress={() => router.push("/(ngo)/donations")}
				/>
				<ListRow
					icon={FileText}
					label="Reports"
					hint="Annual reports and audited statements"
					onPress={() => router.push("/(ngo)/reports")}
				/>
			</ListGroup>
		</View>
	);

	/* 5. Sign out ----------------------------------------------------------------- */
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
			{data?.email && (
				<Caption color="quaternary" numberOfLines={1}>
					{data.email}
				</Caption>
			)}
		</View>
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
						{organisation}
						{programme}
						{money}
					</View>
				</View>
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
								team.refetch();
							}}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					{identity}
					{verification}
					{numbers}
					{organisation}
					{programme}
					{money}
					{signOutButton}
				</ScrollView>
			)}
		</Screen>
	);
}
