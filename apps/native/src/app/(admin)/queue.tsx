import type { DocumentQueueQuery } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS, USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { useLocalSearchParams } from "expo-router";
import { FileCheck2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import {
	AdminScreen,
	ListFooter,
	ResultCount,
} from "@/components/admin/list-chrome";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	ScreenHeader,
} from "@/components/screen-shell";
import { humanizeStatus } from "@/components/status-pill";
import {
	useOrgDocumentQueuePaged,
	useUserDocumentQueuePaged,
} from "@/hooks/use-admin-lists";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

type Kind = "organization" | "user";
type Status = NonNullable<DocumentQueueQuery["status"]>;

const KINDS: Array<{ value: Kind; label: string }> = [
	{ value: "organization", label: "NGO documents" },
	{ value: "user", label: "Identity" },
];

const STATUSES: Array<{ value: Status; label: string }> = [
	{ value: "PENDING", label: "Awaiting review" },
	{ value: "VERIFIED", label: "Approved" },
	{ value: "REJECTED", label: "Rejected" },
];

/**
 * The verification queue — every document waiting on a superadmin, across all
 * organizations at once.
 *
 * The dossier sheets answer "is this NGO legitimate?"; this answers "what is
 * waiting on me?", which is the question that decides how fast an NGO gets
 * verified. Reviewing from here is the same action, so it reuses the dossier's
 * review row rather than reimplementing approve/reject. The Overview links in
 * with `?kind=` so "Identity documents" lands on the identity tab.
 */
export default function AdminQueue() {
	const params = useLocalSearchParams<{ kind?: string }>();
	const [kind, setKind] = useState<Kind>(
		params.kind === "user" ? "user" : "organization",
	);
	const [status, setStatus] = useState<Status>("PENDING");
	const { spacing } = useTheme();

	// A second tap on the Overview's other queue row while this tab is already
	// mounted must still switch tabs.
	useEffect(() => {
		if (params.kind === "user" || params.kind === "organization") {
			setKind(params.kind);
		}
	}, [params.kind]);

	return (
		<AdminScreen>
			<ScreenHeader
				title="Queue"
				subtitle="Documents waiting on a decision, newest upload first"
			/>

			<FilterChips options={KINDS} value={kind} onChange={setKind} inline />
			<View style={{ height: spacing[2] }} />
			<FilterChips options={STATUSES} value={status} onChange={setStatus} />

			{kind === "organization" ? (
				<OrgDocumentQueue status={status} />
			) : (
				<UserDocumentQueue status={status} />
			)}
		</AdminScreen>
	);
}

function OrgDocumentQueue({ status }: { status: Status }) {
	const { colors, spacing } = useTheme();
	const query = useOrgDocumentQueuePaged({ status });

	if (query.isLoading) return <LoadingState label="Loading the queue" />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
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
			ListHeaderComponent={<ResultCount total={query.total} noun="document" />}
			ListEmptyComponent={
				<EmptyState
					icon={FileCheck2}
					title={status === "PENDING" ? "Queue is clear" : "Nothing here"}
					description={
						status === "PENDING"
							? "Every NGO document has been reviewed."
							: `No ${humanizeStatus(status).toLowerCase()} NGO documents.`
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
				<DocumentReviewRow
					document={item}
					kind="organization"
					label={
						ORG_DOCUMENT_LABELS[item.documentType] ??
						humanizeStatus(item.documentType)
					}
					subtitle={item.organization.organizationName}
				/>
			)}
		/>
	);
}

function UserDocumentQueue({ status }: { status: Status }) {
	const { colors, spacing } = useTheme();
	const query = useUserDocumentQueuePaged({ status });

	if (query.isLoading) return <LoadingState label="Loading the queue" />;
	if (query.isError) {
		return (
			<ErrorState
				message={apiErrorMessage(query.error)}
				onRetry={() => query.refetch()}
			/>
		);
	}

	return (
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
			ListHeaderComponent={<ResultCount total={query.total} noun="document" />}
			ListEmptyComponent={
				<EmptyState
					icon={FileCheck2}
					title={status === "PENDING" ? "Queue is clear" : "Nothing here"}
					description={
						status === "PENDING"
							? "Every identity document has been reviewed."
							: `No ${humanizeStatus(status).toLowerCase()} identity documents.`
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
				<DocumentReviewRow
					document={item}
					kind="user"
					label={
						USER_DOCUMENT_LABELS[item.documentType] ??
						humanizeStatus(item.documentType)
					}
					subtitle={item.user.fullName ?? item.user.email}
				/>
			)}
		/>
	);
}
