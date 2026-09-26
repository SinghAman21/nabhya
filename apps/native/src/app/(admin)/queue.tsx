import type { DocumentQueueSort, SortDir } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS, USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { useLocalSearchParams } from "expo-router";
import { ExternalLink, FileCheck2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { DocumentReviewRow } from "@/components/admin/document-review-row";
import { AdminScreen } from "@/components/admin/list-chrome";
import { RejectDocumentsSheet } from "@/components/admin/reject-documents-sheet";
import { SelectMenu } from "@/components/admin/select-menu";
import {
	BulkAction,
	BulkBar,
	Toolbar,
	useTableView,
} from "@/components/admin/toolbar";
import type { PagedQuery } from "@/components/paged-list";
import { EmptyState } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption } from "@/components/ui/typography";
import { useBulkReviewDocuments, useReviewDocument } from "@/hooks/use-admin";
import {
	useOrgDocumentQueuePaged,
	useUserDocumentQueuePaged,
} from "@/hooks/use-admin-lists";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { focusable, type PressState } from "@/lib/focus";
import { formatDateTime } from "@/lib/format";
import type {
	AdminOrgDocument,
	AdminOrgDocumentQueueItem,
	AdminUserDocumentQueueItem,
} from "@/lib/types";

type Kind = "organization" | "user";
type Status = "PENDING" | "VERIFIED" | "REJECTED";

const KINDS = [
	{
		value: "organization" as const,
		label: "NGO documents",
		hint: "Registration, PAN, 12A, 80G",
	},
	{
		value: "user" as const,
		label: "Identity",
		hint: "Volunteer IDs and liveness selfies",
	},
];

const STATUSES = [
	{ value: "PENDING" as const, label: "Awaiting review" },
	{ value: "VERIFIED" as const, label: "Approved" },
	{ value: "REJECTED" as const, label: "Rejected" },
];

/**
 * The verification queue - every document waiting on a superadmin, across all
 * organizations at once.
 *
 * The dossier sheets answer "is this NGO legitimate?"; this answers "what is
 * waiting on me?", which is the question that decides how fast an NGO gets
 * verified. The Overview links in with `?kind=` so "Identity documents" lands
 * on the identity tab.
 *
 * **This is the screen the table was built for.** It used to be a column of
 * 1100pt-wide cards, each carrying a document type, one line of metadata, a
 * link, and a full-bleed orange Approve button - one screenful per two
 * documents, and a reviewer with forty pending had to scroll a metre to see
 * what was there. Four documents per NGO times every NGO on the platform is a
 * grind, and the shape of the work is: scan the list, notice that fifteen of
 * them are the routine kind, approve those in one action, then look properly at
 * the three that are not. So:
 *
 * - **A tick column and a bulk bar.** Approving fifteen documents is one press,
 *   not fifteen. This is the only bulk action in the console, deliberately:
 *   approving a routine document is repetitive and reversible, while suspending
 *   an NGO is neither, and belongs in a dossier where the whole record is on
 *   screen.
 * - **Approve is a press; Reject asks.** The server requires remarks on a
 *   rejection, so rejecting one row and rejecting a selection both open
 *   `RejectDocumentsSheet`. That is the asymmetry the screen is arranged
 *   around - the common answer is cheap, the consequential one is a question.
 * - **The file opens in a column, not a paragraph.** "Open document" was a
 *   link buried mid-card; here it is a 96pt column and the same distance from
 *   the pointer on every row.
 */
export default function AdminQueue() {
	const params = useLocalSearchParams<{ kind?: string }>();
	const [kind, setKind] = useState<Kind>(
		params.kind === "user" ? "user" : "organization",
	);
	const [status, setStatus] = useState<Status>("PENDING");

	// A second tap on the Overview's other queue row while this tab is already
	// mounted must still switch tabs.
	useEffect(() => {
		if (params.kind === "user" || params.kind === "organization") {
			setKind(params.kind);
		}
	}, [params.kind]);

	return kind === "organization" ? (
		<OrgQueue
			status={status}
			onStatusChange={setStatus}
			kind={kind}
			onKindChange={setKind}
		/>
	) : (
		<UserQueue
			status={status}
			onStatusChange={setStatus}
			kind={kind}
			onKindChange={setKind}
		/>
	);
}

/* -------------------------------------------------------------------------- */
/* The two kinds                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The kinds differ in three things - which hook, which label map, and whose
 * name goes on the row - so those are what the shared body takes. Two thin
 * wrappers rather than one component calling both hooks: hook order cannot
 * depend on a prop, and calling both would keep the unused queue fetching.
 */
function OrgQueue(props: QueueChromeProps) {
	const [sort, setSort] = useState<Sort>({ sort: "uploadedAt", dir: "desc" });
	const list = useOrgDocumentQueuePaged({ status: props.status, ...sort });

	return (
		<DocumentQueue<AdminOrgDocumentQueueItem>
			{...props}
			{...list}
			sort={sort}
			onSortChange={setSort}
			noun="NGO"
			label={(document) =>
				ORG_DOCUMENT_LABELS[document.documentType] ??
				humanizeStatus(document.documentType)
			}
			owner={(document) => document.organization.organizationName}
		/>
	);
}

