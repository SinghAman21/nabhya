import { isSelfieDocument } from "@nabhya/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
	Award,
	Bell,
	Bookmark,
	ChevronRight,
	HandCoins,
	Moon,
	ShieldCheck,
	TrendingUp,
	UserRound,
} from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
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
import { useMyImpact } from "@/hooks/use-directory";
import { useMyUserDocuments } from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The volunteer's own page, top to bottom in the order a person needs it:
 *
 * 1. Who I am — one tappable card: avatar, name, city, verification line.
 *    Tapping it edits the profile; there is no separate edit button to find.
 * 2. What I have done — three numbers, tap for the full impact page.
 * 3. What needs me — the verification banner, only while it does.
 * 4. Where things are — two short groups: my activity, then settings.
 * 5. Sign out — on its own at the end, away from everything else.
 *
 * Email, bio and phone are not shown here; they belong to the edit page. A
 * profile screen is a hub, and every extra line on the hub is a line before
 * the thing the person came for.
 */

/**
 * The desktop rail. `flexGrow: 0, flexShrink: 0` is spelled out because a
 * fixed `width` alone loses to flex when the row has spare space, and this
 * column previously used `position: sticky` — which needs a scrolling
 * ancestor it did not have, so it only made the column size to its content.
 */
const RAIL = { width: 340, flexGrow: 0, flexShrink: 0 } as const;

const APPEARANCE_LABEL = { system: "System", light: "Light", dark: "Dark" };

