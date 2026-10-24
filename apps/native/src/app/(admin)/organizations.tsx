import type { AdminOrgSort, AdminOrgVerificationFilter } from "@nabhya/shared";
import { Building2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ConsoleList } from "@/components/admin/console-list";
import type { TableColumn } from "@/components/admin/data-table";
import { AdminScreen } from "@/components/admin/list-chrome";
import { OrgDetailSheet } from "@/components/admin/org-detail-sheet";
import { SelectMenu } from "@/components/admin/select-menu";
import { Toolbar, useTableView } from "@/components/admin/toolbar";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
import { InitialAvatar } from "@/components/initial-avatar";
import { EmptyState, Surface } from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption } from "@/components/ui/typography";
import { useAdminOrganizationsPaged } from "@/hooks/use-admin-lists";
import {
	useParamSearch,
	useParamSort,
	useParamState,
} from "@/hooks/use-admin-params";
import { useTheme } from "@/hooks/use-theme";
import { formatDate } from "@/lib/format";
import type { AdminOrgListItem } from "@/lib/types";

/**
 * The NGO directory, and the screen the whole console pattern is set by.
 *
 * Two axes, not one chip row. Verification state and account state are
 * independent - an NGO can be verified *and* suspended - and the old single
 * row of six chips had to lie about that by making "Suspended" a seventh
 * verification value. Two `SelectMenu`s say both at once and take one line
 * between them.
 *
 * **The default is "Awaiting" - pending and under review together**, which is
 * exactly what the dashboard's "NGOs awaiting verification" tile counts. The
 * screen used to default to Pending alone and read no params, so the tile said
 * 7 and the list it opened showed 4. The tile now links here with
 * `?verification=AWAITING`, and every filter, the sort and the search live in
 * the URL, so a reload or a shared link lands on the same list.
 */
type Verification = "ANY" | AdminOrgVerificationFilter;
type Standing = "ANY" | "ACTIVE" | "SUSPENDED" | "DELETED";

/**
 * Labels match the pills (`humanizeStatus`): "Under review", not "In review",
 * so the select and the column it filters use one word for one state.
 */
const VERIFICATION = [
	{
		value: "AWAITING" as const,
		label: "Awaiting",
		hint: "Pending and under review",
	},
	{ value: "ANY" as const, label: "Any" },
	{ value: "PENDING" as const, label: "Pending", hint: "Never looked at" },
	{
		value: "UNDER_REVIEW" as const,
		label: "Under review",
		hint: "Picked up, not decided",
	},
	{ value: "VERIFIED" as const, label: "Verified" },
	{ value: "REJECTED" as const, label: "Rejected" },
];

const STANDING = [
	{ value: "ANY" as const, label: "Any" },
	{ value: "ACTIVE" as const, label: "Active" },
	{ value: "SUSPENDED" as const, label: "Suspended" },
	// "Any" leaves deleted NGOs out (the server does); this is the way back to
	// them, for a restore.
	{ value: "DELETED" as const, label: "Deleted" },
];

const VERIFICATION_VALUES = VERIFICATION.map((option) => option.value);
const STANDING_VALUES = STANDING.map((option) => option.value);
const SORT_KEYS: AdminOrgSort[] = [
	"createdAt",
	"name",
	"city",
	"verificationStatus",
	"pendingDocuments",
	"events",
];

