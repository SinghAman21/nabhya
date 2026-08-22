import type { DocumentQueueQuery } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS, USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { FileCheck2 } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { humanizeStatus } from "@/components/status-pill";
import { Caption } from "@/components/ui/typography";
import { useOrgDocumentQueue, useUserDocumentQueue } from "@/hooks/use-admin";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";

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
 * The dossier screens answer "is this NGO legitimate?"; this answers "what is
 * waiting on me?", which is the question that decides how fast an NGO gets
 * verified. Reviewing from here is the same action, so it reuses the dossier's
 * review row rather than reimplementing approve/reject.
 */
export default function AdminQueue() {
	const [kind, setKind] = useState<Kind>("organization");
	const [status, setStatus] = useState<Status>("PENDING");

	return (
		<Screen>
			<ScreenHeader
				title="Verification queue"
				subtitle="Documents waiting on a decision, newest upload first."
			/>

			<FilterChips options={KINDS} value={kind} onChange={setKind} />
			<FilterChips options={STATUSES} value={status} onChange={setStatus} />

			{kind === "organization" ? (
				<OrgDocumentQueue status={status} />
			) : (
				<UserDocumentQueue status={status} />
			)}
		</Screen>
	);
}

function OrgDocumentQueue({ status }: { status: Status }) {
	const { colors, spacing } = useTheme();
	const query = useOrgDocumentQueue({ status });

	if (query.isLoading) return <LoadingState />;
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
			ListHeaderComponent={<QueueCount total={query.data?.meta.total ?? 0} />}
			ListEmptyComponent={
				<EmptyState
					icon={FileCheck2}
					title="Nothing here"
					description={
						status === "PENDING"
							? "Every NGO document has been reviewed."
							: `No ${humanizeStatus(status).toLowerCase()} documents.`
					}
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
	const query = useUserDocumentQueue({ status });

	if (query.isLoading) return <LoadingState />;
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
			ListHeaderComponent={<QueueCount total={query.data?.meta.total ?? 0} />}
			ListEmptyComponent={
				<EmptyState
					icon={FileCheck2}
					title="Nothing here"
					description={
						status === "PENDING"
							? "Every identity document has been reviewed."
							: `No ${humanizeStatus(status).toLowerCase()} documents.`
					}
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

function QueueCount({ total }: { total: number }) {
	const { spacing } = useTheme();
	if (total === 0) return null;

	return (
		<Caption color="tertiary" style={{ marginBottom: spacing[3] }}>
			{total} document{total === 1 ? "" : "s"}
		</Caption>
	);
}
