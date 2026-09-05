import type { Role } from "@nabhya/shared";
import { Search, Users } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
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
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminUsers } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
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
	const base = { search: search.trim() };
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

	const query = useAdminUsers(toQuery(filter, search));

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
				title="People"
				subtitle="Track volunteers, their participation and account standing."
			/>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[2],
					backgroundColor: colors.background.tertiary,
					borderRadius: 12,
					paddingHorizontal: spacing[3.5],
					marginBottom: spacing[4],
				}}
			>
				<Search size={18} color={colors.text.quaternary as string} />
				<Input
					placeholder="Search by name, email or phone"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3.5],
					}}
				/>
			</View>

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
							icon={Users}
							title="No one here"
							description="No accounts match this filter."
						/>
					}
					renderItem={({ item }) => (
						<UserRow user={item} onPress={() => setSelected(item.id)} />
					)}
				/>
			)}

			<UserDetailSheet userId={selected} onClose={() => setSelected(null)} />
		</View>
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

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<View
					style={{
						width: 40,
						height: 40,
						borderRadius: 20,
						backgroundColor: colors.background.tertiary,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Body weight="bold" color="secondary">
						{(user.fullName ?? user.email)[0]?.toUpperCase()}
					</Body>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{user.fullName ?? "Unnamed"}
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
			</View>

			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					marginTop: spacing[3],
					paddingTop: spacing[3],
					borderTopWidth: 1,
					borderTopColor: colors.border.light,
				}}
			>
				<Caption color="quaternary">
					{user.applicationCount} applications · {user.acceptedCount} accepted ·{" "}
					{user.pledgeCount} pledges
				</Caption>
				<Caption color="quaternary">{formatDate(user.createdAt)}</Caption>
			</View>
		</Surface>
	);
}
