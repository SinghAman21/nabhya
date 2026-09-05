import { Building2, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { OrgDetailSheet } from "@/components/admin/org-detail-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
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
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminOrganizations } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminOrgListItem } from "@/lib/types";

type Filter = "ALL" | "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: "PENDING", label: "Pending" },
	{ value: "UNDER_REVIEW", label: "In review" },
	{ value: "VERIFIED", label: "Verified" },
	{ value: "REJECTED", label: "Rejected" },
	{ value: "ALL", label: "All" },
];

export default function AdminOrganizations() {
	const { colors, spacing } = useTheme();
	const [filter, setFilter] = useState<Filter>("PENDING");
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string | null>(null);

	const query = useAdminOrganizations({
		search: search.trim(),
		...(filter === "ALL" ? {} : { verificationStatus: filter }),
	});

	return (
		<Screen>
			<ScreenHeader
				title="Organizations"
				subtitle="Verify NGOs and monitor what they publish."
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
					placeholder="Search by name, email or registration no."
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
							icon={Building2}
							title="Nothing here"
							description={
								filter === "PENDING"
									? "No organizations are waiting for verification."
									: "No organizations match this filter."
							}
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
		</Screen>
	);
}

function OrgRow({
	org,
	onPress,
}: {
	org: AdminOrgListItem;
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
						backgroundColor: colors.background.tertiary,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Body weight="bold" color="secondary">
						{org.organizationName[0]?.toUpperCase()}
					</Body>
				</View>
				<View style={{ flex: 1 }}>
					<Body weight="bold" numberOfLines={1}>
						{org.organizationName}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{[org.city, org.state].filter(Boolean).join(", ") || org.email}
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
					{org.eventCount} events · {org.needCount} needs
				</Caption>
				<Caption color="quaternary">Joined {formatDate(org.createdAt)}</Caption>
			</View>
		</Surface>
	);
}
