import type {
	BulkReviewResult,
	DocumentQueueSort,
	SortDir,
} from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS, USER_DOCUMENT_LABELS } from "@nabhya/shared";
import { ExternalLink, FileCheck2 } from "lucide-react-native";
import { useEffect, useEffectEvent, useState } from "react";
import { Platform, View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import { type TableColumn, tableRowId } from "@/components/admin/data-table";
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
import { useParamSort, useParamState } from "@/hooks/use-admin-params";
import { useOpenDocument } from "@/hooks/use-documents";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
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

/**
 * The same words the rows' `StatusPill`s print (`humanizeStatus`), with the
 * old wording kept as the hint. The filter said "Awaiting review / Approved"
 * while every pill below it said "Pending / Verified", so the select and the
 * column it filters named one state two ways.
 */
const STATUSES = [
	{ value: "PENDING" as const, label: "Pending", hint: "Awaiting review" },
	{ value: "VERIFIED" as const, label: "Verified", hint: "Approved" },
	{ value: "REJECTED" as const, label: "Rejected" },
];

const KIND_VALUES = KINDS.map((option) => option.value);
const STATUS_VALUES = STATUSES.map((option) => option.value);
const SORT_KEYS: DocumentQueueSort[] = ["uploadedAt", "documentType", "owner"];

type Sort = { sort: DocumentQueueSort; dir: SortDir };

/**
 * Oldest upload first. A queue is worked from the front: the document that
 * has waited longest is the one holding an NGO back longest, and newest-first
 * put it on page three behind everything uploaded since. The NGO directory
 * already defaulted this way.
 */
const DEFAULT_SORT: Sort = { sort: "uploadedAt", dir: "asc" };

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
 * - **The selection only ever holds rows on screen and still waiting.** It is
 *   cleared on every filter *and sort* change (a sort hands back a different
 *   twenty, so a kept selection would bulk-act on rows the reviewer can no
 *   longer see), a row reviewed on its own leaves it, and after a partial bulk
 *   failure it is exactly the rows that failed, each showing why.
 * - **The keyboard works the queue on the web.** J / K move a cursor down and
 *   up the table, A approves the cursor's row and moves on, R opens the reject
 *   sheet for it. Ignored while typing in a field or while the sheet is open.
 *
 * Kind, status and sort live in the URL (`useParamState`), so a reload or a
 * shared link lands on the same queue.
 */
export default function AdminQueue() {
	const [kind, setKind] = useParamState<Kind>(
		"kind",
		"organization",
		KIND_VALUES,
	);
	const [status, setStatus] = useParamState<Status>(
		"status",
		"PENDING",
		STATUS_VALUES,
	);

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
	const [sort, setSort] = useParamSort(DEFAULT_SORT, SORT_KEYS);
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
	const [sort, setSort] = useParamSort(DEFAULT_SORT, SORT_KEYS);
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
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const [view, setView] = useTableView("queue");
	const [selection, setSelection] = useState<Set<string>>(new Set());
	/**
	 * Why each row of the last bulk action failed, by id. Shown on the row
	 * itself: a toast saying "3 could not be" left the reviewer to find which
	 * three among forty. Cleared with the selection.
	 */
	const [failures, setFailures] = useState<Map<string, string>>(new Map());
	/** Ids about to be rejected - one from a row, or the whole selection. */
	const [rejecting, setRejecting] = useState<string[]>([]);
	/**
	 * Single-row reviews in flight, by id, with the decision being sent. Held
	 * here rather than read from `review.variables`: one mutation observer only
	 * tracks its *latest* call, so with two rows approved in quick succession
	 * the first row's button came back to life mid-request and its callbacks
	 * never fired. Each row is disabled for exactly as long as its own request.
	 */
	const [inFlight, setInFlight] = useState<
		Map<string, "VERIFIED" | "REJECTED">
	>(new Map());
	/** The keyboard cursor's row id (J / K). */
	const [cursor, setCursor] = useState<string | null>(null);

	const review = useReviewDocument(kind);
	const bulk = useBulkReviewDocuments(kind);
	const openDocument = useOpenDocument();

	// Only PENDING rows can be acted on, so the tick column and the bulk bar
	// exist only on that tab. Ticking an approved document would offer an action
	// that does nothing.
	const actionable = status === "PENDING";
	const keyboard =
		Platform.OS === "web" && isDesktop && view === "table" && actionable;

	const clearSelection = () => {
		setSelection(new Set());
		setFailures(new Map());
	};

	const settleRow = (id: string) => {
		setInFlight((previous) => {
			const next = new Map(previous);
			next.delete(id);
			return next;
		});
	};

	const rowBusy = (id: string) =>
		inFlight.has(id) || (bulk.isPending && !!bulk.variables?.ids.includes(id));

	const reviewOne = (
		id: string,
		input: { verificationStatus: "VERIFIED" | "REJECTED"; remarks?: string },
		done: string,
		after?: () => void,
	) => {
		setInFlight((previous) =>
			new Map(previous).set(id, input.verificationStatus),
		);
		review
			.mutateAsync({ id, input })
			.then(() => {
				settleRow(id);
				// Out of the selection too: a reviewed row left ticked would be
				// sent again by the next bulk press and fail as "already reviewed".
				setSelection((previous) => {
					const next = new Set(previous);
					next.delete(id);
					return next;
				});
				setFailures((previous) => {
					const next = new Map(previous);
					next.delete(id);
					return next;
				});
				after?.();
				toast.success(done);
			})
			.catch((error: unknown) => {
				settleRow(id);
				toast.error(apiErrorMessage(error));
			});
	};

	/**
	 * After a batch: the selection becomes exactly the rows that failed, each
	 * carrying its reason. They are what is left to deal with, and keeping them
	 * ticked means "try again" or "reject these instead" is one press.
	 */
	const settleBulk = (result: BulkReviewResult, verb: string) => {
		setSelection(new Set(result.failed.map((failure) => failure.id)));
		setFailures(
			new Map(result.failed.map((failure) => [failure.id, failure.reason])),
		);
		reportBulk(result, verb);
	};

	const approve = (ids: string[]) => {
		if (ids.length === 1 && ids[0]) {
			reviewOne(
				ids[0],
				{ verificationStatus: "VERIFIED" },
				"Document approved.",
			);
			return;
		}
		bulk.mutate(
			{ ids, verificationStatus: "VERIFIED" },
			{
				onSuccess: (result) => settleBulk(result, "approved"),
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	const reject = (remarks: string) => {
		const ids = rejecting;
		// Closing the sheet is what clears its remarks, so it closes only on
		// success - a failed request leaves the reviewer's text where it was.
		const finish = () => setRejecting([]);

		if (ids.length === 1 && ids[0]) {
			reviewOne(
				ids[0],
				{ verificationStatus: "REJECTED", remarks },
				"Document rejected. The uploader has been told why.",
				finish,
			);
			return;
		}
		bulk.mutate(
			{ ids, verificationStatus: "REJECTED", remarks },
			{
				onSuccess: (result) => {
					finish();
					settleBulk(result, "rejected");
				},
				onError: (error) => toast.error(apiErrorMessage(error)),
			},
		);
	};

	/* ---- Keyboard ---- */

	const moveCursor = (step: 1 | -1) => {
		if (items.length === 0) return;
		const at = cursor ? items.findIndex((item) => item.id === cursor) : -1;
		const nextIndex =
			at < 0
				? step === 1
					? 0
					: items.length - 1
				: Math.min(items.length - 1, Math.max(0, at + step));
		const next = items[nextIndex];
		if (!next) return;
		setCursor(next.id);
		// Near the end of what is loaded: fetch the next page before J runs out.
		if (nextIndex >= items.length - 3) loadMore();
		// Centred rather than "nearest": nearest leaves a row moving up tucked
		// under the pinned bar and the table's sticky header.
		requestAnimationFrame(() =>
			document
				.getElementById(tableRowId(next.id))
				?.scrollIntoView({ block: "center", behavior: "smooth" }),
		);
	};

	const onKey = useEffectEvent((event: KeyboardEvent) => {
		if (
			event.defaultPrevented ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey
		) {
			return;
		}
		// Typing "a" into a field must not approve anything. The open sheet is
		// a second guard, for the moment between its opening and its remarks
		// field taking focus.
		const target = event.target as HTMLElement | null;
		if (
			target?.isContentEditable ||
			target?.closest?.("input, textarea, select, [role='menu']")
		) {
			return;
		}
		if (rejecting.length > 0) return;

		const key = event.key.toLowerCase();
		if (key === "j" || key === "k") {
			event.preventDefault();
			moveCursor(key === "j" ? 1 : -1);
			return;
		}

		const row = cursor ? items.find((item) => item.id === cursor) : undefined;
		if (row?.verificationStatus !== "PENDING" || rowBusy(row.id)) return;

		if (key === "a") {
			event.preventDefault();
			approve([row.id]);
			// The approved row leaves this tab on the refetch, so the cursor
			// moves on now rather than pointing at a row about to vanish.
			moveCursor(1);
		} else if (key === "r") {
			event.preventDefault();
			setRejecting([row.id]);
		}
	});

	useEffect(() => {
		if (!keyboard) return;
		const listener = (event: KeyboardEvent) => onKey(event);
		document.addEventListener("keydown", listener);
		return () => document.removeEventListener("keydown", listener);
	}, [keyboard]);

	/* ---- Columns ---- */

	const columns: Array<TableColumn<T>> = [
		{
			key: "document",
			header: "Document",
			sortKey: "documentType",
			minWidth: 200,
			render: (document) => {
				const failure = failures.get(document.id);
				return (
					<View style={{ alignSelf: "stretch", minWidth: 0 }}>
						<Body weight="medium" numberOfLines={1}>
							{label(document)}
						</Body>
						{failure && (
							// On the row, not only in a toast - see `failures`.
							<Caption color={colors.error.ink} numberOfLines={2}>
								{failure}
							</Caption>
						)}
					</View>
				);
			},
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
			// On the Pending tab this column holds two buttons, not a state, and a
			// "Status" header over Approve / Reject named the wrong thing.
			header: actionable ? "Decision" : "Status",
			width: 96,
			render: (document) => {
				if (document.verificationStatus !== "PENDING") {
					return (
						<StatusPill
							label={humanizeStatus(document.verificationStatus)}
							tone={verificationTone(document.verificationStatus)}
						/>
					);
				}
				const busy = rowBusy(document.id);
				const sending = inFlight.get(document.id);
				return (
					// Two buttons instead of a pill: on the Pending tab every row
					// says "Pending", so the column is better spent on the decision.
					// Disabled per row, for as long as that row's request runs - a
					// second press on Approve used to send a second request, and a
					// shared flag froze every row while one was in flight.
					<View style={{ flexDirection: "row", gap: spacing[1.5] }}>
						<Button
							size="sm"
							onPress={() => approve([document.id])}
							disabled={busy}
							loading={sending === "VERIFIED"}
							accessibilityLabel={`Approve ${label(document)}`}
						>
							Approve
						</Button>
						<Button
							size="sm"
							variant="outline"
							onPress={() => setRejecting([document.id])}
							disabled={busy}
							loading={sending === "REJECTED"}
							accessibilityLabel={`Reject ${label(document)}`}
						>
							Reject
						</Button>
					</View>
				);
			},
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

	const otherKind = KINDS.find((option) => option.value !== kind);

	return (
		<AdminScreen
			title="Queue"
			subtitle={
				keyboard
					? "Documents waiting on a decision · J / K to move, A to approve, R to reject"
					: "Documents waiting on a decision"
			}
			toolbar={
				// The bulk bar rides in the pinned command bar, so it is still in
				// reach after ticking a row forty lines down - see `BulkBar`.
				<View style={{ gap: spacing[2] }}>
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
				</View>
			}
			onNearEnd={loadMore}
			refreshing={query.isRefetching && !query.isFetchingNextPage}
			onRefresh={() => query.refetch()}
		>
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
				onSortChange={(next) => {
					// A sort hands back a different twenty rows; a selection kept
					// across it would bulk-act on rows no longer on screen.
					clearSelection();
					onSortChange(next);
				}}
				{...(actionable ? { selection, onSelectionChange: setSelection } : {})}
				{...(keyboard && cursor ? { activeKey: cursor } : {})}
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
						action={
							status !== "PENDING" ? (
								<Button
									size="sm"
									variant="outline"
									onPress={() => onStatusChange("PENDING")}
								>
									Show pending
								</Button>
							) : otherKind ? (
								// This queue is clear; the other one may not be.
								<Button
									size="sm"
									variant="outline"
									onPress={() => {
										clearSelection();
										onKindChange(otherKind.value);
									}}
								>
									{`Check ${otherKind.label.toLowerCase()}`}
								</Button>
							) : undefined
						}
					/>
				}
			/>

			<RejectDocumentsSheet
				count={rejecting.length}
				onClose={() => setRejecting([])}
				onConfirm={reject}
				pending={rejecting.some((id) => inFlight.has(id)) || bulk.isPending}
			/>
		</AdminScreen>
	);
}

/**
 * Reports a batch honestly.
 *
 * The server returns per-document outcomes because one id in forty can fail on
 * its own - already reviewed, or deleted while the reviewer was reading. The
 * count goes in the toast and the reasons go on the rows (`settleBulk`), which
 * stay ticked: "3 could not be" with no way to find the three was the old
 * failure mode.
 */
function reportBulk(result: BulkReviewResult, verb: string) {
	const done = result.reviewed.length;
	const failed = result.failed.length;
	if (failed === 0) {
		toast.success(`${done} document${done === 1 ? "" : "s"} ${verb}.`);
		return;
	}
	toast.error(
		`${done} ${verb}, ${failed} could not be. ${
			failed === 1 ? "It is" : "They are"
		} still ticked, with the reason on the row.`,
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