export default function AdminOrganizations() {
	const { colors, spacing } = useTheme();
	const [verification, setVerification] = useParamState<Verification>(
		"verification",
		"AWAITING",
		VERIFICATION_VALUES,
	);
	const [standing, setStanding] = useParamState<Standing>(
		"standing",
		"ANY",
		STANDING_VALUES,
	);
	const {
		text: search,
		setText: setSearch,
		debounced: debouncedSearch,
	} = useParamSearch();
	const [sort, setSort] = useParamSort<AdminOrgSort>(
		// Oldest waiting first: the default filter is "Awaiting", and the NGO
		// that has been waiting longest is the one to look at, not the newest
		// sign-up.
		{ sort: "createdAt", dir: "asc" },
		SORT_KEYS,
	);
	const [selected, setSelected] = useState<string | null>(null);
	/**
	 * The owner account opened from a dossier. Held here rather than inside
	 * `OrgDetailSheet` so the two drawers are siblings and open one after the
	 * other - nesting a `Modal` in a `Modal` puts two `OverlayHost`s in the
	 * stack and a toast lands on whichever registered last.
	 */
	const [owner, setOwner] = useState<string | null>(null);
	const [view, setView] = useTableView("organizations");

	const list = useAdminOrganizationsPaged({
		...(debouncedSearch ? { search: debouncedSearch } : {}),
		...(verification === "ANY" ? {} : { verificationStatus: verification }),
		...(standing === "ANY" ? {} : { status: standing }),
		sort: sort.sort,
		dir: sort.dir,
	});

	const filtered =
		!!debouncedSearch || verification !== "ANY" || standing !== "ANY";
	const clearFilters = () => {
		setSearch("");
		setVerification("ANY");
		setStanding("ANY");
	};

	/**
	 * The row after the open one, for the dossier's "Approve & next" and
	 * "Next". Read from the rows as loaded: a decision refetches the list and
	 * the decided NGO may leave the filter, but "next" means the one that was
	 * below it. Absent on the last loaded row; the page after is fetched as
	 * the reviewer nears it.
	 */
	const openIndex = selected
		? list.items.findIndex((org) => org.id === selected)
		: -1;
	const next = openIndex >= 0 ? list.items[openIndex + 1] : undefined;

	const columns: Array<TableColumn<AdminOrgListItem>> = [
		{
			key: "name",
			header: "Organization",
			sortKey: "name",
			minWidth: 240,
			render: (org) => (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2.5],
					}}
				>
					<InitialAvatar name={org.organizationName} size={28} square />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Body weight="medium" numberOfLines={1}>
							{org.organizationName}
						</Body>
						<Caption color="quaternary" numberOfLines={1}>
							{org.email ?? humanizeStatus(org.orgType)}
						</Caption>
					</View>
				</View>
			),
		},
		{
			key: "verification",
			header: "Verification",
			sortKey: "verificationStatus",
			width: 128,
			render: (org) => (
				<StatusPill
					label={humanizeStatus(org.verificationStatus)}
					tone={verificationTone(org.verificationStatus)}
				/>
			),
		},
		{
			key: "standing",
			header: "Standing",
			width: 96,
			render: (org) =>
				org.status === "SUSPENDED" ? (
					<StatusPill label="Suspended" tone="error" />
				) : org.status === "DELETED" ? (
					<StatusPill label="Deleted" tone="error" />
				) : (
					<Caption color="quaternary">Active</Caption>
				),
		},
		{
			key: "docs",
			header: "Docs",
			sortKey: "pendingDocuments",
			width: 72,
			align: "end",
			// The number a reviewer is actually hunting for, so it is a numeral in
			// warning ink rather than a pill saying "3 docs to review" - at 72pt
			// wide the sentence would not fit, and in a column the word is implied
			// by the header anyway.
			render: (org) => (
				<Caption
					weight={org.pendingDocuments > 0 ? "bold" : "normal"}
					color={
						org.pendingDocuments > 0
							? colors.warning.ink
							: (colors.text.quaternary as string)
					}
				>
					{org.pendingDocuments}
				</Caption>
			),
		},
		{
			key: "city",
			header: "City",
			sortKey: "city",
			width: 120,
			wideOnly: true,
			render: (org) => (
				<Caption color="tertiary" numberOfLines={1}>
					{org.city || "-"}
				</Caption>
			),
		},
		{
			key: "activity",
			header: "Events · Needs",
			sortKey: "events",
			width: 112,
			align: "end",
			wideOnly: true,
			render: (org) => (
				<Caption color="tertiary">
					{org.eventCount} · {org.needCount}
				</Caption>
			),
		},
		{
			key: "joined",
			header: "Joined",
			sortKey: "createdAt",
			width: 104,
			align: "end",
			render: (org) => (
				<Caption color="quaternary">{formatDate(org.createdAt)}</Caption>
			),
		},
	];

	return (
		<AdminScreen
			title="NGOs"
			subtitle="Verify organizations and keep an eye on what they publish"
			toolbar={
				<Toolbar
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Search by name, email or registration number"
					searchPending={search.trim() !== debouncedSearch}
					view={view}
					onViewChange={setView}
				>
					<SelectMenu
						label="Verification"
						value={verification}
						options={VERIFICATION}
						onChange={setVerification}
					/>
					<SelectMenu
						label="Standing"
						value={standing}
						options={STANDING}
						onChange={setStanding}
						minWidth={160}
					/>
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
				noun="organization"
				view={view}
				columns={columns}
				rowKey={(org) => org.id}
				onRowPress={(org) => setSelected(org.id)}
				rowLabel={(org) => `Open ${org.organizationName}`}
				sort={sort}
				onSortChange={setSort}
				loadingLabel="Loading organizations"
				renderCard={(org) => (
					<OrgCard org={org} onPress={() => setSelected(org.id)} />
				)}
				empty={
					<EmptyState
						icon={Building2}
						title={
							debouncedSearch
								? "No matching organizations"
								: verification === "AWAITING" && standing === "ANY"
									? "Nothing waiting"
									: filtered
										? "Nothing matches"
										: "No organizations yet"
						}
						description={
							debouncedSearch
								? "Try a shorter name, or the registration number."
								: verification === "AWAITING" && standing === "ANY"
									? "No organizations are waiting for verification."
									: filtered
										? "No organizations match these filters."
										: "Organizations appear here once they register."
						}
						{...(filtered
							? {
									action: (
										<Button size="sm" variant="outline" onPress={clearFilters}>
											Clear filters
										</Button>
									),
								}
							: {})}
					/>
				}
			/>

			<OrgDetailSheet
				organizationId={selected}
				onClose={() => setSelected(null)}
				{...(next
					? {
							onNext: () => {
								if (openIndex >= list.items.length - 3) list.loadMore();
								setSelected(next.id);
							},
						}
					: {})}
				onOpenOwner={(userId) => {
					setSelected(null);
					setOwner(userId);
				}}
			/>

			{/* Volunteers live on their own screen; an NGO's account is reached
			    from its organisation, which is why this screen owns a user
			    drawer too. */}
			<UserDetailSheet userId={owner} onClose={() => setOwner(null)} />
		</AdminScreen>
	);
}

