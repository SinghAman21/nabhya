import { isSelfieDocument } from "@nabhya/shared";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	Award,
	Bookmark,
	Building2,
	CalendarCheck,
	Camera,
	ChevronRight,
	Clock,
	IdCard,
	MapPin,
	Pencil,
	ShieldCheck,
	TrendingUp,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { NotificationBell } from "@/components/notification-bell";
import {
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption, H4 } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useMyImpact } from "@/hooks/use-directory";
import { useMyUserDocuments } from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { DocVerificationStatus } from "@/lib/types";

const STICKY_RAIL = {
	width: 340,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

import type { ViewStyle } from "react-native";
import { useMedia } from "@/hooks/useMedia";

export default function VolunteerProfile() {
	const { colors, spacing, withOpacity, borderRadius } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const { isDesktop } = useMedia();

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

	const location = [me.data?.city, me.data?.state].filter(Boolean).join(", ");
	const memberSince = me.data?.createdAt
		? new Date(me.data.createdAt).getFullYear()
		: null;

	if (me.isLoading) {
		return (
			<Screen>
				<ScreenHeader
					title="Profile"
					subtitle="Your details and identity verification."
					action={<NotificationBell />}
				/>
				<LoadingState />
			</Screen>
		);
	}

	if (me.isError) {
		return (
			<Screen>
				<ScreenHeader
					title="Profile"
					subtitle="Your details and identity verification."
					action={<NotificationBell />}
				/>
				<ErrorState
					message={apiErrorMessage(me.error)}
					onRetry={() => me.refetch()}
				/>
			</Screen>
		);
	}

	const identityCard = (
		<Surface style={{ marginBottom: spacing[3] }}>
			<InitialsAvatar name={me.data?.name} verified={isVerified} />
			<View style={{ marginTop: spacing[3] }}>
				<H4 numberOfLines={1}>{me.data?.name ?? "Volunteer"}</H4>
			</View>
			<Caption
				color="quaternary"
				numberOfLines={1}
				style={{ marginTop: spacing[0.5] }}
			>
				{me.data?.email}
			</Caption>
			{location ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1],
						marginTop: spacing[1.5],
					}}
				>
					<MapPin size={12} color={colors.text.tertiary as string} />
					<Caption color="tertiary">{location}</Caption>
				</View>
			) : null}
			{me.data?.bio ? (
				<Caption color="secondary" style={{ marginTop: spacing[2.5] }}>
					{me.data.bio}
				</Caption>
			) : null}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginTop: spacing[3],
					paddingTop: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.hairline,
				}}
			>
				<StatusPill
					label={`ID ${humanizeStatus(me.data?.verificationStatus).toLowerCase()}`}
					tone={verificationTone(me.data?.verificationStatus)}
				/>
				{memberSince && (
					<Caption color="quaternary">Member since {memberSince}</Caption>
				)}
			</View>
		</Surface>
	);

	const impactStrip = impact.data ? (
		<Surface padded={false} style={{ marginBottom: spacing[5] }}>
			<View style={{ flexDirection: "row" }}>
				<ImpactCell
					icon={Clock}
					value={impact.data.hoursContributed}
					label="hours given"
					onPress={() => router.push("/impact")}
					first
				/>
				<ImpactDivider />
				<ImpactCell
					icon={CalendarCheck}
					value={impact.data.eventsAttended}
					label="events"
					onPress={() => router.push("/impact")}
				/>
				<ImpactDivider />
				<ImpactCell
					icon={Award}
					value={impact.data.certificatesEarned}
					label="certificates"
					onPress={() => router.push("/certificates")}
					last
				/>
			</View>
		</Surface>
	) : null;

	const verificationCard = documents.isLoading ? (
		<LoadingState />
	) : isVerified ? (
		<Surface style={{ marginBottom: spacing[5] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				<IconBadge icon={ShieldCheck} color={colors.success.main as string} />
				<View style={{ flex: 1 }}>
					<Body weight="semibold">Identity verified</Body>
					<Caption color="tertiary">
						NGOs can see you're a trusted volunteer.
					</Caption>
				</View>
			</View>
		</Surface>
	) : (
		<Surface style={{ marginBottom: spacing[5] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
					marginBottom: spacing[3],
				}}
			>
				<IconBadge icon={ShieldCheck} color={colors.primary.ink as string} />
				<Body weight="semibold" style={{ flex: 1 }}>
					Get verified
				</Body>
			</View>
			<View style={{ gap: spacing[0] }}>
				<VerificationStep
					number={1}
					icon={IdCard}
					label="Government ID"
					status={govIdDoc?.verificationStatus}
					isLast={false}
				/>
				<VerificationStep
					number={2}
					icon={Camera}
					label="Verification selfie"
					status={selfieDoc?.verificationStatus}
					isLast
				/>
			</View>
			{reviewNote && (
				<View
					style={{
						marginTop: spacing[3],
						padding: spacing[3],
						borderRadius: borderRadius.lg,
						backgroundColor: withOpacity(colors.warning.main as string, 0.08),
					}}
				>
					<Caption weight="medium" color="secondary">
						Reviewer note
					</Caption>
					<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
						{reviewNote}
					</Caption>
				</View>
			)}
			<Button
				onPress={() => router.push("/verify-identity")}
				style={{ marginTop: spacing[4] }}
			>
				{hasSubmitted ? "Update documents" : "Start verification"}
			</Button>
		</Surface>
	);

	const accountSection = (
		<>
			<Caption
				weight="bold"
				color="tertiary"
				style={{
					letterSpacing: 1,
					textTransform: "uppercase",
					marginBottom: spacing[2],
				}}
			>
				Account
			</Caption>
			<Surface padded={false} style={{ marginBottom: spacing[6] }}>
				<MenuRow
					icon={Pencil}
					label="Edit profile"
					sublabel="Name, bio, location and interests"
					onPress={() => router.push("/edit-profile")}
					accessibilityLabel="Edit profile"
					first
				/>
				<MenuDivider />
				<MenuRow
					icon={Award}
					label="My certificates"
					sublabel="Everything you've earned"
					onPress={() => router.push("/certificates")}
					accessibilityLabel="My certificates"
				/>
				<MenuDivider />
				<MenuRow
					icon={TrendingUp}
					label="My impact"
					sublabel="Hours, events and donations"
					onPress={() => router.push("/impact")}
					accessibilityLabel="My impact"
				/>
				<MenuDivider />
				<MenuRow
					icon={Bookmark}
					label="Saved NGOs"
					sublabel="Organisations you bookmarked"
					onPress={() => router.push("/bookmarks")}
					accessibilityLabel="Saved NGOs"
				/>
				<MenuDivider />
				<MenuRow
					icon={Building2}
					label="Browse NGOs"
					sublabel="Discover verified organisations"
					onPress={() => router.push("/ngos")}
					accessibilityLabel="Browse NGOs"
					last
				/>
			</Surface>
		</>
	);

	const signOutButton = (
		<Button
			variant="outline"
			onPress={() => signOut.mutate()}
			loading={signOut.isPending}
			accessibilityLabel="Sign out"
			accessibilityRole="button"
		>
			Sign out
		</Button>
	);

	return (
		<Screen>
			<ScreenHeader
				title="Profile"
				subtitle="Your details and identity verification."
				action={<NotificationBell />}
			/>

			{isDesktop ? (
				<View style={{ flexDirection: "row", gap: spacing[6] }}>
					<View style={STICKY_RAIL}>
						{identityCard}
						{verificationCard}
						{signOutButton}
					</View>
					<View style={{ flex: 1 }}>
						{impactStrip}
						{accountSection}
					</View>
				</View>
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
								impact.refetch();
							}}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					{identityCard}
					{impactStrip}
					{verificationCard}
					{accountSection}
					{signOutButton}
				</ScrollView>
			)}
		</Screen>
	);
}

