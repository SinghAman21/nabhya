import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	Award,
	CalendarDays,
	ChevronRight,
	FileText,
	HeartHandshake,
	Megaphone,
	Star,
	Users,
	Wallet,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader, Surface } from "@/components/screen-shell";
import { Body, Caption, H1, H3 } from "@/components/ui/typography";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useOrgEvents } from "@/hooks/use-events";
import { useOrgNeeds } from "@/hooks/use-needs";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth-store";

/**
 * The organization's home tab. Surfaces what needs a decision (pending
 * applicants and pledges), public impact once verified, and quick links into
 * the management screens that otherwise only hang off the Profile tab.
 */
export default function NgoDashboard() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const email = useAuthStore((s) => s.email);
	const storeProfile = useAuthStore((s) => s.orgProfile);

	const orgQuery = useMyOrganization();
	const org = orgQuery.data;
	const orgName = org?.organizationName || storeProfile.orgName || "Your NGO";
	const isVerified = org?.verificationStatus === "VERIFIED";

	// Page-1 lists carry the per-row pending counts; summing them gives the
	// "needs your attention" figure without a dedicated endpoint.
	const eventsQuery = useOrgEvents();
	const needsQuery = useOrgNeeds();
	const impactQuery = useOrganizationImpact(isVerified ? org?.id : undefined);

	const pendingApplications = (eventsQuery.data?.items ?? []).reduce(
		(sum, event) => sum + (event.pendingApplications ?? 0),
		0,
	);
	const pendingPledges = (needsQuery.data?.items ?? []).reduce(
		(sum, need) => sum + (need.pendingPledges ?? 0),
		0,
	);
	const openNeeds = (needsQuery.data?.items ?? []).filter(
		(need) => need.status === "OPEN",
	).length;

	const refreshing =
		orgQuery.isRefetching ||
		eventsQuery.isRefetching ||
		needsQuery.isRefetching ||
		impactQuery.isRefetching;

	const refetchAll = () => {
		orgQuery.refetch();
		eventsQuery.refetch();
		needsQuery.refetch();
		if (isVerified) impactQuery.refetch();
	};

	const impact = impactQuery.data;

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
				title="Dashboard"
				subtitle={orgName}
				action={
					<View
						style={{
							width: 48,
							height: 48,
							borderRadius: 24,
							backgroundColor: colors.primary.main,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<H1
							color={colors.primary.contrast as string}
							style={{ fontSize: 20, lineHeight: 24 }}
						>
							{(orgName || email || "N")[0]?.toUpperCase()}
						</H1>
					</View>
				}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refetchAll}
						tintColor={colors.primary.main as string}
					/>
				}
			>
				{!isVerified && (
					<Pressable
						onPress={() => router.push("/(ngo)/profile")}
						style={({ pressed }) => ({
							backgroundColor: colors.warning.bg,
							borderRadius: 14,
							padding: spacing[4],
							borderWidth: 1,
							borderColor: pressed
								? colors.warning.main
								: colors.warning.border,
							marginBottom: spacing[6],
						})}
					>
						<Body weight="bold" color={colors.warning.dark as string}>
							Verification pending
						</Body>
						<Caption color="secondary">
							Upload your legal documents from Profile to publish events, post
							needs and appear in the public directory.
						</Caption>
					</Pressable>
				)}

				{/* Anything waiting on the organiser goes first. */}
				<ActionQueue
					items={[
						{
							label: "Applicants to review",
							count: pendingApplications,
							onPress: () => router.push("/(ngo)/events"),
						},
						{
							label: "Pledges to review",
							count: pendingPledges,
							onPress: () => router.push("/(ngo)/needs"),
						},
					]}
				/>

				{isVerified && (
					<Section title="Your impact" icon={Award}>
						<StatGrid
							stats={[
								{ label: "Events hosted", value: impact?.eventsHosted ?? 0 },
								{
									label: "Volunteers engaged",
									value: impact?.volunteersEngaged ?? 0,
									tone: "success",
								},
								{
									label: "Volunteer hours",
									value: impact?.volunteerHours ?? 0,
								},
								{
									label: "Certificates issued",
									value: impact?.certificatesIssued ?? 0,
									tone: "info",
								},
								{
									label: "Needs fulfilled",
									value: impact?.needsFulfilled ?? 0,
									tone: "success",
								},
								{ label: "Items received", value: impact?.itemsReceived ?? 0 },
							]}
						/>
					</Section>
				)}

				<Section title="At a glance" icon={CalendarDays}>
					<StatGrid
						stats={[
							{
								label: "Events",
								value: eventsQuery.data?.meta.total ?? 0,
							},
							{
								label: "Open needs",
								value: openNeeds,
								tone: "success",
							},
							{
								label: "Pending items",
								value: pendingApplications + pendingPledges,
								tone:
									pendingApplications + pendingPledges > 0
										? "warning"
										: undefined,
							},
						]}
					/>
				</Section>

				<Section title="Manage" icon={Users}>
					<View style={{ gap: spacing[2] }}>
						<QuickLink
							icon={CalendarDays}
							label="Events"
							hint="Create and review applicants"
							onPress={() => router.push("/(ngo)/events")}
						/>
						<QuickLink
							icon={HeartHandshake}
							label="Needs & offers"
							hint="Post requests and review pledges"
							onPress={() => router.push("/(ngo)/needs")}
						/>
						<QuickLink
							icon={Megaphone}
							label="Announcements"
							hint="Post updates to your followers"
							onPress={() => router.push("/(ngo)/announcements")}
						/>
						<QuickLink
							icon={Star}
							label="Reviews"
							hint="Read and reply to reviews"
							onPress={() => router.push("/(ngo)/reviews")}
						/>
						<QuickLink
							icon={Users}
							label="Team"
							hint="Manage who can act for your NGO"
							onPress={() => router.push("/(ngo)/team")}
						/>
						<QuickLink
							icon={FileText}
							label="Financial reports"
							hint="Publish transparency documents"
							onPress={() => router.push("/(ngo)/reports")}
						/>
						<QuickLink
							icon={Wallet}
							label="Donations"
							hint="Track received donations"
							onPress={() => router.push("/(ngo)/donations")}
						/>
					</View>
				</Section>
			</ScrollView>
		</View>
	);
}

