import {
	type DonationStatus,
	formatMinor,
	type OrgDonationSort,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { HandCoins, Lock } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn, TableSort } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { SelectMenu, type SelectOption } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { InitialAvatar } from "@/components/initial-avatar";
import { PagedList, usePagedQuery } from "@/components/paged-list";
import {
	EmptyState,
	MetricRow,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { Body, BodySmall, Caption } from "@/components/ui/typography";
import { useExportOrgDonations } from "@/hooks/use-finance";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useTheme } from "@/hooks/use-theme";
import { useGridColumns, useMedia } from "@/hooks/useMedia";
import { apiErrorMessage, donationsApi, queryKeys } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import type { OrgDonation } from "@/lib/types";

/** Every state but COMPLETED, which needs no pill - the amount says it. */
const STATUS_PILL: Record<
	Exclude<DonationStatus, "COMPLETED">,
	{ label: string; tone: "warning" | "error" | "neutral" }
> = {
	PENDING: { label: "Confirming", tone: "warning" },
	FAILED: { label: "Failed", tone: "error" },
	REFUNDED: { label: "Refunded", tone: "neutral" },
};

/**
 * The desktop status filter. The endpoint has always taken `status` (and
 * defaults to COMPLETED); the phone never offered it. On desktop it is the
 * reconciliation view - which payments are still confirming, which failed.
 */
const STATUSES: Array<SelectOption<DonationStatus>> = [
	{ value: "COMPLETED", label: "Received", hint: "Settled by Razorpay" },
	{ value: "PENDING", label: "Confirming", hint: "Paid, awaiting the webhook" },
	{ value: "FAILED", label: "Failed" },
	{ value: "REFUNDED", label: "Refunded" },
];

/**
 * Money received through Nabhya. Read-only by design: a donation only becomes
 * COMPLETED through Razorpay's signed webhook, so there is nothing here for
 * the organisation to approve - just to see, thank, and reconcile.
 *
 * On desktop it is a ledger: the console's sortable table (largest gift,
 * newest, by donor), a status select, one page scroller. Reconciling money is
 * comparing rows down a column, which a card per donation cannot do - the
 * amount sits at a different place in every box. Phones keep the cards.
 * Sorting is server-side (`orgDonationQuerySchema`), since the list pages.
 */
