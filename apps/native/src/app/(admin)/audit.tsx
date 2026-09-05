import type { AuditLogQuery } from "@nabhya/shared";
import { ScrollText, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Body, Caption } from "@/components/ui/typography";
import { useAuditLogs } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type EntityFilter = NonNullable<AuditLogQuery["entityName"]> | "ALL";

const FILTERS: Array<{ value: EntityFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "ORGANIZATION", label: "NGOs" },
	{ value: "USER", label: "Users" },
	{ value: "EVENT", label: "Events" },
	{ value: "DONATION", label: "Donations" },
];

/** Colour by intent, so destructive actions are scannable in a long list. */
function toneFor(action: string) {
	if (/REJECT|SUSPEND|DELETE|REVOKE|CANCEL/.test(action)) return "error";
	if (/VERIFIED|ACCEPT|COMPLETE|GRANT/.test(action)) return "success";
	return "neutral";
}

export default function AdminAuditLog() {
	const { colors, spacing } = useTheme();
	const [entity, setEntity] = useState<EntityFilter>("ALL");
	const [search, setSearch] = useState("");

	const query = useAuditLogs({
		action: search.trim() || undefined,
		...(entity === "ALL" ? {} : { entityName: entity }),
	});

	return (
		<Screen>
			<ScreenHeader
				title="Activity"
				subtitle="Every moderation and lifecycle action, newest first."
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
					placeholder="Search actions, e.g. SUSPEND"
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

			<FilterChips options={FILTERS} value={entity} onChange={setEntity} />

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
					ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
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
							title="Nothing recorded"
							description={
								search
									? "No actions match that search."
									: "Moderation and lifecycle actions appear here as they happen."
							}
						/>
					}
					renderItem={({ item }) => (
						<Surface>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									gap: spacing[2],
								}}
							>
								<StatusPill
									label={humanizeStatus(item.action)}
									tone={toneFor(item.action)}
								/>
								<Caption color="quaternary">
									{formatDateTime(item.createdAt)}
								</Caption>
							</View>

							<Body weight="medium" style={{ marginTop: spacing[2] }}>
								{item.actor?.fullName ?? item.actor?.email ?? "System"}
							</Body>
							{item.entityName && (
								<Caption color="tertiary">
									{humanizeStatus(item.entityName)}
									{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ""}
								</Caption>
							)}
						</Surface>
					)}
				/>
			)}
		</Screen>
	);
}