function ActionQueue({
	items,
}: {
	items: Array<{ label: string; count: number; onPress: () => void }>;
}) {
	const { colors, spacing } = useTheme();
	const pending = items.filter((item) => item.count > 0);

	if (pending.length === 0) {
		return (
			<Surface style={{ marginBottom: spacing[6] }}>
				<Body weight="bold" color={colors.success.main as string}>
					You're all caught up
				</Body>
				<Caption color="tertiary">
					Nothing is waiting on your review right now.
				</Caption>
			</Surface>
		);
	}

	return (
		<View style={{ marginBottom: spacing[6], gap: spacing[2] }}>
			{pending.map((item) => (
				<Pressable
					key={item.label}
					onPress={item.onPress}
					style={({ pressed }) => ({
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: spacing[3],
						backgroundColor: colors.warning.bg,
						borderWidth: 1,
						borderColor: pressed ? colors.warning.main : colors.warning.border,
						borderRadius: 14,
						padding: spacing[4],
					})}
				>
					<Body
						weight="medium"
						color={colors.warning.dark as string}
						style={{ flex: 1 }}
					>
						{item.label}
					</Body>
					<H3 color={colors.warning.dark as string}>{item.count}</H3>
				</Pressable>
			))}
		</View>
	);
}

function QuickLink({
	icon: Icon,
	label,
	hint,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	hint: string;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Surface onPress={onPress}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				<View
					style={{
						width: 40,
						height: 40,
						borderRadius: 20,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.background.tertiary,
					}}
				>
					<Icon size={18} color={colors.primary.main as string} />
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="medium">{label}</Body>
					<Caption color="tertiary">{hint}</Caption>
				</View>
				<ChevronRight size={18} color={colors.text.quaternary as string} />
			</View>
		</Surface>
	);
}

function Section({
	title,
	icon: Icon,
	children,
}: {
	title: string;
	icon: LucideIcon;
	children: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View style={{ marginBottom: spacing[6] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					marginBottom: spacing[3],
				}}
			>
				<Icon size={16} color={colors.text.tertiary as string} />
				<Caption
					weight="bold"
					color="tertiary"
					style={{ letterSpacing: 1, textTransform: "uppercase" }}
				>
					{title}
				</Caption>
			</View>
			{children}
		</View>
	);
}

function StatGrid({
	stats,
}: {
	stats: Array<{
		label: string;
		value: number;
		tone?: "success" | "warning" | "error" | "info";
	}>;
}) {
	const { colors, spacing } = useTheme();

	const toneColor = (tone?: string) => {
		switch (tone) {
			case "success":
				return colors.success.main;
			case "warning":
				return colors.warning.main;
			case "error":
				return colors.error.main;
			case "info":
				return colors.info.main;
			default:
				return colors.text.primary;
		}
	};

	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
			{stats.map((stat) => (
				<Surface
					key={stat.label}
					style={{ flexGrow: 1, flexBasis: "30%", minWidth: 96 }}
				>
					<H3 color={toneColor(stat.tone) as string}>{stat.value}</H3>
					<Caption color="tertiary" numberOfLines={2}>
						{stat.label}
					</Caption>
				</Surface>
			))}
		</View>
	);
}
