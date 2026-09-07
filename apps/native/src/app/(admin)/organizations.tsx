import { Building2 } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	AdminScreen,
	ListFooter,
	ResultCount,
	SearchField,
} from "@/components/admin/list-chrome";
import { OrgDetailSheet } from "@/components/admin/org-detail-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminOrganizationsPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { AdminOrgListItem } from "@/lib/types";

type Filter =
	| "ALL"
	| "PENDING"
	| "UNDER_REVIEW"
	| "VERIFIED"
	| "REJECTED"
	| "SUSPENDED";

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "UNDER_REVIEW", label: "In review" },
	{ value: "VERIFIED", label: "Verified" },
	{ value: "REJECTED", label: "Rejected" },
	{ value: "SUSPENDED", label: "Suspended" },
	{ value: "ALL", label: "All" },
];

/** One chip row over the API's two filters: verification state, or account state. */
function toQuery(filter: Filter, search: string) {
	const base = search ? { search } : {};
	if (filter === "ALL") return base;
	if (filter === "SUSPENDED") return { ...base, status: "SUSPENDED" as const };
	return { ...base, verificationStatus: filter };
}

export default function AdminOrganizations() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<Filter>("PENDING");
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string | null>(null);

	const debouncedSearch = useDebounced(search.trim());
	const query = useAdminOrganizationsPaged(toQuery(filter, debouncedSearch));

	return (
		<AdminScreen>
			<ScreenHeader
				title="NGOs"
				subtitle="Verify organizations and keep an eye on what they publish"
			/>

			<SearchField
				value={search}
				onChangeText={setSearch}
				placeholder="Search by name, email or registration number"
			/>
			<FilterChips options={FILTERS} value={filter} onChange={setFilter} />

			{query.isLoading ? (
				<LoadingState />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : (
				<FlatList
					data={query.items}
					keyExtractor={(item) => item.id}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
					onEndReached={() => {
						if (query.hasNextPage && !query.isFetchingNextPage)
							query.fetchNextPage();
					}}
					onEndReachedThreshold={0.6}
					refreshControl={
						<RefreshControl
							refreshing={query.isRefetching && !query.isFetchingNextPage}
							onRefresh={() => query.refetch()}
							tintColor={colors.text.quaternary as string}
						/>
					}
					ListHeaderComponent={
						<ResultCount total={query.total} noun="organization" />
					}
					ListEmptyComponent={
						<EmptyState
							icon={Building2}
							title={
								debouncedSearch
									? "No matching organizations"
									: filter === "PENDING"
										? "Nothing waiting"
										: "Nothing here"
							}
							description={
								debouncedSearch
									? "Try a shorter name, or the registration number."
									: filter === "PENDING"
										? "No organizations are waiting for verification."
										: "No organizations match this filter."
							}
						/>
					}
					ListFooterComponent={
						<ListFooter
							count={query.items.length}
							hasMore={!!query.hasNextPage}
							fetching={query.isFetchingNextPage}
							onLoadMore={() => query.fetchNextPage()}
						/>
					}
					renderItem={({ item }) => (
						<OrgRow org={item} onPress={() => setSelected(item.id)} />
					)}
				/>
			)}

			<OrgDetailSheet
				organizationId={selected}
				onClose={() => setSelected(null)}
			/>
		</AdminScreen>
	);
}

/**
 * Compact: name and place on the first line, state pills on the second, a
 * quiet footer with the numbers a reviewer glances at before opening.
 */
function OrgRow({
	org,
	onPress,
}: {
	org: AdminOrgListItem;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	const place = [org.city, org.state].filter(Boolean).join(", ");

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<Initial text={org.organizationName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="semibold" numberOfLines={1}>
						{org.organizationName}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{place || org.email || "No location"}
					</Caption>
				</View>
			</View>

			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					gap: spacing[2],
					marginTop: spacing[3],
				}}
			>
				<StatusPill
					label={humanizeStatus(org.verificationStatus)}
					tone={verificationTone(org.verificationStatus)}
				/>
				{org.status === "SUSPENDED" && (
					<StatusPill label="Suspended" tone="error" />
				)}
				{org.pendingDocuments > 0 && (
					<StatusPill
						label={`${org.pendingDocuments} doc${org.pendingDocuments === 1 ? "" : "s"} to review`}
						tone="warning"
					/>
				)}
				<View style={{ flex: 1 }} />
				<Caption color="quaternary">Joined {formatDate(org.createdAt)}</Caption>
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{org.eventCount} event{org.eventCount === 1 ? "" : "s"} ·{" "}
				{org.needCount} need{org.needCount === 1 ? "" : "s"}
				{org.owner.fullName ? ` · Owner ${org.owner.fullName}` : ""}
			</Caption>
		</Surface>
	);
}

function Initial({ text }: { text: string }) {
	const { colors } = useTheme();
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={{
				width: 40,
				height: 40,
				borderRadius: 20,
				backgroundColor: colors.background.subtle,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Body weight="bold" color="secondary">
				{text.trim()[0]?.toUpperCase() ?? "?"}
			</Body>
		</View>
	);
}
