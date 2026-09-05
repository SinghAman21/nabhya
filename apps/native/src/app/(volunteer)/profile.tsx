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
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption, H4, H5 } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useMyImpact } from "@/hooks/use-directory";
import { useMyUserDocuments } from "@/hooks/use-documents";
import { useMe } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { DocVerificationStatus } from "@/lib/types";

export default function VolunteerProfile() {
	const { colors, spacing, withOpacity } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const me = useMe();
	const documents = useMyUserDocuments();
	const impact = useMyImpact();

	// Verification needs two artifacts. Surface each one's own status; the
	// account-level pill reflects both (server-derived).
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
								impact.refetch();
							}}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					{/* ── Identity card ─────────────────────────────────────── */}
					<Surface style={{ marginBottom: spacing[3] }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[3.5],
							}}
						>
							<InitialsAvatar name={me.data?.name} />
							<View style={{ flex: 1 }}>
								<H5 numberOfLines={1}>{me.data?.name ?? "Volunteer"}</H5>
								<Caption color="tertiary" numberOfLines={1}>
									{me.data?.email}
								</Caption>
								{location ? (
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: spacing[1],
											marginTop: spacing[0.5],
										}}
									>
										<MapPin
											size={11}
											color={colors.text.quaternary as string}
										/>
										<Caption color="quaternary">{location}</Caption>
									</View>
								) : null}
							</View>
						</View>

						{me.data?.bio ? (
							<Caption color="secondary" style={{ marginTop: spacing[3] }}>
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
								borderTopColor: colors.border.light,
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

					{/* ── Impact at a glance ────────────────────────────────── */}
					{impact.data && (
						<View
							style={{
								flexDirection: "row",
								gap: spacing[2],
								marginBottom: spacing[5],
							}}
						>
							<StatTile
								icon={Clock}
								value={impact.data.hoursContributed}
								label="hours given"
								onPress={() => router.push("/impact")}
							/>
							<StatTile
								icon={CalendarCheck}
								value={impact.data.eventsAttended}
								label="events"
								onPress={() => router.push("/impact")}
							/>
							<StatTile
								icon={Award}
								value={impact.data.certificatesEarned}
								label="certificates"
								onPress={() => router.push("/certificates")}
							/>
						</View>
					)}

					{/* ── Identity verification ─────────────────────────────── */}
					{documents.isLoading ? (
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
								<IconChip
									icon={ShieldCheck}
									color={colors.success.main as string}
								/>
								<View style={{ flex: 1 }}>
									<Body weight="bold">Identity verified</Body>
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
									marginBottom: spacing[2],
								}}
							>
								<IconChip
									icon={ShieldCheck}
									color={colors.primary.main as string}
								/>
								<Body weight="bold" style={{ flex: 1 }}>
									Get verified
								</Body>
							</View>
							<Caption color="tertiary" style={{ marginBottom: spacing[3] }}>
								Verify with a government ID and a quick selfie so NGOs know they
								can trust your application. Both are needed.
							</Caption>

							<View
								style={{
									flexDirection: "row",
									gap: spacing[1.5],
									marginBottom: spacing[3],
								}}
							>
								<ProgressSegment status={govIdDoc?.verificationStatus} />
								<ProgressSegment status={selfieDoc?.verificationStatus} />
							</View>

							<View style={{ gap: spacing[2.5] }}>
								<VerificationArtifact
									icon={IdCard}
									label="Government ID"
									status={govIdDoc?.verificationStatus}
								/>
								<VerificationArtifact
									icon={Camera}
									label="Verification selfie"
									status={selfieDoc?.verificationStatus}
								/>
							</View>

							{reviewNote && (
								<View
									style={{
										marginTop: spacing[3],
										padding: spacing[3],
										borderRadius: 12,
										backgroundColor: withOpacity(
											colors.warning.main as string,
											0.08,
										),
									}}
								>
									<Caption weight="medium" color="secondary">
										Reviewer note
									</Caption>
									<Caption color="tertiary">“{reviewNote}”</Caption>
								</View>
							)}

							<Button
								onPress={() => router.push("/verify-identity")}
								style={{ marginTop: spacing[4] }}
							>
								{hasSubmitted ? "Update documents" : "Start verification"}
							</Button>
						</Surface>
					)}

					{/* ── Account ───────────────────────────────────────────── */}
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
							color={colors.info.main as string}
							label="Edit profile"
							sublabel="Name, bio, location and interests"
							onPress={() => router.push("/edit-profile")}
							first
						/>
						<MenuDivider />
						<MenuRow
							icon={Award}
							color={colors.warning.main as string}
							label="My certificates"
							sublabel="Everything you've earned"
							onPress={() => router.push("/certificates")}
						/>
						<MenuDivider />
						<MenuRow
							icon={TrendingUp}
							color={colors.success.main as string}
							label="My impact"
							sublabel="Hours, events and donations"
							onPress={() => router.push("/impact")}
						/>
						<MenuDivider />
						<MenuRow
							icon={Bookmark}
							color={colors.primary.main as string}
							label="Saved NGOs"
							sublabel="Organisations you bookmarked"
							onPress={() => router.push("/bookmarks")}
						/>
						<MenuDivider />
						<MenuRow
							icon={Building2}
							color={colors.special.orange as string}
							label="Browse NGOs"
							sublabel="Discover verified organisations"
							onPress={() => router.push("/ngos")}
							last
						/>
					</Surface>

					<Button
						variant="outline"
						onPress={() => signOut.mutate()}
						loading={signOut.isPending}
					>
						Sign out
					</Button>
				</ScrollView>
			)}
		</View>
	);
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function InitialsAvatar({ name }: { name?: string | null }) {
	const { colors, withOpacity } = useTheme();
	const initials =
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "V";

	return (
		<View
			style={{
				width: 56,
				height: 56,
				borderRadius: 28,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: withOpacity(colors.primary.main as string, 0.14),
			}}
		>
			<H4 color={colors.primary.dark as string}>{initials}</H4>
		</View>
	);
}