function InitialsAvatar({
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
			.toUpperCase() || "V";

	return (
		<View style={{ position: "relative", alignSelf: "flex-start" }}>
			<View
				style={{
					width: 64,
					height: 64,
					borderRadius: 32,
					borderWidth: 3,
					borderColor: colors.primary.tint,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.primary.tint,
				}}
			>
				<H4 color={colors.primary.ink as string}>{initials}</H4>
			</View>
			{verified && (
				<View
					style={{
						position: "absolute",
						bottom: -2,
						right: -2,
						width: 24,
						height: 24,
						borderRadius: 12,
						backgroundColor: colors.background.card,
						borderWidth: 2,
						borderColor: colors.background.card,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<View
						style={{
							width: 20,
							height: 20,
							borderRadius: 10,
							backgroundColor: colors.success.main,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<ShieldCheck size={12} color="#FFFFFF" />
					</View>
				</View>
			)}
		</View>
	);
}

function IconBadge({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
	const { withOpacity } = useTheme();
	return (
		<View
			style={{
				width: 40,
				height: 40,
				borderRadius: 20,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: withOpacity(color, 0.1),
			}}
		>
			<Icon size={18} color={color} />
		</View>
	);
}

function ImpactCell({
	icon: Icon,
	value,
	label,
	onPress,
	first,
	last,
}: {
	icon: LucideIcon;
	value: number;
	label: string;
	onPress: () => void;
	first?: boolean;
	last?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${value} ${label}`}
			style={({ pressed }) => ({
				flex: 1,
				alignItems: "center",
				paddingVertical: spacing[4],
				backgroundColor: pressed ? colors.background.subtle : "transparent",
				borderTopLeftRadius: first ? borderRadius.xl : 0,
				borderTopRightRadius: first ? borderRadius.xl : 0,
				borderBottomLeftRadius: last ? borderRadius.xl : 0,
				borderBottomRightRadius: last ? borderRadius.xl : 0,
			})}
		>
			<Icon size={16} color={colors.primary.ink as string} />
			<Body weight="bold" style={{ marginTop: spacing[1] }}>
				{value}
			</Body>
			<Caption color="tertiary" style={{ fontSize: 11 }}>
				{label}
			</Caption>
		</Pressable>
	);
}

function ImpactDivider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				width: 1,
				alignSelf: "stretch",
				marginVertical: spacing[2],
				backgroundColor: colors.border.hairline,
			}}
		/>
	);
}

function VerificationStep({
	number,
	icon: Icon,
	label,
	status,
	isLast,
}: {
	number: number;
	icon: LucideIcon;
	label: string;
	status?: DocVerificationStatus | null;
	isLast: boolean;
}) {
	const { colors, spacing } = useTheme();
	const statusColor = !status
		? colors.neutral[200]
		: status === "VERIFIED"
			? colors.success.main
			: status === "REJECTED"
				? colors.error.main
				: colors.warning.main;

	return (
		<View
			accessibilityRole="summary"
			accessibilityLabel={`${label}: ${status ? humanizeStatus(status) : "Not submitted"}`}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2.5],
				}}
			>
				<View
					style={{
						width: 28,
						height: 28,
						borderRadius: 14,
						backgroundColor: statusColor as string,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Icon size={14} color="#FFFFFF" />
				</View>
				<Body style={{ flex: 1 }}>{label}</Body>
				{status ? (
					<StatusPill
						label={humanizeStatus(status)}
						tone={verificationTone(status)}
					/>
				) : (
					<Caption color="quaternary">Not submitted</Caption>
				)}
			</View>
			{!isLast && (
				<View
					style={{
						height: 1,
						marginLeft: 14 + 8,
						marginTop: spacing[1],
						marginBottom: spacing[1],
						backgroundColor: colors.border.hairline,
					}}
				/>
			)}
		</View>
	);
}

function MenuRow({
	icon: Icon,
	label,
	sublabel,
	onPress,
	accessibilityLabel,
	first,
	last,
}: {
	icon: LucideIcon;
	label: string;
	sublabel?: string;
	onPress: () => void;
	accessibilityLabel?: string;
	first?: boolean;
	last?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
				backgroundColor: pressed ? colors.background.tertiary : "transparent",
				borderTopLeftRadius: first ? borderRadius.lg : 0,
				borderTopRightRadius: first ? borderRadius.lg : 0,
				borderBottomLeftRadius: last ? borderRadius.lg : 0,
				borderBottomRightRadius: last ? borderRadius.lg : 0,
			})}
		>
			<View
				style={{
					width: 32,
					height: 32,
					borderRadius: 10,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.background.subtle,
				}}
			>
				<Icon size={16} color={colors.text.tertiary as string} />
			</View>
			<View style={{ flex: 1 }}>
				<Body weight="medium">{label}</Body>
				{sublabel && (
					<Caption color="quaternary" numberOfLines={1}>
						{sublabel}
					</Caption>
				)}
			</View>
			<ChevronRight size={16} color={colors.text.quaternary as string} />
		</Pressable>
	);
}

function MenuDivider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				height: 1,
				backgroundColor: colors.border.hairline,
				marginLeft: spacing[4] + 32 + spacing[3],
			}}
		/>
	);
}