export default function OrgDonations() {
	const { spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const access = useOrgAccess();
	const [status, setStatus] = useState<DonationStatus>("COMPLETED");
	const [sort, setSort] = useState<TableSort<OrgDonationSort>>({
		sort: "createdAt",
		dir: "desc",
	});
	const [view, setView] = useTableView("ngo-donations");
	// Money is visible to owners, admins and viewers only (`money.view`); for
	// anyone else the endpoint 403s, which used to surface as an error screen.
	const moneyBlocked = access.blocked("money.view");
	// The phone always sends the defaults (received, newest first) - exactly
	// what it got before the desktop table existed.
	const params = { status, sort: sort.sort, dir: sort.dir };
	const { query, items, first, loadMore } = usePagedQuery({
		queryKey: queryKeys.orgDonations(params),
		fetchPage: (page) =>
			donationsApi.listForOrg({ ...params, page, limit: 20 }),
		enabled: !moneyBlocked,
	});

	const stats = first?.stats;
	const columns = useGridColumns();
	const exporter = useExportOrgDonations();

	// The report is the list in a file: the same status the screen shows, so
	// "Download report" never hands over a different set of rows.
	const download = () =>
		exporter.mutate(
			{ status },
			{
				onSuccess: (file) =>
					file.rowCount === 0
						? toast.info("Nothing to download yet - no donations in this view.")
						: toast.success(
								`Downloaded ${file.rowCount.toLocaleString("en-IN")} donation${file.rowCount === 1 ? "" : "s"}.`,
							),
				// Says which action failed; a bare reason ("Network error") in a
				// toast reads as the whole screen breaking.
				onError: (error) =>
					toast.error(
						`Couldn't prepare the report. ${apiErrorMessage(error, "Try again in a moment.")}`,
					),
			},
		);
	const downloadButton = moneyBlocked ? undefined : (
		<Button
			size="sm"
			variant="outline"
			onPress={download}
			loading={exporter.isPending}
		>
			Download report
		</Button>
	);

	const numbers =
		stats && (stats.completedCount > 0 || stats.pendingCount > 0) ? (
			<View style={{ marginBottom: spacing[5] }}>
				<MetricRow
					stats={[
						{ label: "Received", value: formatMinor(stats.totalMinor) },
						{ label: "Donors", value: stats.donorCount },
						{ label: "Donations", value: stats.completedCount },
					]}
				/>
				{stats.pendingCount > 0 && (
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						{stats.pendingCount} payment{stats.pendingCount === 1 ? "" : "s"}{" "}
						still confirming with Razorpay.
					</Caption>
				)}
			</View>
		) : null;

	const locked = moneyBlocked ? (
		<EmptyState
			icon={Lock}
			title={
				access.isSuspended
					? "Unavailable while suspended"
					: "Donations are visible to owners, admins and viewers"
			}
			description={moneyBlocked}
		/>
	) : null;

	const empty =
		status === "COMPLETED" ? (
			<EmptyState
				icon={HandCoins}
				title="No donations yet"
				description="Donations come from your public profile, with the amount, the donor's name (unless they chose to stay anonymous) and any message they left. A profile with a logo, a description and a published report gets far more of them."
				// An empty state with nothing to do is a dead end. The
				// profile is the page donors actually give from, so it is
				// the one useful thing to offer here.
				action={
					<Button
						variant="outline"
						onPress={() => router.push("/(ngo)/profile")}
					>
						Check your profile
					</Button>
				}
			/>
		) : (
			<EmptyState
				icon={HandCoins}
				title={`No ${STATUS_PILL[status].label.toLowerCase()} payments`}
				description="Nothing is in this state right now."
			/>
		);

	if (isDesktop) {
		return (
			<AdminScreen
				title="Donations"
				subtitle="Money received through Nabhya"
				action={downloadButton}
				{...(locked
					? {}
					: {
							toolbar: (
								<Toolbar view={view} onViewChange={setView}>
									<SelectMenu
										label="Status"
										value={status}
										options={STATUSES}
										onChange={setStatus}
									/>
								</Toolbar>
							),
							onNearEnd: loadMore,
							refreshing: query.isRefetching && !query.isFetchingNextPage,
							onRefresh: () => query.refetch(),
						})}
			>
				{locked ?? (
					<>
						{numbers}
						<ConsoleList
							query={query}
							items={items}
							total={first?.meta.total ?? 0}
							loadMore={loadMore}
							noun="donation"
							view={view}
							columns={DONATION_COLUMNS}
							rowKey={(donation) => donation.id}
							sort={sort}
							onSortChange={setSort}
							loadingLabel="Loading donations"
							renderCard={(donation) => <DonationRow donation={donation} />}
							empty={empty}
						/>
					</>
				)}
			</AdminScreen>
		);
	}

	return (
		<Screen>
			<ScreenHeader
				back
				title="Donations"
				subtitle="Money received through Nabhya"
				action={downloadButton}
			/>

			{locked ?? (
				<PagedList
					query={query}
					items={items}
					loadMore={loadMore}
					numColumns={columns}
					noun="donations"
					header={numbers ?? undefined}
					keyExtractor={(item) => item.id}
					renderItem={(item) => <DonationRow donation={item} />}
					empty={empty}
				/>
			)}
		</Screen>
	);
}

/**
 * The ledger's columns. No row press: a donation has nothing to open or
 * decide (only the webhook settles one), so the row is read, not clicked.
 * The donor column carries the message as its second line, since a thank-you
 * is written to a person, not to an amount.
 */
const DONATION_COLUMNS: Array<TableColumn<OrgDonation>> = [
	{
		key: "donor",
		header: "Donor",
		sortKey: "donor",
		minWidth: 240,
		render: (donation) => <DonorCell donation={donation} />,
	},
	{
		key: "amount",
		header: "Amount",
		sortKey: "amount",
		width: 120,
		align: "end",
		render: (donation) => (
			<Body weight="medium">{formatMinor(donation.amountMinor)}</Body>
		),
	},
	{
		key: "date",
		header: "Date",
		sortKey: "createdAt",
		width: 116,
		align: "end",
		render: (donation) => (
			<Caption color="tertiary">
				{formatDate(donation.completedAt ?? donation.createdAt)}
			</Caption>
		),
	},
	{
		key: "receipt",
		header: "Receipt",
		width: 160,
		wideOnly: true,
		render: (donation) => (
			<Caption color="quaternary" numberOfLines={1}>
				{donation.receiptNumber ?? "-"}
			</Caption>
		),
	},
	{
		key: "status",
		header: "Status",
		width: 116,
		render: (donation) =>
			donation.status === "COMPLETED" ? (
				<Caption color="quaternary">Received</Caption>
			) : (
				<StatusPill
					label={STATUS_PILL[donation.status].label}
					tone={STATUS_PILL[donation.status].tone}
				/>
			),
	},
];

function DonorCell({ donation }: { donation: OrgDonation }) {
	const { spacing } = useTheme();

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				alignSelf: "stretch",
			}}
		>
			<InitialAvatar name={donation.donorName} size={28} />
			<View style={{ flex: 1, minWidth: 0 }}>
				{/* Anonymity is applied server-side; donorName arrives null. */}
				<Body weight="medium" numberOfLines={1}>
					{donation.donorName ?? "Anonymous donor"}
				</Body>
				{donation.message && (
					<Caption color="quaternary" numberOfLines={1}>
						“{donation.message}”
					</Caption>
				)}
			</View>
		</View>
	);
}

function DonationRow({ donation }: { donation: OrgDonation }) {
	const { spacing } = useTheme();
	// Anonymity is applied server-side; donorName arrives null.
	const donor = donation.donorName ?? "Anonymous donor";
	const completed = donation.status === "COMPLETED";

	return (
		<Surface>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={donation.donorName} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="bold" numberOfLines={1}>
						{formatMinor(donation.amountMinor)}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{donor} ·{" "}
						{formatRelative(donation.completedAt ?? donation.createdAt)}
					</Caption>
				</View>
				{donation.status !== "COMPLETED" && (
					<StatusPill
						label={STATUS_PILL[donation.status].label}
						tone={STATUS_PILL[donation.status].tone}
					/>
				)}
			</View>

			{donation.message && (
				<BodySmall color="secondary" style={{ marginTop: spacing[3] }}>
					“{donation.message}”
				</BodySmall>
			)}

			{completed && donation.receiptNumber && (
				<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
					Receipt {donation.receiptNumber} ·{" "}
					{formatDate(donation.completedAt ?? donation.createdAt)}
				</Caption>
			)}
		</Surface>
	);
}