function IconChip({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
	const { withOpacity } = useTheme();
	return (
		<View
			style={{
				width: 36,
				height: 36,
				borderRadius: 12,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: withOpacity(color, 0.12),
			}}
		>
			<Icon size={18} color={color} />
		</View>
	);
}

function StatTile({
	icon: Icon,
	value,
	label,
	onPress,
}: {
	icon: LucideIcon;
	value: number;
	label: string;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	return (
		<Surface onPress={onPress} style={{ flex: 1 }}>
			<Icon size={16} color={colors.primary.main as string} />
			<H5 style={{ marginTop: spacing[1] }}>{value}</H5>
			<Caption color="tertiary" style={{ fontSize: 11 }}>
				{label}
			</Caption>
		</Surface>
	);
}

/** One of the two verification steps, colored by its document's review state. */
function ProgressSegment({
	status,
}: {
	status?: DocVerificationStatus | null;
}) {
	const { colors } = useTheme();
	const color = !status
		? colors.border.medium
		: status === "VERIFIED"
			? colors.success.main
			: status === "REJECTED"
				? colors.error.main
				: colors.warning.main;

	return (
		<View
			style={{
				flex: 1,
				height: 5,
				borderRadius: 999,
				backgroundColor: color as string,
			}}
		/>
	);
}

function VerificationArtifact({
	icon: Icon,
	label,
	status,
}: {
	icon: LucideIcon;
	label: string;
	status?: DocVerificationStatus | null;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
			}}
		>
			<Icon size={16} color={colors.text.tertiary as string} />
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

function MenuRow({
	icon,
	color,
	label,
	sublabel,
	onPress,
	first,
	last,
}: {
	icon: LucideIcon;
	color: string;
	label: string;
	sublabel?: string;
	onPress: () => void;
	first?: boolean;
	last?: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3],
				backgroundColor: pressed
					? (colors.background.tertiary as string)
					: "transparent",
				borderTopLeftRadius: first ? borderRadius.lg : 0,
				borderTopRightRadius: first ? borderRadius.lg : 0,
				borderBottomLeftRadius: last ? borderRadius.lg : 0,
				borderBottomRightRadius: last ? borderRadius.lg : 0,
			})}
		>
			<IconChip icon={icon} color={color} />
			<View style={{ flex: 1 }}>
				<Body weight="medium">{label}</Body>
				{sublabel && (
					<Caption color="quaternary" numberOfLines={1}>
						{sublabel}
					</Caption>
				)}
			</View>
			<ChevronRight size={18} color={colors.text.quaternary as string} />
		</Pressable>
	);
}

function MenuDivider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				height: 1,
				backgroundColor: colors.border.light,
				marginLeft: spacing[4] + 36 + spacing[3],
			}}
		/>
	);
}
