import {
	type AdminDonationRow,
	type AdminDonationSort,
	type AdminFinancialReportRow,
	type DonationStatus,
	FINANCIAL_REPORT_LABELS,
	formatFinancialYear,
	formatMinor,
} from "@nabhya/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileText, HandCoins } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { OrgDetailSheet } from "@/components/admin/org-detail-sheet";
import { SelectMenu } from "@/components/admin/select-menu";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState, MetricRow, Surface } from "@/components/screen-shell";
import { humanizeStatus, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Body, Caption } from "@/components/ui/typography";
import {
	useParamSearch,
	useParamSort,
	useParamState,
} from "@/hooks/use-admin-params";
import { useOpenDocument } from "@/hooks/use-documents";
import {
	LEDGER_WINDOWS,
	type LedgerWindow,
	ledgerRange,
	useAdminDonations,
	useAdminFinancialReports,
	useExportDonations,
} from "@/hooks/use-finance";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Show = "donations" | "reports";
type StatusFilter = "ANY" | DonationStatus;

const SHOWS = [
	{ value: "donations" as const, label: "Donation ledger" },
	{ value: "reports" as const, label: "Financial reports" },
];

const STATUSES = [
	{ value: "ANY" as const, label: "Any" },
	{ value: "COMPLETED" as const, label: "Completed" },
	{ value: "PENDING" as const, label: "Pending" },
	{ value: "FAILED" as const, label: "Failed" },
	{ value: "REFUNDED" as const, label: "Refunded" },
];

const SHOW_VALUES = SHOWS.map((option) => option.value);
const STATUS_VALUES = STATUSES.map((option) => option.value);
const WINDOW_VALUES = LEDGER_WINDOWS.map((option) => option.value);
const SORT_KEYS: AdminDonationSort[] = [
	"createdAt",
	"amount",
	"organization",
	"status",
];

function statusTone(status: DonationStatus) {
	return status === "COMPLETED"
		? "success"
		: status === "PENDING"
			? "warning"
			: status === "FAILED"
				? "error"
				: "neutral";
}

/**
 * Finance: the platform-wide donation ledger and every NGO's transparency
 * documents.
 *
 * **The ledger is a table and only a table**, like the audit log: every row is
 * the same eight facts and the reason to open it is to compare a column. The
 * totals above it are over the whole filter, not the loaded page - a reviewer
 * reconciling against Razorpay needs "₹4,20,000 settled this FY", not the sum
 * of twenty rows.
 *
 * **Export is the filter, exactly.** The button sends the same status, window,
 * NGO and search the table shows, so the CSV is the rows on screen and never a
 * different set. Every export is audited server-side.
 *
 * Donor names and emails show in full, including on anonymous gifts (marked
 * as such): anonymity is a promise about the public page and the NGO, not the
 * platform. `?org=<id>` scopes the page to one NGO, which is how the NGO
 * dossier links here.
 */
export default function AdminFinance() {
	const [show, setShow] = useParamState<Show>("show", "donations", SHOW_VALUES);

	return show === "donations" ? (
		<DonationLedger show={show} onShowChange={setShow} />
	) : (
		<ReportsList show={show} onShowChange={setShow} />
	);
}

function ShowMenu({
	show,
	onShowChange,
}: {
	show: Show;
	onShowChange: (next: Show) => void;
}) {
	return (
		<SelectMenu
			label="Show"
			value={show}
			options={SHOWS}
			onChange={onShowChange}
			minWidth={190}
		/>
	);
}

