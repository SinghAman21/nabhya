import type { Role } from "@nabhya/shared";
import { Users } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	AdminScreen,
	ListFooter,
	ResultCount,
	SearchField,
} from "@/components/admin/list-chrome";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
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
import { useAdminUsersPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { verticalScrollbar } from "@/lib/scroll";
import type { AdminUserListItem } from "@/lib/types";

type Filter = "volunteer" | "organisation" | "SUSPENDED" | "PENDING_ID" | "ALL";

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: "volunteer", label: "Volunteers" },
	{ value: "organisation", label: "NGO accounts" },
	{ value: "PENDING_ID", label: "ID pending" },
	{ value: "SUSPENDED", label: "Suspended" },
	{ value: "ALL", label: "All" },
];

/** Maps the single chip row onto the API's separate role/status filters. */
function toQuery(filter: Filter, search: string) {
	const base = search ? { search } : {};
	switch (filter) {
		case "volunteer":
		case "organisation":
			return { ...base, role: filter as Role };
		case "SUSPENDED":
			return { ...base, status: "SUSPENDED" as const };
		case "PENDING_ID":
			return { ...base, verificationStatus: "PENDING" as const };
		default:
			return base;
	}
}

export default function AdminVolunteers() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<Filter>("volunteer");
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string | null>(null);

	const debouncedSearch = useDebounced(search.trim());
	const query = useAdminUsersPaged(toQuery(filter, debouncedSearch));

	return (
		<AdminScreen>
			<ScreenHeader
				title="People"
				subtitle="Volunteers and NGO accounts, their participation and standing"
			/>

			<SearchField
				value={search}
				onChangeText={setSearch}
				placeholder="Search by name, email or phone"
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
						<ResultCount total={query.total} noun="account" />
					}
					ListEmptyComponent={
						<EmptyState
							icon={Users}
							title={debouncedSearch ? "No matching accounts" : "No one here"}
							description={
								debouncedSearch
									? "Try part of the name, or the email address."
									: "No accounts match this filter."
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
						<UserRow user={item} onPress={() => setSelected(item.id)} />
					)}
				/>
			)}

			<UserDetailSheet userId={selected} onClose={() => setSelected(null)} />
		</AdminScreen>
	);
}

function UserRow({
	user,
	onPress,
}: {
	user: AdminUserListItem;
	onPress: () => void;
}) {
	const { colors, spacing } = useTheme();
	const name = user.fullName ?? "Unnamed";

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
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
						{(user.fullName ?? user.email).trim()[0]?.toUpperCase() ?? "?"}
					</Body>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="semibold" numberOfLines={1}>
						{name}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{user.email}
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
					label={`ID ${humanizeStatus(user.verificationStatus).toLowerCase()}`}
					tone={verificationTone(user.verificationStatus)}
				/>
				{user.status === "SUSPENDED" && (
					<StatusPill label="Suspended" tone="error" />
				)}
				{!user.onboardedAt && (
					<StatusPill label="Onboarding incomplete" tone="neutral" />
				)}
				<View style={{ flex: 1 }} />
				<Caption color="quaternary">
					Joined {formatDate(user.createdAt)}
				</Caption>
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{user.applicationCount} application
				{user.applicationCount === 1 ? "" : "s"} · {user.acceptedCount} accepted
				· {user.pledgeCount} pledge{user.pledgeCount === 1 ? "" : "s"}
			</Caption>
		</Surface>
	);
}
