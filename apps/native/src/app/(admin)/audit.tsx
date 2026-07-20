import { ScrollText, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminAuditLogs } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { AuditLogItem } from "@/lib/types";

type EntityFilter = "ALL" | string;

/** Matches the entityName values the server writes to audit_logs. */
const ENTITY_FILTERS: Array<{ value: EntityFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "ORGANIZATION", label: "NGOs" },
	{ value: "USER", label: "Users" },
	{ value: "EVENT", label: "Events" },
	{ value: "ORGANIZATION_NEED", label: "Needs" },
	{ value: "ORGANIZATION_DOCUMENT", label: "NGO docs" },
	{ value: "USER_DOCUMENT", label: "ID docs" },
];

export default function AdminAuditLog() {
	const { colors, spacing } = useTheme();
	const [entity, setEntity] = useState<EntityFilter>("ALL");
	const [search, setSearch] = useState("");

	const query = useAdminAuditLogs({
		...(search.trim() ? { action: search.trim() } : {}),
		...(entity === "ALL" ? {} : { entityName: entity }),
	});

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
				title="Activity"
				subtitle="Every action taken across the platform, newest first."
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
					placeholder="Filter by action, e.g. VERIFY"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="characters"
					style={{
						flex: 1,
						backgroundColor: "transparent",
						borderWidth: 0,
						paddingHorizontal: 0,
						paddingVertical: spacing[3.5],
					}}
				/>
			</View>

			<FilterChips
				options={ENTITY_FILTERS}
				value={entity}
				onChange={setEntity}
			/>

			{query.isLoading ? (
				<LoadingState label="Loading activity…" />
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
							icon={ScrollText}
							title="No activity found"
							description="Actions taken on the platform will appear here."
						/>
					}
					renderItem={({ item }) => <AuditRow log={item} />}
				/>
			)}
		</View>
	);
}

function AuditRow({ log }: { log: AuditLogItem }) {
	const { spacing } = useTheme();
	const actor = log.actor?.fullName ?? log.actor?.email ?? "System";

	return (
		<Surface>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing[2],
				}}
			>
				<Body weight="bold" numberOfLines={1} style={{ flex: 1 }}>
					{humanizeStatus(log.action)}
				</Body>
				<StatusPill label={humanizeStatus(log.entityName)} tone="neutral" />
			</View>
			<Caption color="tertiary" style={{ marginTop: spacing[1.5] }}>
				{actor} · {formatRelative(log.createdAt)}
			</Caption>
		</Surface>
	);
}