function UserQueue(props: QueueChromeProps) {
	const [sort, setSort] = useState<Sort>({ sort: "uploadedAt", dir: "desc" });
	const list = useUserDocumentQueuePaged({ status: props.status, ...sort });

	return (
		<DocumentQueue<AdminUserDocumentQueueItem>
			{...props}
			{...list}
			sort={sort}
			onSortChange={setSort}
			noun="identity"
			label={(document) =>
				USER_DOCUMENT_LABELS[document.documentType] ??
				humanizeStatus(document.documentType)
			}
			owner={(document) => document.user.fullName ?? document.user.email}
		/>
	);
}

type Sort = { sort: DocumentQueueSort; dir: SortDir };

interface QueueChromeProps {
	kind: Kind;
	onKindChange: (next: Kind) => void;
	status: Status;
	onStatusChange: (next: Status) => void;
}

/* -------------------------------------------------------------------------- */
/* The queue itself                                                           */
/* -------------------------------------------------------------------------- */

function DocumentQueue<T extends AdminOrgDocument>({
	kind,
	onKindChange,
	status,
	onStatusChange,
	query,
	items,
	total,
	loadMore,
	sort,
	onSortChange,
	noun,
	label,
	owner,
}: QueueChromeProps & {
	query: PagedQuery;
	items: T[];
	total: number;
	loadMore: () => void;
	sort: Sort;
	onSortChange: (next: Sort) => void;
	noun: string;
	label: (document: T) => string;
	owner: (document: T) => string;
}) {
	const { spacing } = useTheme();
	const [view, setView] = useTableView("queue");
	const [selection, setSelection] = useState<Set<string>>(new Set());
	/** Ids about to be rejected - one from a row, or the whole selection. */
	const [rejecting, setRejecting] = useState<string[]>([]);

	const review = useReviewDocument(kind);
	const bulk = useBulkReviewDocuments(kind);
	const openDocument = useOpenDocument();

	// Only PENDING rows can be acted on, so the tick column and the bulk bar
	// exist only on that tab. Ticking an approved document would offer an action
	// that does nothing.
	const actionable = status === "PENDING";

	const clearSelection = () => setSelection(new Set());

	const approve = (ids: string[]) => {
		if (ids.length === 1 && ids[0]) {
			review.mutate(
				{ id: ids[0], input: { verificationStatus: "VERIFIED" } },
				{
					onSuccess: () => toast.success("Document approved."),
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			);
			return;
		}
		bulk.mutate(
			{ ids, verificationStatus: "VERIFIED" },
			{
				onSuccess: (result) => {
					clearSelection();
					reportBulk(result, "approved");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const reject = (remarks: string) => {
		const ids = rejecting;
		const finish = () => setRejecting([]);

		if (ids.length === 1 && ids[0]) {
			review.mutate(
				{
					id: ids[0],
					input: { verificationStatus: "REJECTED", remarks },
				},
				{
					onSuccess: () => {
						finish();
						toast.success("Document rejected. The uploader has been told why.");
					},
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			);
			return;
		}
		bulk.mutate(
			{ ids, verificationStatus: "REJECTED", remarks },
			{
				onSuccess: (result) => {
					finish();
					clearSelection();
					reportBulk(result, "rejected");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const columns: Array<TableColumn<T>> = [
		{
			key: "document",
			header: "Document",
			sortKey: "documentType",
			minWidth: 200,
			render: (document) => (
				<Body weight="medium" numberOfLines={1}>
					{label(document)}
				</Body>
			),
		},
		{
			key: "owner",
			header: kind === "organization" ? "Organization" : "Person",
			sortKey: "owner",
			minWidth: 180,
			render: (document) => (
				<Caption color="tertiary" numberOfLines={1}>
					{owner(document)}
				</Caption>
			),
		},
		{
			key: "uploaded",
			header: "Uploaded",
			sortKey: "uploadedAt",
			width: 148,
			render: (document) => (
				<Caption color="quaternary" numberOfLines={1}>
					{formatDateTime(document.uploadedAt)}
				</Caption>
			),
		},
		{
			key: "file",
			header: "File",
			width: 104,
			render: (document) => (
				<View style={{ gap: spacing[0.5] }}>
					<FileLink
						label="Open"
						onPress={() => openDocument.mutate(document.documentKey)}
						disabled={openDocument.isPending}
					/>
					{document.metadata?.liveness?.secondaryFrameKey && (
						<FileLink
							label="Liveness"
							onPress={() =>
								openDocument.mutate(
									document.metadata?.liveness?.secondaryFrameKey as string,
								)
							}
							disabled={openDocument.isPending}
						/>
					)}
				</View>
			),
		},
		{
			key: "status",
			header: "Status",
			width: 96,
			render: (document) =>
				document.verificationStatus === "PENDING" ? (
					// Two buttons instead of a pill: on the Pending tab every row
					// says "Pending", so the column is better spent on the decision.
					<View style={{ flexDirection: "row", gap: spacing[1.5] }}>
						<Button
							size="sm"
							onPress={() => approve([document.id])}
							accessibilityLabel={`Approve ${label(document)}`}
						>
							Approve
						</Button>
						<Button
							size="sm"
							variant="outline"
							onPress={() => setRejecting([document.id])}
							accessibilityLabel={`Reject ${label(document)}`}
						>
							Reject
						</Button>
					</View>
				) : (
					<StatusPill
						label={humanizeStatus(document.verificationStatus)}
						tone={verificationTone(document.verificationStatus)}
					/>
				),
		},
		{
			key: "remarks",
			header: "Remarks",
			minWidth: 160,
			wideOnly: true,
			render: (document) => (
				<Caption color="quaternary" numberOfLines={2}>
					{document.remarks || "-"}
				</Caption>
			),
		},
	];

	// The decision column needs the room, so it is not squeezed on the Pending
	// tab: 96 fits two `sm` buttons only because "Remarks" is `wideOnly` and the
	// two identity columns give up their slack first.
	const decisionColumns = actionable
		? columns.map((column) =>
				column.key === "status" ? { ...column, width: 172 } : column,
			)
		: columns;

	return (
		<AdminScreen
			title="Queue"
			subtitle="Documents waiting on a decision, newest upload first"
			toolbar={
				<Toolbar view={view} onViewChange={setView}>
					<SelectMenu
						label="Queue"
						value={kind}
						options={KINDS}
						onChange={(next) => {
							clearSelection();
							onKindChange(next);
						}}
						minWidth={240}
					/>
					<SelectMenu
						label="Status"
						value={status}
						options={STATUSES}
						onChange={(next) => {
							clearSelection();
							onStatusChange(next);
						}}
						minWidth={180}
					/>
				</Toolbar>
			}
			onNearEnd={loadMore}
			refreshing={query.isRefetching && !query.isFetchingNextPage}
			onRefresh={() => query.refetch()}
		>
			{actionable && (
				<BulkBar count={selection.size} onClear={clearSelection}>
					<BulkAction
						label={`Approve ${selection.size}`}
						onPress={() => approve([...selection])}
						loading={bulk.isPending}
					/>
					<BulkAction
						label="Reject"
						destructive
						onPress={() => setRejecting([...selection])}
					/>
				</BulkBar>
			)}

			<ConsoleList
				query={query}
				items={items}
				total={total}
				loadMore={loadMore}
				noun="document"
				view={view}
				columns={decisionColumns}
				rowKey={(document) => document.id}
				sort={sort}
				onSortChange={onSortChange}
				{...(actionable ? { selection, onSelectionChange: setSelection } : {})}
				loadingLabel="Loading the queue"
				renderCard={(document) => (
					<DocumentReviewRow
						document={document}
						kind={kind}
						label={label(document)}
						subtitle={owner(document)}
					/>
				)}
				empty={
					<EmptyState
						icon={FileCheck2}
						title={status === "PENDING" ? "Queue is clear" : "Nothing here"}
						description={
							status === "PENDING"
								? `Every ${noun} document has been reviewed.`
								: `No ${humanizeStatus(status).toLowerCase()} ${noun} documents.`
						}
					/>
				}
			/>

			<RejectDocumentsSheet
				count={rejecting.length}
				onClose={() => setRejecting([])}
				onConfirm={reject}
				pending={review.isPending || bulk.isPending}
			/>
		</AdminScreen>
	);
}

/**
 * Reports a batch honestly.
 *
 * The server returns per-document outcomes because one id in forty can fail on
 * its own - already reviewed, or deleted while the reviewer was reading. A
 * toast saying "39 approved" and nothing else leaves the fortieth sitting in the
 * queue with no explanation, so a partial result is an error toast naming the
 * count that did not go through.
 */
function reportBulk(
	result: { reviewed: string[]; failed: Array<{ id: string; reason: string }> },
	verb: string,
) {
	const done = result.reviewed.length;
	if (result.failed.length === 0) {
		toast.success(`${done} document${done === 1 ? "" : "s"} ${verb}.`);
		return;
	}
	toast.error(
		`${done} ${verb}, ${result.failed.length} could not be - they may have been reviewed already. Refresh to see what is left.`,
	);
}

/** The file link. A link, not a button: it leaves the app. */
function FileLink({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const { colors, spacing } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="link"
			accessibilityLabel={`${label} document`}
			accessibilityState={{ disabled: !!disabled }}
			hitSlop={6}
			{...focusable}
			style={(state) => {
				const { pressed, hovered } = state as PressState;
				return {
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[1],
					minHeight: 22,
					opacity: pressed || disabled ? 0.6 : 1,
					...(hovered ? { opacity: 0.85 } : {}),
				};
			}}
		>
			<ExternalLink size={12} color={colors.primary.ink} strokeWidth={2} />
			<Caption weight="medium" color={colors.primary.ink}>
				{label}
			</Caption>
		</Pressable>
	);
}