function DonationLedger({
	show,
	onShowChange,
}: {
	show: Show;
	onShowChange: (next: Show) => void;
}) {
	const { spacing } = useTheme();
	const router = useRouter();
	const params = useLocalSearchParams<{ org?: string }>();
	const organizationId =
		typeof params.org === "string" ? params.org : undefined;

	const [status, setStatus] = useParamState<StatusFilter>(
		"status",
		"ANY",
		STATUS_VALUES,
	);
	const [window, setWindow] = useParamState<LedgerWindow>(
		"window",
		"ALL",
		WINDOW_VALUES,
	);
	const {
		text: search,
		setText: setSearch,
		debounced: debouncedSearch,
	} = useParamSearch();
	const [sort, setSort] = useParamSort<AdminDonationSort>(
		{ sort: "createdAt", dir: "desc" },
		SORT_KEYS,
	);
	const [openOrg, setOpenOrg] = useState<string | null>(null);
	const exporter = useExportDonations();

	const filter = {
		...(status === "ANY" ? {} : { status }),
		...ledgerRange(window),
		...(organizationId ? { organizationId } : {}),
		...(debouncedSearch ? { search: debouncedSearch } : {}),
	};
	const filtered =
		status !== "ANY" ||
		window !== "ALL" ||
		!!debouncedSearch ||
		!!organizationId;

	const list = useAdminDonations({ ...filter, sort: sort.sort, dir: sort.dir });
	const summary = list.summary;

	const runExport = () =>
		exporter.mutate(filter, {
			onSuccess: (file) => {
				if (file.rowCount === 0) {
					toast.info("Nothing to export - no donations match these filters.");
				} else if (file.truncated) {
					toast.info(
						`Exported the newest ${file.rowCount.toLocaleString("en-IN")} rows. Narrow the filters for the rest.`,
					);
				} else {
					toast.success(
						`Exported ${file.rowCount.toLocaleString("en-IN")} donation${file.rowCount === 1 ? "" : "s"}.`,
					);
				}
			},
			onError: (error) => toast.error(apiErrorMessage(error)),
		});

	const columns: Array<TableColumn<AdminDonationRow>> = [
		{
			key: "amount",
			header: "Amount",
			sortKey: "amount",
			width: 130,
			render: (row) => (
				<Body weight="medium" numberOfLines={1}>
					{formatMinor(row.amountMinor, row.currency)}
				</Body>
			),
		},
		{
			key: "status",
			header: "Status",
			sortKey: "status",
			width: 120,
			render: (row) => (
				<StatusPill
					label={humanizeStatus(row.status)}
					tone={statusTone(row.status)}
				/>
			),
		},
		{
			key: "donor",
			header: "Donor",
			minWidth: 200,
			render: (row) => (
				<View style={{ minWidth: 0 }}>
					<Body numberOfLines={1}>
						{row.donorName ?? row.donorEmail ?? "Unknown"}
						{row.isAnonymous ? " · anonymous" : ""}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{row.donorUserId
							? row.donorEmail
							: `Guest · ${row.donorEmail ?? "-"}`}
					</Caption>
				</View>
			),
		},
		{
			key: "ngo",
			header: "NGO",
			sortKey: "organization",
			width: 200,
			render: (row) => (
				<Caption color="secondary" numberOfLines={1}>
					{row.organization.organizationName}
				</Caption>
			),
		},
		{
			key: "receipt",
			header: "Receipt / payment",
			width: 190,
			wideOnly: true,
			render: (row) => (
				<View style={{ minWidth: 0 }}>
					<Caption numberOfLines={1}>{row.receiptNumber ?? "-"}</Caption>
					<Caption color="quaternary" numberOfLines={1}>
						{row.providerPaymentId ?? row.failureReason ?? ""}
					</Caption>
				</View>
			),
		},
		{
			key: "when",
			header: "Created",
			sortKey: "createdAt",
			width: 160,
			align: "end",
			render: (row) => (
				<Caption color="quaternary" numberOfLines={1}>
					{formatDateTime(row.createdAt)}
				</Caption>
			),
		},
	];

	return (
		<AdminScreen
			title="Finance"
			subtitle={
				organizationId
					? "Donations to one NGO - clear the filter to see the platform"
					: "Every donation on the platform, in every state"
			}
			action={
				<Button
					size="sm"
					variant="outline"
					onPress={runExport}
					loading={exporter.isPending}
					disabled={list.query.isLoading}
				>
					Export CSV
				</Button>
			}
			toolbar={
				<Toolbar
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Donor, email, receipt or payment id"
					searchPending={search.trim() !== debouncedSearch}
				>
					<ShowMenu show={show} onShowChange={onShowChange} />
					{/* The NGO scope arrives from a dossier link as `?org=` and had
					    no control at all: the subtitle said "clear the filter" and
					    nothing on the page could. */}
					{organizationId && (
						<Button
							size="sm"
							variant="outline"
							onPress={() => router.setParams({ org: undefined })}
							accessibilityLabel="Show donations to every NGO"
						>
							All NGOs
						</Button>
					)}
					<SelectMenu
						label="Status"
						value={status}
						options={STATUSES}
						onChange={setStatus}
						minWidth={150}
					/>
					<SelectMenu
						label="When"
						value={window}
						options={LEDGER_WINDOWS}
						onChange={setWindow}
						minWidth={190}
					/>
				</Toolbar>
			}
			onNearEnd={list.loadMore}
			refreshing={list.query.isRefetching && !list.query.isFetchingNextPage}
			onRefresh={() => list.query.refetch()}
		>
			{summary && (
				<View style={{ marginBottom: spacing[5] }}>
					<MetricRow
						stats={[
							{
								label: "Settled",
								value: formatMinor(summary.completedMinor),
							},
							{ label: "Completed", value: summary.completedCount },
							{
								label: "Pending",
								value: summary.pendingCount,
								...(summary.pendingCount > 0
									? { tone: "warning" as const }
									: {}),
							},
							{ label: "Failed", value: summary.failedCount },
							{
								label: "Refunded",
								value: formatMinor(summary.refundedMinor),
							},
							{ label: "Donors", value: summary.donorCount },
						]}
					/>
				</View>
			)}

			<ConsoleList
				query={list.query}
				items={list.items}
				total={list.total}
				loadMore={list.loadMore}
				noun="donation"
				view="table"
				columns={columns}
				rowKey={(row) => row.id}
				onRowPress={(row) => setOpenOrg(row.organization.id)}
				rowLabel={(row) =>
					`Open ${row.organization.organizationName}, ${formatMinor(row.amountMinor, row.currency)}`
				}
				sort={sort}
				onSortChange={setSort}
				loadingLabel="Loading the ledger"
				renderCard={(row) => (
					<DonationCard
						row={row}
						onPress={() => setOpenOrg(row.organization.id)}
					/>
				)}
				empty={
					<EmptyState
						icon={HandCoins}
						title={filtered ? "No matching donations" : "No donations yet"}
						description={
							filtered
								? "No donations match these filters."
								: "Donations appear here from the moment a checkout starts."
						}
						{...(filtered
							? {
									action: (
										<Button
											size="sm"
											variant="outline"
											onPress={() => {
												setSearch("");
												setStatus("ANY");
												setWindow("ALL");
												if (organizationId) {
													router.setParams({ org: undefined });
												}
											}}
										>
											Clear filters
										</Button>
									),
								}
							: {})}
					/>
				}
			/>

			<OrgDetailSheet
				organizationId={openOrg}
				onClose={() => setOpenOrg(null)}
			/>
		</AdminScreen>
	);
}