export default function VolunteerProfile() {
	const { colors, spacing } = useTheme();
	const { preference, setColorScheme } = useAppTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const { isDesktop } = useMedia();
	const [appearanceOpen, setAppearanceOpen] = useState(false);

	const me = useMe();
	const documents = useMyUserDocuments();
	const impact = useMyImpact();

	const govIdDoc = (documents.data ?? []).find(
		(doc) => !isSelfieDocument(doc.documentType),
	);
	const selfieDoc = (documents.data ?? []).find((doc) =>
		isSelfieDocument(doc.documentType),
	);
	const hasSubmitted = Boolean(govIdDoc || selfieDoc);
	const reviewNote = govIdDoc?.remarks || selfieDoc?.remarks;
	const isVerified = me.data?.verificationStatus === "VERIFIED";
	const rejected =
		govIdDoc?.verificationStatus === "REJECTED" ||
		selfieDoc?.verificationStatus === "REJECTED";

	const location = [me.data?.city, me.data?.state].filter(Boolean).join(", ");

	if (me.isLoading || me.isError) {
		return (
			<Screen>
				<ScreenHeader title="Profile" />
				{me.isLoading ? (
					<LoadingState />
				) : (
					<ErrorState
						message={apiErrorMessage(me.error)}
						onRetry={() => me.refetch()}
					/>
				)}
			</Screen>
		);
	}

	/* 1. Who I am ------------------------------------------------------------ */
	const identity = (
		<Surface
			onPress={() => router.push("/edit-profile")}
			style={{ marginBottom: spacing[4] }}
		>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}
			>
				<Avatar
					name={me.data?.name}
					imageKey={me.data?.profileImage}
					verified={isVerified}
				/>
				<View style={{ flex: 1, minWidth: 0 }}>
					<H3 numberOfLines={1}>{me.data?.name ?? "Volunteer"}</H3>
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
							{isVerified ? "Verified volunteer" : "Not verified yet"}
						</Caption>
					</View>
				</View>
				<ChevronRight size={18} color={colors.text.quaternary as string} />
			</View>
		</Surface>
	);

	/* 2. What I have done ---------------------------------------------------- */
	const numbers = impact.data ? (
		<View style={{ marginBottom: spacing[5] }}>
			<MetricRow
				stats={[
					{ label: "Hours given", value: impact.data.hoursContributed },
					{ label: "Events", value: impact.data.eventsAttended },
					{ label: "Certificates", value: impact.data.certificatesEarned },
				]}
			/>
		</View>
	) : null;

	/* 3. What needs me --------------------------------------------------------- */
	const verification =
		documents.isLoading || isVerified ? null : (
			<View style={{ marginBottom: spacing[6] }}>
				<Banner
					tone={rejected ? "error" : hasSubmitted ? "info" : "warning"}
					title={
						rejected
							? "Verification needs another look"
							: hasSubmitted
								? "Verification under review"
								: "Verify your identity"
					}
					description={
						rejected && reviewNote
							? reviewNote
							: hasSubmitted
								? "A reviewer is checking your ID and selfie. Usually a day or two."
								: "A government ID and a quick selfie. NGOs accept verified volunteers first."
					}
					onPress={() => router.push("/verify-identity")}
				/>
			</View>
		);

	/* 4. Where things are ------------------------------------------------------ */
	const activity = (
		<View style={{ marginBottom: spacing[6] }}>
			<SectionTitle>Your activity</SectionTitle>
			<ListGroup>
				<ListRow
					icon={TrendingUp}
					label="Impact"
					onPress={() => router.push("/impact")}
				/>
				<ListRow
					icon={Award}
					label="Certificates"
					onPress={() => router.push("/certificates")}
				/>
				<ListRow
					icon={HandCoins}
					label="Donations"
					onPress={() => router.push("/(volunteer)/donations")}
				/>
				<ListRow
					icon={Bookmark}
					label="NGOs you follow"
					onPress={() => router.push("/bookmarks")}
				/>
			</ListGroup>
		</View>
	);

	const settings = (
		<View style={{ marginBottom: spacing[8] }}>
			<SectionTitle>Settings</SectionTitle>
			<ListGroup>
				<ListRow
					icon={UserRound}
					label="Edit profile"
					onPress={() => router.push("/edit-profile")}
				/>
				<ListRow
					icon={ShieldCheck}
					label="Identity verification"
					value={
						<Caption color="tertiary">
							{isVerified
								? "Verified"
								: hasSubmitted
									? "Under review"
									: "Not started"}
						</Caption>
					}
					onPress={() => router.push("/verify-identity")}
				/>
				<ListRow
					icon={Bell}
					label="Notifications"
					onPress={() => router.push("/notifications")}
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

	/* 5. Sign out -------------------------------------------------------------- */
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
			<Caption color="quaternary" numberOfLines={1}>
				{me.data?.email}
			</Caption>
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

	/*
	 * One `ScrollView` for both platforms, varying only the layout inside it.
	 * The desktop branch used to be a plain `View`, so on a window shorter than
	 * the page — which is most of them, once the settings group is open — the
	 * bottom of the profile was drawn into `overflow: hidden` and could not be
	 * reached at all: no sign-out, no appearance, no certificates.
	 */
	return (
		<Screen>
			<ScreenHeader title="Profile" />

			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
				refreshControl={
					<RefreshControl
						refreshing={me.isRefetching}
						onRefresh={() => {
							me.refetch();
							documents.refetch();
							impact.refetch();
						}}
						tintColor={colors.text.quaternary as string}
					/>
				}
			>
				{isDesktop ? (
					<View style={{ flexDirection: "row", gap: spacing[6] }}>
						<View style={RAIL}>
							{identity}
							{verification}
							{signOutButton}
						</View>
						<View style={{ flex: 1, minWidth: 0 }}>
							{numbers}
							{activity}
							{settings}
						</View>
					</View>
				) : (
					<>
						{identity}
						{numbers}
						{verification}
						{activity}
						{settings}
						{signOutButton}
					</>
				)}
			</ScrollView>

			{appearanceSheet}
		</Screen>
	);
}

/**
 * The photo, with initials as the designed fallback.
 *
 * `profileImage` is a storage **key**, not a URL — the bucket is private — so it
 * has to be exchanged for a short-lived signed URL first, and that exchange can
 * legitimately return nothing (no photo, or a dev environment with no `R2_*`
 * credentials, where the storage stub has nothing to sign). Initials are
 * therefore the normal case, not an error state.
 */
function Avatar({
	name,
	imageKey,
	verified,
}: {
	name?: string | null;
	imageKey?: string | null;
	verified?: boolean;
}) {
	const { colors } = useTheme();
	const url = useStoredImageUrl(imageKey);
	const initials =
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "V";

	return (
		<View style={{ position: "relative" }}>
			{url ? (
				<Image
					source={{ uri: url }}
					contentFit="cover"
					accessibilityIgnoresInvertColors
					accessibilityLabel={name ?? "Your photo"}
					style={{
						width: 60,
						height: 60,
						borderRadius: 30,
						backgroundColor: colors.background.subtle,
					}}
				/>
			) : (
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
			)}
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
