import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
	Building2,
	CalendarDays,
	FileCheck,
	HeartHandshake,
	Megaphone,
	Users,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { BroadcastSheet } from "@/components/admin/broadcast-sheet";
import {
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption, H3 } from "@/components/ui/typography";
import { useAdminOverview } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

export default function AdminOverviewScreen() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [broadcasting, setBroadcasting] = useState(false);
	const query = useAdminOverview();

	const overview = query.data;

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
				title="Overview"
				subtitle="Everything happening across the platform."
				action={
					<Pressable
						onPress={() => setBroadcasting(true)}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.primary.main,
						}}
					>
						<Megaphone size={20} color={colors.primary.contrast as string} />
					</Pressable>
				}
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError || !overview ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
				>
					{/* Anything needing a human decision goes first. */}
					<ActionQueue
						items={[
							{
								label: "NGOs awaiting verification",
								count:
									overview.organizations.pending +
									overview.organizations.underReview,
								onPress: () => router.push("/(admin)/organizations"),
							},
							{
								label: "Organization documents to review",
								count: overview.documents.pendingOrgDocuments,
								onPress: () => router.push("/(admin)/organizations"),
							},
							{
								label: "Identity documents to review",
								count: overview.documents.pendingUserDocuments,
								onPress: () => router.push("/(admin)/volunteers"),
							},
						]}
					/>

					<Section title="Organizations" icon={Building2}>
						<StatGrid
							stats={[
								{ label: "Total", value: overview.organizations.total },
								{
									label: "Verified",
									value: overview.organizations.verified,
									tone: "success",
								},
								{
									label: "Pending",
									value: overview.organizations.pending,
									tone: "warning",
								},
								{
									label: "Under review",
									value: overview.organizations.underReview,
									tone: "info",
								},
								{
									label: "Rejected",
									value: overview.organizations.rejected,
									tone: "error",
								},
								{
									label: "Suspended",
									value: overview.organizations.suspended,
									tone: "error",
								},
							]}
						/>
					</Section>

					<Section title="People" icon={Users}>
						<StatGrid
							stats={[
								{ label: "Total users", value: overview.users.total },
								{ label: "Volunteers", value: overview.users.volunteers },
								{ label: "NGO accounts", value: overview.users.organisations },
								{
									label: "Suspended",
									value: overview.users.suspended,
									tone: "error",
								},
							]}
						/>
					</Section>

					<Section title="Events" icon={CalendarDays}>
						<StatGrid
							stats={[
								{ label: "Total", value: overview.events.total },
								{
									label: "Published",
									value: overview.events.published,
									tone: "success",
								},
								{
									label: "Upcoming",
									value: overview.events.upcoming,
									tone: "info",
								},
							]}
						/>
					</Section>

					<Section title="Applications" icon={FileCheck}>
						<StatGrid
							stats={[
								{ label: "Total", value: overview.applications.total },
								{
									label: "Pending",
									value: overview.applications.pending,
									tone: "warning",
								},
								{
									label: "Accepted",
									value: overview.applications.accepted,
									tone: "success",
								},
							]}
						/>
					</Section>

					<Section title="Needs & offers" icon={HeartHandshake}>
						<StatGrid
							stats={[
								{ label: "Open", value: overview.needs.open, tone: "success" },
								{ label: "Requests", value: overview.needs.wants },
								{ label: "Giveaways", value: overview.needs.offers },
								{ label: "Total", value: overview.needs.total },
							]}
						/>
					</Section>
				</ScrollView>
			)}

			<BroadcastSheet
				visible={broadcasting}
				onClose={() => setBroadcasting(false)}
			/>
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
					Queue is clear
				</Body>
				<Caption color="tertiary">
					Nothing is waiting on a decision right now.
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
