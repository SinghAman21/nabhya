import { Package } from "lucide-react-native";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	pledgeTone,
	StatusPill,
} from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useMyPledges } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";

/**
 * Everything the volunteer has offered or claimed, and where each one stands.
 * The API returns the parent need and organization alongside each pledge.
 */
export default function Donations() {
	const { colors, spacing } = useTheme();
	const query = useMyPledges();

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
				title="My donations"
				subtitle="Items you've offered or claimed, and their status."
			/>

			{query.isLoading ? (
				<LoadingState label="Loading your pledges…" />
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
							icon={Package}
							title="Nothing pledged yet"
							description="Head to Discover to see what NGOs need right now."
						/>
					}
					renderItem={({ item }) => (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									gap: spacing[3],
									marginBottom: spacing[2],
								}}
							>
								<Caption
									color="secondary"
									numberOfLines={1}
									style={{ flex: 1 }}
								>
									{item.organization?.organizationName}
								</Caption>
								<StatusPill
									label={humanizeStatus(item.status)}
									tone={pledgeTone(item.status)}
								/>
							</View>

							<Body weight="bold" numberOfLines={2}>
								{item.need?.title}
							</Body>
							<Caption color="tertiary" style={{ marginTop: 4 }}>
								{item.quantity
									? `${item.quantity}${item.need?.unit ? ` ${item.need.unit}` : ""} · `
									: ""}
								{formatRelative(item.createdAt)}
							</Caption>

							{item.reviewNote && (
								<Caption color="secondary" style={{ marginTop: spacing[2] }}>
									“{item.reviewNote}”
								</Caption>
							)}
						</Surface>
					)}
				/>
			)}
		</View>
	);
}
