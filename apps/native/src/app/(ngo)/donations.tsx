import { formatMinor } from "@nabhya/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { HandCoins } from "lucide-react-native";
import { FlatList, RefreshControl, View } from "react-native";
import { InitialAvatar } from "@/components/initial-avatar";
import { LoadMoreFooter } from "@/components/load-more-footer";
import {
	EmptyState,
	ErrorState,
	GridCell,
	LoadingState,
	MetricRow,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns } from "@/hooks/useMedia";
import { apiErrorMessage, donationsApi, queryKeys } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { OrgDonation } from "@/lib/types";

const PAGE_SIZE = 20;

/** Donations to this org, page by page. Stats ride along on every page. */
function useOrgDonationPages() {
	return useInfiniteQuery({
		queryKey: queryKeys.orgDonations({ paged: true }),
		queryFn: ({ pageParam }) =>
			donationsApi.listForOrg({ page: pageParam, limit: PAGE_SIZE }),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.meta.hasMore ? last.meta.page + 1 : undefined,
	});
}

/**
 * Money received through Nabhya. Read-only by design: a donation only becomes
 * COMPLETED through Razorpay's signed webhook, so there is nothing here for
 * the organisation to approve — just to see, thank, and reconcile.
 */
export default function OrgDonations() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const query = useOrgDonationPages();

	const stats = query.data?.pages[0]?.stats;
	const items = query.data?.pages.flatMap((page) => page.items) ?? [];
	const columns = useGridColumns();

	const loadMore = () => {
		if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
	};

	const numbers =
		stats && (stats.completedCount > 0 || stats.pendingCount > 0) ? (
			<View style={{ marginBottom: spacing[5] }}>
				<MetricRow
					stats={[
						{ label: "Received", value: formatMinor(stats.totalMinor) },
						{ label: "Donors", value: stats.donorCount },
						{ label: "Donations", value: stats.completedCount },
					]}
				/>
				{stats.pendingCount > 0 && (
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						{stats.pendingCount} payment{stats.pendingCount === 1 ? "" : "s"}{" "}
						still confirming with Razorpay.
					</Caption>
				)}
			</View>
		) : null;

	return (
		<Screen>
			<ScreenHeader
				back
				title="Donations"
				subtitle="Money received through Nabhya"
			/>

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					key={`grid-${columns}`}
					numColumns={columns}
					columnWrapperStyle={columns > 1 ? { gap: spacing[3] } : undefined}
					data={items}
					keyExtractor={(item) => item.id}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
					onEndReached={loadMore}
					onEndReachedThreshold={0.5}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching && !query.isFetchingNextPage}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListHeaderComponent={numbers}
					ListEmptyComponent={
						<EmptyState
							icon={HandCoins}
							title="No donations yet"
							description="Donations come from your public profile, with the amount, the donor's name (unless they chose to stay anonymous) and any message they left. A profile with a logo, a description and a published report gets far more of them."
							// An empty state with nothing to do is a dead end. The
							// profile is the page donors actually give from, so it is
							// the one useful thing to offer here.
							action={
								<Button
									variant="outline"
									onPress={() => router.push("/(ngo)/profile")}
								>
									Check your profile
								</Button>
							}
						/>
					}
					ListFooterComponent={
						<LoadMoreFooter
							hasMore={!!query.hasNextPage}
							loading={query.isFetchingNextPage}
							onLoadMore={loadMore}
							count={items.length}
							noun="donations"
						/>
					}
					renderItem={({ item }) => (
						<GridCell>
							<DonationRow donation={item} />
						</GridCell>
					)}
				/>
			)}
		</Screen>
	);
}

function DonationRow({ donation }: { donation: OrgDonation }) {
	const { spacing } = useTheme();
	// Anonymity is applied server-side; donorName arrives null.
	const donor = donation.donorName ?? "Anonymous donor";
	const completed = donation.status === "COMPLETED";

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={donation.donorName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{formatMinor(donation.amountMinor)}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{donor} ·{" "}
						{formatRelative(donation.completedAt ?? donation.createdAt)}
					</Caption>
				</View>
				{!completed && (
					<StatusPill
						label={
							donation.status === "PENDING" ? "Confirming" : donation.status
						}
						tone={donation.status === "PENDING" ? "warning" : "neutral"}
					/>
				)}
			</View>

			{donation.message && (
				<BodySmall color="secondary" style={{ marginTop: spacing[3] }}>
					“{donation.message}”
				</BodySmall>
			)}

			{completed && donation.receiptNumber && (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					Receipt {donation.receiptNumber} ·{" "}
					{formatDate(donation.completedAt ?? donation.createdAt)}
				</Caption>
			)}
		</Surface>
	);
}