/**
 * The card, for the grid and for mobile.
 *
 * Deliberately *not* the table row rearranged. A card is read as a block, so it
 * leads with identity and puts state on its own line as pills - the pills are
 * right here and wrong in the table, where the same information is a column and
 * a pill in every row would be a stripe of colour down the page.
 */
function OrgCard({
	org,
	onPress,
}: {
	org: AdminOrgListItem;
	onPress: () => void;
}) {
	const { spacing } = useTheme();
	const place = [org.city, org.state].filter(Boolean).join(", ");

	return (
		<Surface onPress={onPress}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
			>
				<InitialAvatar name={org.organizationName} square />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Body weight="semibold" numberOfLines={1}>
						{org.organizationName}
					</Body>
					<Caption color="tertiary" numberOfLines={1}>
						{place || org.email || "No location"}
					</Caption>
				</View>
			</View>

			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
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
				{org.status === "DELETED" && (
					<StatusPill label="Deleted" tone="error" />
				)}
				{org.pendingDocuments > 0 && (
					<StatusPill
						label={`${org.pendingDocuments} doc${org.pendingDocuments === 1 ? "" : "s"} to review`}
						tone="warning"
					/>
				)}
			</View>

			<Caption color="quaternary" style={{ marginTop: spacing[2.5] }}>
				{org.eventCount} event{org.eventCount === 1 ? "" : "s"} ·{" "}
				{org.needCount} need{org.needCount === 1 ? "" : "s"} · Joined{" "}
				{formatDate(org.createdAt)}
			</Caption>
		</Surface>
	);
}
