import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	CalendarDays,
	ChevronRight,
	Globe,
	HeartHandshake,
	Mail,
	MapPin,
	Phone,
	ShieldCheck,
} from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
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
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useOrgTeam } from "@/hooks/use-directory";
import { useMyOrgDocuments } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

const REQUIRED_DOCS: UploadOrgDocumentInput["documentType"][] = [
	"NGO_REGISTRATION_CERTIFICATE",
	"PAN_CARD",
	"80G_CERTIFICATE",
	"12A_CERTIFICATE",
];

function InfoRow({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof MapPin;
	label: string;
	value: string | null | undefined;
}) {
	const { colors, spacing } = useTheme();
	if (!value) return null;
	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: spacing[2.5] }}
		>
			<Icon size={14} color={colors.text.quaternary as string} />
			<Caption color="secondary">{label}</Caption>
			<Caption color="primary" style={{ flex: 1 }} numberOfLines={1}>
				{value}
			</Caption>
		</View>
	);
}

export default function NgoProfile() {
	const { colors, spacing, borderRadius } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const team = useOrgTeam();

	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);
	const uploadedCount = REQUIRED_DOCS.filter((d) => byType.has(d)).length;
	const allRequiredDone = ["NGO_REGISTRATION_CERTIFICATE", "PAN_CARD"].every(
		(d) => byType.has(d),
	);

	const initials = org.data?.organizationName
		?.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const location = [org.data?.city, org.data?.state].filter(Boolean).join(", ");
	const categories = org.data?.categories?.map((c) => c.name).join(", ");

	return (
		<Screen>
			<ScreenHeader title="Profile" subtitle="Your organization at a glance." />

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
								team.refetch();
							}}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					{/* ── Identity card ─────────────────────────────────────── */}
					<Surface style={{ marginBottom: spacing[3] }}>
						<View style={{ alignItems: "center", marginBottom: spacing[4] }}>
							<View
								style={{
									width: 64,
									height: 64,
									borderRadius: 20,
									backgroundColor: colors.primary.main,
									alignItems: "center",
									justifyContent: "center",
									marginBottom: spacing[3],
								}}
							>
								<Body
									weight="bold"
									color={colors.primary.contrast as string}
									style={{ fontSize: 24 }}
								>
									{initials ?? "N"}
								</Body>
							</View>
							<Body weight="bold" style={{ fontSize: 18, textAlign: "center" }}>
								{org.data?.organizationName}
							</Body>
							{org.data?.orgType && (
								<Caption color="tertiary" style={{ marginTop: spacing[0.5] }}>
									{org.data.orgType}
									{org.data?.foundingYear
										? ` · Founded ${org.data.foundingYear}`
										: ""}
								</Caption>
							)}
							{location && (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[1],
										marginTop: spacing[1.5],
									}}
								>
									<MapPin size={12} color={colors.text.quaternary as string} />
									<Caption color="quaternary">{location}</Caption>
								</View>
							)}
							<View style={{ marginTop: spacing[2.5] }}>
								<StatusPill
									label={humanizeStatus(org.data?.verificationStatus)}
									tone={verificationTone(org.data?.verificationStatus)}
								/>
							</View>
						</View>

						{categories && (
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									gap: spacing[1.5],
									justifyContent: "center",
									marginBottom: spacing[4],
								}}
							>
								{org.data?.categories?.map((cat) => (
									<View
										key={cat.id}
										style={{
											paddingHorizontal: spacing[2.5],
											paddingVertical: spacing[1],
											borderRadius: 999,
											backgroundColor: `${colors.primary.main}10`,
										}}
									>
										<Caption
											weight="medium"
											color={colors.primary.main as string}
											style={{ fontSize: 11 }}
										>
											{cat.name}
										</Caption>
									</View>
								))}
							</View>
						)}

						{org.data?.rejectionReason && (
							<View
								style={{
									padding: spacing[3],
									borderRadius: 12,
									backgroundColor: colors.error.bg,
									marginBottom: spacing[3],
								}}
							>
								<Caption weight="bold" color={colors.error.main as string}>
									Verification rejected
								</Caption>
								<Caption color="secondary">{org.data.rejectionReason}</Caption>
							</View>
						)}

						<View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
							<InfoRow icon={Mail} label="Email" value={org.data?.email} />
							<InfoRow icon={Phone} label="Phone" value={org.data?.phone} />
							<InfoRow icon={Globe} label="Website" value={org.data?.website} />
						</View>

						{org.data?.description && (
							<View
								style={{
									paddingTop: spacing[3],
									borderTopWidth: 1,
									borderTopColor: colors.border.light,
									marginBottom: spacing[4],
								}}
							>
								<Caption
									weight="bold"
									color="tertiary"
									style={{
										letterSpacing: 1,
										textTransform: "uppercase",
										marginBottom: spacing[2],
									}}
								>
									About
								</Caption>
								<Caption color="secondary" style={{ lineHeight: 20 }}>
									{org.data.description}
								</Caption>
							</View>
						)}

						<Button
							variant="outline"
							onPress={() => router.push("/(ngo)/edit" as never)}
							className=""
						>
							{/* <Pencil size={16} color={colors.text.secondary as string} /> */}
							Edit profile
						</Button>
					</Surface>

					{/* ── Verification ──────────────────────────────────────── */}
					<Pressable
						onPress={() => router.push("/(ngo)/verification" as never)}
						style={({ pressed }) => ({
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							backgroundColor: pressed
								? colors.background.tertiary
								: colors.background.primary,
							borderRadius: borderRadius.lg,
							borderWidth: 1,
							borderColor: colors.border.light,
							padding: spacing[4],
							marginBottom: spacing[3],
						})}
					>
						<View
							style={{
								width: 44,
								height: 44,
								borderRadius: 12,
								backgroundColor: allRequiredDone
									? `${colors.success.main}15`
									: `${colors.primary.main}12`,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<ShieldCheck
								size={22}
								color={
									(allRequiredDone
										? colors.success.main
										: colors.primary.main) as string
								}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Body weight="semibold">Verification</Body>
							<Caption color="tertiary">
								{allRequiredDone
									? "All documents submitted"
									: `${uploadedCount} of 4 documents uploaded`}
							</Caption>
						</View>
						<View
							style={{
								minWidth: 28,
								height: 28,
								borderRadius: 14,
								backgroundColor: allRequiredDone
									? (colors.success.main as string)
									: (colors.primary.main as string),
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Caption weight="bold" color="#fff" style={{ fontSize: 12 }}>
								{uploadedCount}
							</Caption>
						</View>
					</Pressable>

					{/* ── Quick stats ───────────────────────────────────────── */}
					<Surface style={{ marginBottom: spacing[3] }}>
						<View style={{ flexDirection: "row", gap: spacing[3] }}>
							<View style={{ flex: 1, alignItems: "center" }}>
								<CalendarDays size={18} color={colors.primary.main as string} />
								<Body weight="bold" style={{ marginTop: spacing[1] }}>
									{org.data?.stats?.events?.total ?? 0}
								</Body>
								<Caption color="tertiary" style={{ fontSize: 11 }}>
									Events
								</Caption>
							</View>
							<View
								style={{
									width: 1,
									backgroundColor: colors.border.light,
								}}
							/>
							<View style={{ flex: 1, alignItems: "center" }}>
								<HeartHandshake
									size={18}
									color={colors.primary.main as string}
								/>
								<Body weight="bold" style={{ marginTop: spacing[1] }}>
									{org.data?.stats?.needs?.total ?? 0}
								</Body>
								<Caption color="tertiary" style={{ fontSize: 11 }}>
									Needs
								</Caption>
							</View>
							<View
								style={{
									width: 1,
									backgroundColor: colors.border.light,
								}}
							/>
							<View style={{ flex: 1, alignItems: "center" }}>
								<MapPin size={18} color={colors.primary.main as string} />
								<Body weight="bold" style={{ marginTop: spacing[1] }}>
									{team.data?.length ?? 0}
								</Body>
								<Caption color="tertiary" style={{ fontSize: 11 }}>
									Team
								</Caption>
							</View>
						</View>
					</Surface>

					{/* ── Quick links ──────────────────────────────────────── */}
					<Surface padded={false} style={{ marginBottom: spacing[5] }}>
						<QuickLink
							icon={CalendarDays}
							label="Events"
							sublabel={`${org.data?.stats?.events?.published ?? 0} published`}
							first
							onPress={() => router.push("/(ngo)/events" as never)}
						/>
						<View
							style={{
								height: 1,
								backgroundColor: colors.border.light,
								marginLeft: 52,
							}}
						/>
						<QuickLink
							icon={HeartHandshake}
							label="Needs"
							sublabel={`${org.data?.stats?.needs?.open ?? 0} open`}
							onPress={() => router.push("/(ngo)/needs" as never)}
						/>
						<View
							style={{
								height: 1,
								backgroundColor: colors.border.light,
								marginLeft: 52,
							}}
						/>
						<QuickLink
							icon={Globe}
							label="Public profile"
							sublabel="What volunteers see"
							onPress={() => router.push(`/ngos/${org.data?.id}` as never)}
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
		</Screen>
	);
}

function QuickLink({
	icon: Icon,
	label,
	sublabel,
	onPress,
	first,
}: {
	icon: typeof CalendarDays;
	label: string;
	sublabel?: string;
	onPress: () => void;
	first?: boolean;
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
				paddingVertical: spacing[3.5],
				backgroundColor: pressed
					? (colors.background.tertiary as string)
					: "transparent",
				borderTopLeftRadius: first ? borderRadius.lg : 0,
				borderTopRightRadius: first ? borderRadius.lg : 0,
			})}
		>
			<View
				style={{
					width: 36,
					height: 36,
					borderRadius: 10,
					backgroundColor: `${colors.primary.main}10`,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Icon size={18} color={colors.primary.main as string} />
			</View>
			<View style={{ flex: 1 }}>
				<Body weight="medium">{label}</Body>
				{sublabel && <Caption color="tertiary">{sublabel}</Caption>}
			</View>
			<ChevronRight size={18} color={colors.text.quaternary as string} />
		</Pressable>
	);
}
