import { useRouter } from "expo-router";
import { LogOut, Megaphone } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { AuditRow } from "@/components/admin/audit-row";
import { BroadcastSheet } from "@/components/admin/broadcast-sheet";
import { AdminScreen } from "@/components/admin/list-chrome";
import { AppearanceRow } from "@/components/appearance-row";
import {
	ErrorState,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, Label } from "@/components/ui/typography";
import { useAdminOverview, useAuditLogs } from "@/hooks/use-admin";
import { useSignOut } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";

/**
 * The superadmin's front page, in the order the job goes:
 *
 * 1. What is waiting on me — three queues with counts, each a tap from the
 *    list that clears it.
 * 2. How big is the platform — numerals, quiet, no colour unless the number
 *    is itself a decision.
 * 3. What just happened — the last few audit entries, with a way to the log.
 * 4. Me — appearance and sign out, at the end where settings live.
 */
export default function AdminOverviewScreen() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [broadcasting, setBroadcasting] = useState(false);

	const query = useAdminOverview();
	const recent = useAuditLogs({ limit: 5 });
	const signOut = useSignOut();
	const user = useAuthStore((s) => s.user);

	const overview = query.data;

	const broadcastButton = (
		<Pressable
			onPress={() => setBroadcasting(true)}
			accessibilityRole="button"
			accessibilityLabel="Send a broadcast"
			hitSlop={6}
			{...focusable}
			style={({ pressed }) => ({
				width: 40,
				height: 40,
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: pressed ? colors.primary.dark : colors.primary.main,
			})}
		>
			<Megaphone
				size={18}
				color={colors.primary.contrast as string}
				strokeWidth={2}
			/>
		</Pressable>
	);

	return (
		<AdminScreen>
			<ScreenHeader
				title="Overview"
				subtitle="Superadmin console"
				action={broadcastButton}
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
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => {
								query.refetch();
								recent.refetch();
							}}
							tintColor={colors.text.quaternary as string}
						/>
					}
				>
					{/* 1. Needs review ------------------------------------------------ */}
					<View style={{ marginBottom: spacing[6] }}>
						<SectionTitle>Needs review</SectionTitle>
						<ListGroup>
							<ReviewRow
								label="NGOs awaiting verification"
								hint="Pending and under review"
								count={
									overview.organizations.pending +
									overview.organizations.underReview
								}
								onPress={() => router.push("/(admin)/organizations")}
							/>
							<ReviewRow
								label="NGO documents"
								hint="Registration, PAN, 12A and 80G"
								count={overview.documents.pendingOrgDocuments}
								onPress={() =>
									router.push({
										pathname: "/(admin)/queue",
										params: { kind: "organization" },
									})
								}
							/>
							<ReviewRow
								label="Identity documents"
								hint="Volunteer IDs and liveness selfies"
								count={overview.documents.pendingUserDocuments}
								onPress={() =>
									router.push({
										pathname: "/(admin)/queue",
										params: { kind: "user" },
									})
								}
							/>
						</ListGroup>
					</View>

					{/* 2. The platform in numbers --------------------------------------- */}
					<View style={{ marginBottom: spacing[6] }}>
						<SectionTitle>Organizations</SectionTitle>
						<MetricRow
							stats={[
								{ label: "Total", value: overview.organizations.total },
								{ label: "Verified", value: overview.organizations.verified },
								{
									label: "Pending",
									value: overview.organizations.pending,
									...(overview.organizations.pending > 0
										? { tone: "warning" as const }
										: {}),
								},
								{ label: "Suspended", value: overview.organizations.suspended },
							]}
						/>
					</View>

					<View style={{ marginBottom: spacing[6] }}>
						<SectionTitle>People</SectionTitle>
						<MetricRow
							stats={[
								{ label: "Accounts", value: overview.users.total },
								{ label: "Volunteers", value: overview.users.volunteers },
								{ label: "NGO accounts", value: overview.users.organisations },
								{ label: "Suspended", value: overview.users.suspended },
							]}
						/>
					</View>

					<View style={{ marginBottom: spacing[6] }}>
						<SectionTitle>Activity</SectionTitle>
						<MetricRow
							stats={[
								{ label: "Events", value: overview.events.total },
								{ label: "Upcoming", value: overview.events.upcoming },
								{ label: "Open needs", value: overview.needs.open },
								{
									label: "Applications pending",
									value: overview.applications.pending,
								},
							]}
						/>
					</View>

					{/* 3. What just happened -------------------------------------------- */}
					<View style={{ marginBottom: spacing[6] }}>
						<SectionTitle
							action={
								<Pressable
									onPress={() => router.push("/(admin)/audit")}
									accessibilityRole="link"
									accessibilityLabel="See all activity"
									hitSlop={8}
									{...focusable}
								>
									<Caption weight="medium" color={colors.primary.ink}>
										See all
									</Caption>
								</Pressable>
							}
						>
							Recent activity
						</SectionTitle>
						{recent.isLoading ? (
							<Surface>
								<LoadingState />
							</Surface>
						) : recent.isError ? (
							<Surface>
								<ErrorState
									message={apiErrorMessage(recent.error)}
									onRetry={() => recent.refetch()}
								/>
							</Surface>
						) : (recent.data?.items.length ?? 0) === 0 ? (
							<Surface>
								<Caption color="tertiary">
									Moderation and lifecycle actions appear here as they happen.
								</Caption>
							</Surface>
						) : (
							<ListGroup>
								{(recent.data?.items ?? []).map((entry) => (
									<AuditRow key={entry.id} entry={entry} />
								))}
							</ListGroup>
						)}
					</View>

					{/* 4. Me --------------------------------------------------------------- */}
					<View style={{ marginBottom: spacing[4] }}>
						<SectionTitle>Account</SectionTitle>
						<ListGroup>
							<AppearanceRow />
							<ListRow
								icon={LogOut}
								label="Sign out"
								hint={user?.email ?? undefined}
								value={<View />}
								onPress={() => {
									if (signOut.isPending) return;
									signOut.mutate(undefined, {
										onSettled: () => router.replace("/(auth)/login"),
									});
								}}
							/>
						</ListGroup>
					</View>
				</ScrollView>
			)}

			<BroadcastSheet
				visible={broadcasting}
				onClose={() => setBroadcasting(false)}
			/>
		</AdminScreen>
	);
}

/**
 * A queue row. The count is the loudest thing on the line — in warning ink
 * while anything is waiting, quiet when the queue is clear.
 */
function ReviewRow({
	label,
	hint,
	count,
	onPress,
}: {
	label: string;
	hint: string;
	count: number;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${count} waiting. ${hint}`}
			{...focusable}
			style={({ pressed }) => ({
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[3.5],
				paddingHorizontal: spacing[4],
				paddingVertical: spacing[3.5],
				minHeight: 56,
				backgroundColor: pressed ? colors.background.subtle : "transparent",
			})}
		>
			<View style={{ flex: 1 }}>
				<Body weight="medium" numberOfLines={1}>
					{label}
				</Body>
				<Caption color="tertiary" numberOfLines={1}>
					{hint}
				</Caption>
			</View>
			<Label
				weight="bold"
				color={
					count > 0 ? colors.warning.ink : (colors.text.quaternary as string)
				}
			>
				{count}
			</Label>
		</Pressable>
	);
}