/** The phone's row. Opens the NGO, as the table row does. */
function DonationCard({
	row,
	onPress,
}: {
	row: AdminDonationRow;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	return (
		<Surface onPress={onPress}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					gap: spacing[3],
				}}
			>
				<Body weight="bold">{formatMinor(row.amountMinor, row.currency)}</Body>
				<StatusPill
					label={humanizeStatus(row.status)}
					tone={statusTone(row.status)}
				/>
			</View>
			<Caption color="secondary" style={{ marginTop: spacing[1] }}>
				{row.organization.organizationName}
			</Caption>
			<Caption color="tertiary" numberOfLines={1}>
				{row.donorName ?? row.donorEmail ?? "Unknown donor"}
				{row.isAnonymous ? " · anonymous" : ""}
				{row.donorUserId ? "" : " · guest"}
			</Caption>
			<Caption color="quaternary" style={{ marginTop: spacing[1] }}>
				{row.receiptNumber ? `${row.receiptNumber} · ` : ""}
				{formatDateTime(row.createdAt)}
			</Caption>
		</Surface>
	);
}

function ReportsList({
	show,
	onShowChange,
}: {
	show: Show;
	onShowChange: (next: Show) => void;
}) {
	const { spacing } = useTheme();
	const {
		text: search,
		setText: setSearch,
		debounced: debouncedSearch,
	} = useParamSearch();
	const open = useOpenDocument();
	const list = useAdminFinancialReports(
		debouncedSearch ? { search: debouncedSearch } : {},
	);

	const openReport = (row: AdminFinancialReportRow) =>
		open.mutate(row.documentKey, {
			onError: (error) => toast.error(apiErrorMessage(error)),
		});

	const columns: Array<TableColumn<AdminFinancialReportRow>> = [
		{
			key: "title",
			header: "Document",
			minWidth: 240,
			render: (row) => (
				<View style={{ minWidth: 0 }}>
					<Body weight="medium" numberOfLines={1}>
						{row.title}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{FINANCIAL_REPORT_LABELS[row.type]}
					</Caption>
				</View>
			),
		},
		{
			key: "year",
			header: "Year",
			width: 120,
			render: (row) => (
				<Caption numberOfLines={1}>
					{formatFinancialYear(row.financialYear)}
				</Caption>
			),
		},
		{
			key: "ngo",
			header: "NGO",
			width: 240,
			render: (row) => (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<Caption
						color="secondary"
						numberOfLines={1}
						style={{ flexShrink: 1 }}
					>
						{row.organization.organizationName}
					</Caption>
					{row.organization.status !== "ACTIVE" && (
						<StatusPill
							label={humanizeStatus(row.organization.status)}
							tone="error"
						/>
					)}
				</View>
			),
		},
		{
			key: "filed",
			header: "Filed",
			width: 160,
			align: "end",
			render: (row) => (
				<Caption color="quaternary" numberOfLines={1}>
					{formatDateTime(row.createdAt)}
				</Caption>
			),
		},
	];

	return (
		<AdminScreen
			title="Finance"
			subtitle="Annual reports, audits and returns filed by every NGO"
			toolbar={
				<Toolbar
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Document title or NGO"
					searchPending={search.trim() !== debouncedSearch}
				>
					<ShowMenu show={show} onShowChange={onShowChange} />
				</Toolbar>
			}
			onNearEnd={list.loadMore}
			refreshing={list.query.isRefetching && !list.query.isFetchingNextPage}
			onRefresh={() => list.query.refetch()}
		>
			<ConsoleList
				query={list.query}
				items={list.items}
				total={list.total}
				loadMore={list.loadMore}
				noun="report"
				view="table"
				columns={columns}
				rowKey={(row) => row.id}
				onRowPress={openReport}
				rowLabel={(row) =>
					`Open ${row.title} from ${row.organization.organizationName}`
				}
				loadingLabel="Loading reports"
				renderCard={(row) => (
					<Surface onPress={() => openReport(row)}>
						<Body weight="medium" numberOfLines={2}>
							{row.title}
						</Body>
						<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
							{FINANCIAL_REPORT_LABELS[row.type]} ·{" "}
							{formatFinancialYear(row.financialYear)}
						</Caption>
						<Caption color="secondary" numberOfLines={1}>
							{row.organization.organizationName}
						</Caption>
					</Surface>
				)}
				empty={
					<EmptyState
						icon={FileText}
						title={debouncedSearch ? "No matching reports" : "No reports filed"}
						description={
							debouncedSearch
								? "No documents match this search."
								: "NGOs file annual reports and audited statements from their Reports page."
						}
					/>
				}
			/>
		</AdminScreen>
	);
}
