import { formatMinor } from "@nabhya/shared";
import { HandCoins } from "lucide-react-native";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { Body, Caption, H3 } from "@/components/ui/typography";
import { useOrgDonations } from "@/hooks/use-engagement";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";

export default function OrgDonations() {
	const { colors, spacing } = useTheme();
	const query = useOrgDonations();

	const stats = query.data?.stats;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Donations"
				subtitle="Money received through Nabhya."
			/>

			{stats && (
				<View
					style={{
						flexDirection: "row",
						gap: spacing[2],
						marginBottom: spacing[4],
					}}
				>
					<Surface style={{ flex: 1 }}>
						<H3 color={colors.success.main as string}>
							{formatMinor(stats.totalMinor)}
						</H3>
						<Caption color="tertiary">received</Caption>
					</Surface>
					<Surface style={{ flex: 1 }}>
						<H3>{stats.donorCount}</H3>
						<Caption color="tertiary">donors</Caption>
					</Surface>
				</View>
			)}

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.data?.items ?? []}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching}
							onRefresh={() => query.refetch()}
							tintColor={colors.primary.main as string}
						/>
					}
					ListEmptyComponent={
						<EmptyState
							icon={HandCoins}
							title="No donations yet"
							description="Completed donations appear here with the donor's message."
						/>
					}
					renderItem={({ item }) => (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<Body weight="bold">{formatMinor(item.amountMinor)}</Body>
								<Caption color="quaternary">
									{formatRelative(item.completedAt ?? item.createdAt)}
								</Caption>
							</View>
							{/* Anonymity is applied server-side; donorName arrives null. */}
							<Caption color="tertiary" style={{ marginTop: 2 }}>
								{item.donorName ?? "Anonymous donor"}
							</Caption>
							{item.message && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									“{item.message}”
								</Caption>
							)}
						</Surface>
					)}
				/>
			)}
		</Screen>
	);
}
