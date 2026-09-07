import type { AuditLogQuery } from "@nabhya/shared";
import { ScrollText } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { AuditRow } from "@/components/admin/audit-row";
import {
	AdminScreen,
	ListFooter,
	ResultCount,
	SearchField,
} from "@/components/admin/list-chrome";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
} from "@/components/screen-shell";
import { useAuditLogsPaged } from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { useDebounced } from "@/hooks/useDebounced";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

type EntityFilter = NonNullable<AuditLogQuery["entityName"]> | "ALL";

const FILTERS: Array<{ value: EntityFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "ORGANIZATION", label: "NGOs" },
	{ value: "USER", label: "Users" },
	{ value: "EVENT", label: "Events" },
	{ value: "DONATION", label: "Donations" },
];

/**
 * The audit log. A ledger, not a feed: one hairline-divided line per action,
 * paged, with the actor first because "who did this" is the question that
 * brings someone here.
 */
export default function AdminAuditLog() {
	const { colors, spacing } = useTheme();
	const [entity, setEntity] = useState<EntityFilter>("ALL");
	const [search, setSearch] = useState("");

	const action = useDebounced(search.trim().toUpperCase().replace(/\s+/g, "_"));
	const query = useAuditLogsPaged({
		...(action ? { action } : {}),
		...(entity === "ALL" ? {} : { entityName: entity }),
	});

	return (
		<AdminScreen>
			<ScreenHeader
				title="Activity"
				subtitle="Every moderation and lifecycle action, newest first"
			/>

			<SearchField
				value={search}
				onChangeText={setSearch}
				placeholder="Filter by action, e.g. suspend"
				autoCapitalize="characters"
			/>
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
					data={query.items}
					keyExtractor={(item) => item.id}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					ItemSeparatorComponent={() => (
						<View
							style={{
								height: 1,
								marginLeft: spacing[4],
								backgroundColor: colors.border.hairline,
							}}
						/>
					)}
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
					ListHeaderComponent={<ResultCount total={query.total} noun="entry" />}
					ListEmptyComponent={
						<EmptyState
							icon={ScrollText}
							title="Nothing recorded"
							description={
								action
									? "No actions match that filter."
									: "Moderation and lifecycle actions appear here as they happen."
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
					renderItem={({ item }) => <AuditRow entry={item} />}
				/>
			)}
		</AdminScreen>
	);
}
